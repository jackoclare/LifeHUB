-- MyLife Hub — Phase 2: personal data
-- Every table is owned by a user and protected by Row Level Security:
-- a signed-in user can only ever read or change their own rows.

-- ---------- Helper: keep updated_at fresh ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- User settings (dashboard layout, theme) ----------
create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text,
  theme text not null default 'dark' check (theme in ('dark', 'light')),
  dashboard jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Calendar ----------
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  event_date date not null,
  event_time time,
  kind text not null default 'personal' check (kind in ('personal', 'reminder', 'travel', 'football')),
  notes text,
  created_at timestamptz not null default now()
);
create index calendar_events_user_date_idx on public.calendar_events (user_id, event_date);

-- ---------- Bills ----------
create table public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  provider text,
  category text not null default 'Other',
  amount numeric(10, 2) not null check (amount >= 0),
  frequency text not null default 'monthly'
    check (frequency in ('weekly', 'fortnightly', 'four_weekly', 'monthly', 'quarterly', 'six_monthly', 'annually', 'one_off')),
  next_due_date date not null,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bills_user_due_idx on public.bills (user_id, next_due_date);

create table public.bill_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  bill_id uuid not null references public.bills (id) on delete cascade,
  due_date date not null,
  amount numeric(10, 2) not null check (amount >= 0),
  paid_at timestamptz not null default now(),
  unique (bill_id, due_date)
);
create index bill_payments_user_idx on public.bill_payments (user_id, paid_at);
create index bill_payments_bill_idx on public.bill_payments (bill_id);

-- ---------- Shopping lists ----------
create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  store text,
  created_at timestamptz not null default now()
);
create index shopping_lists_user_idx on public.shopping_lists (user_id);

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  list_id uuid not null references public.shopping_lists (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  quantity numeric(8, 2) not null default 1 check (quantity > 0),
  category text not null default 'Other',
  est_price numeric(8, 2) check (est_price >= 0),
  checked boolean not null default false,
  created_at timestamptz not null default now()
);
create index shopping_items_list_idx on public.shopping_items (list_id);
create index shopping_items_user_idx on public.shopping_items (user_id);

-- ---------- Wish list ----------
create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  retailer text,
  url text check (url is null or url ~* '^https?://'),
  image_url text check (image_url is null or image_url ~* '^https?://'),
  current_price numeric(10, 2) check (current_price >= 0),
  target_price numeric(10, 2) check (target_price >= 0),
  priority smallint not null default 2 check (priority between 1 and 3),
  notes text,
  purchased boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index wishlist_items_user_idx on public.wishlist_items (user_id);

create table public.wishlist_prices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null references public.wishlist_items (id) on delete cascade,
  price numeric(10, 2) not null check (price >= 0),
  source text not null default 'manual',
  recorded_at timestamptz not null default now()
);
create index wishlist_prices_item_idx on public.wishlist_prices (item_id, recorded_at);
create index wishlist_prices_user_idx on public.wishlist_prices (user_id);

-- ---------- updated_at triggers ----------
create trigger user_settings_updated before update on public.user_settings for each row execute function public.set_updated_at();
create trigger bills_updated before update on public.bills for each row execute function public.set_updated_at();
create trigger wishlist_items_updated before update on public.wishlist_items for each row execute function public.set_updated_at();

-- ---------- Row Level Security ----------
do $$
declare
  t text;
begin
  foreach t in array array[
    'user_settings', 'calendar_events', 'bills', 'bill_payments',
    'shopping_lists', 'shopping_items', 'wishlist_items', 'wishlist_prices'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows: select" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "own rows: insert" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "own rows: update" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "own rows: delete" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end;
$$;

-- Child rows must point at a parent the same user owns
create or replace function public.check_same_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_owner uuid;
begin
  if tg_table_name = 'bill_payments' then
    select user_id into parent_owner from public.bills where id = new.bill_id;
  elsif tg_table_name = 'shopping_items' then
    select user_id into parent_owner from public.shopping_lists where id = new.list_id;
  elsif tg_table_name = 'wishlist_prices' then
    select user_id into parent_owner from public.wishlist_items where id = new.item_id;
  end if;
  if parent_owner is null or parent_owner <> new.user_id then
    raise exception 'Parent record not found';
  end if;
  return new;
end;
$$;

create trigger bill_payments_owner before insert or update on public.bill_payments for each row execute function public.check_same_owner();
create trigger shopping_items_owner before insert or update on public.shopping_items for each row execute function public.check_same_owner();
create trigger wishlist_prices_owner before insert or update on public.wishlist_prices for each row execute function public.check_same_owner();
