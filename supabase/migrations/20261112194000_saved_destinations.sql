-- Travel planner: saved destinations (airport codes), private to each user
create table public.saved_destinations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  code text not null check (code ~ '^[A-Z]{3}$'),
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, code)
);
create index saved_destinations_user_idx on public.saved_destinations (user_id);
alter table public.saved_destinations enable row level security;
create policy "own rows: select" on public.saved_destinations for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows: insert" on public.saved_destinations for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own rows: update" on public.saved_destinations for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows: delete" on public.saved_destinations for delete to authenticated using ((select auth.uid()) = user_id);
