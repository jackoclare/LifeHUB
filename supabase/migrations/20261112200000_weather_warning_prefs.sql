alter table public.notification_prefs
  add column if not exists weather boolean not null default true,
  add column if not exists weather_region text not null default 'wm' check (weather_region in ('wm','em','ee','se','sw','nw','ne','yh','wl','sc','ni'));
