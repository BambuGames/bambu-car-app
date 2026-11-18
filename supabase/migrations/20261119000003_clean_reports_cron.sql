-- Daily report cleanup: pg_cron calls the clean-reports function through pg_net.
-- The function URL and the shared secret are read from Vault at run time (names clean_reports_url and
-- cron_secret); this migration holds no values. Set them per environment, see the README.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid) from cron.job where jobname = 'clean-reports';
select cron.schedule('clean-reports', '17 3 * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'clean_reports_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000 -- pg_net's default 5 s is shorter than a run with many files
  )
$$);
