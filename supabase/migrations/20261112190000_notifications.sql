-- Push notifications: device subscriptions, preferences and a sent-log (to avoid repeats).
-- VAPID keys are Edge Function secrets (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY), set in the
-- Supabase dashboard — never committed to this public repo.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device text,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

create table public.notification_prefs (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  bills boolean not null default true,
  matches boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.notification_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  sent_at timestamptz not null default now(),
  unique (user_id, key)
);

do $$
declare t text;
begin
  foreach t in array array['push_subscriptions', 'notification_prefs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows: select" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "own rows: insert" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "own rows: update" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "own rows: delete" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;
alter table public.notification_log enable row level security; -- server only

-- Every 15 minutes, ask the `notify` Edge Function to send anything due.
-- Uses the public (publishable) key only: the job is idempotent — it sends only what's due, once.
-- (Scheduled separately: see 20261112191000_notify_cron.sql)
