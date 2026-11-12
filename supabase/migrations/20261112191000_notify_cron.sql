-- Every 15 minutes, call the `notify` Edge Function to send anything that's due.
-- Uses only the public (publishable) key; the function is idempotent (sends each reminder once).
select cron.schedule(
  'mylife-notify',
  '*/15 * * * *',
  $$ select net.http_post(
       url := 'https://peaxepkkuvdemrnrnfwa.supabase.co/functions/v1/notify',
       headers := '{"Content-Type":"application/json","apikey":"sb_publishable_IZKSasZyMjr5Iyz_CF54Jg_JqsCnm6c"}'::jsonb,
       body := '{"source":"cron"}'::jsonb
     ); $$
);
