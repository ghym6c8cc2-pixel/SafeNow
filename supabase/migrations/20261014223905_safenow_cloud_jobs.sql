-- Hosted setup is skipped until the trusted operator supplies a project URL.
-- Run hosting/enable-jobs.sql after filling runtime_config on a new project.
do $setup$
begin
 if not exists(select 1 from private.runtime_config where id) then return; end if;
-- Run as database owner AFTER setting private.runtime_config.project_url.
-- The random job secret is generated in the database and never returned to the client.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

 if not exists(select 1 from vault.decrypted_secrets where name='safenow_dispatch') then
  perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'safenow_dispatch','Credencial exclusiva dos jobs SafeNow.');
 end if;

perform cron.schedule('safenow-push','* * * * *',$job$
 select net.http_post(url:=(select project_url from private.runtime_config where id)||'/functions/v1/push-dispatch',
 headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='safenow_dispatch')),
 body:='{}'::jsonb,timeout_milliseconds:=30000);
$job$);
perform cron.schedule('safenow-retention','20 6 * * *',$job$
 select net.http_post(url:=(select project_url from private.runtime_config where id)||'/functions/v1/retention',
 headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='safenow_dispatch')),
 body:='{}'::jsonb,timeout_milliseconds:=60000);
$job$);

end $setup$;
