-- Private token per user for the calendar subscription feed (Edge Function `calendar`)
alter table public.user_settings
  add column calendar_token text unique check (calendar_token is null or calendar_token ~ '^[a-f0-9]{40,64}$');
comment on column public.user_settings.calendar_token is 'Private token for the iPhone/Google calendar subscription feed (calendar Edge Function)';
