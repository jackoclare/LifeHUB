-- PIN unlock: each signed-in person sets their own PIN; on any device they can
-- unlock with it instead of email + password. PINs are stored as bcrypt hashes.
-- Checking a PIN is only possible server-side (service role), with an escalating
-- lock-out after repeated wrong guesses (shared across all PIN attempts).

create table public.app_pins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  pin_hash text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_pins enable row level security;
-- No policies: nobody can read or write PINs directly from the browser.

create table public.app_pin_guard (
  id smallint primary key default 1 check (id = 1),
  failed_attempts int not null default 0,
  locked_until timestamptz
);
alter table public.app_pin_guard enable row level security;
insert into public.app_pin_guard (id) values (1);

-- Signed-in user sets or changes their own PIN (must be unique across users)
create or replace function public.set_app_pin(p_pin text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'You need to be signed in to set a PIN';
  end if;
  if p_pin !~ '^[0-9]{4,8}$' then
    raise exception 'PIN must be 4 to 8 digits';
  end if;
  if exists (select 1 from public.app_pins where user_id <> uid and pin_hash = extensions.crypt(p_pin, pin_hash)) then
    raise exception 'Please choose a different PIN';
  end if;
  insert into public.app_pins (user_id, pin_hash, updated_at)
  values (uid, extensions.crypt(p_pin, extensions.gen_salt('bf', 10)), now())
  on conflict (user_id) do update set pin_hash = excluded.pin_hash, updated_at = now();
end;
$$;

-- Have I set a PIN? Is any PIN set at all? (reveals nothing secret)
create or replace function public.app_pin_status()
returns json
language sql
security definer
set search_path = ''
stable
as $$
  select json_build_object(
    'any_pin', exists (select 1 from public.app_pins),
    'my_pin', exists (select 1 from public.app_pins where user_id = auth.uid())
  );
$$;

-- Server-only: check a PIN. Returns the matching user's email when correct.
create or replace function public.check_app_pin(p_pin text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  guard public.app_pin_guard%rowtype;
  matched uuid;
  owner_email text;
begin
  select * into guard from public.app_pin_guard where id = 1 for update;
  if guard.locked_until is not null and guard.locked_until > now() then
    return json_build_object('ok', false, 'reason', 'locked', 'locked_until', guard.locked_until);
  end if;
  if p_pin ~ '^[0-9]{4,8}$' then
    select user_id into matched from public.app_pins where pin_hash = extensions.crypt(p_pin, pin_hash) limit 1;
  end if;
  if matched is not null then
    update public.app_pin_guard set failed_attempts = 0, locked_until = null where id = 1;
    select email into owner_email from auth.users where id = matched;
    return json_build_object('ok', true, 'email', owner_email);
  end if;
  -- wrong PIN: after 5 misses lock for 15 min, doubling each further miss (max 24h)
  update public.app_pin_guard
    set failed_attempts = failed_attempts + 1,
        locked_until = case
          when failed_attempts + 1 >= 5
            then now() + make_interval(mins => least(15 * power(2, failed_attempts + 1 - 5)::int, 1440))
          else null end
    where id = 1
    returning * into guard;
  return json_build_object('ok', false, 'reason', case when guard.locked_until is not null then 'locked' else 'wrong' end,
                           'tries_left', greatest(0, 5 - guard.failed_attempts), 'locked_until', guard.locked_until);
end;
$$;

revoke all on function public.set_app_pin(text) from public, anon;
grant execute on function public.set_app_pin(text) to authenticated;

revoke all on function public.app_pin_status() from public;
grant execute on function public.app_pin_status() to anon, authenticated;

revoke all on function public.check_app_pin(text) from public, anon, authenticated;
grant execute on function public.check_app_pin(text) to service_role;

-- (applied separately as pin_status_signed_in_only)
revoke execute on function public.app_pin_status() from anon;
