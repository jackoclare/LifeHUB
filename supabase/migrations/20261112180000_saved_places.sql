-- Saved places from the Explore map (OpenStreetMap ids), private to each user
create table public.saved_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  osm_id text not null,
  name text not null check (char_length(name) between 1 and 200),
  category text not null,
  kind text,
  lat double precision not null,
  lon double precision not null,
  address text,
  website text,
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, osm_id)
);
create index saved_places_user_idx on public.saved_places (user_id);
alter table public.saved_places enable row level security;
create policy "own rows: select" on public.saved_places for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows: insert" on public.saved_places for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own rows: update" on public.saved_places for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows: delete" on public.saved_places for delete to authenticated using ((select auth.uid()) = user_id);
