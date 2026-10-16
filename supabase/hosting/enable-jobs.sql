-- Run as database owner AFTER setting private.runtime_config.project_url.
-- The random job secret is generated in the database and never returned to the client.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
do $$
begin
 if not exists(select 1 from vault.decrypted_secrets where name='safenow_dispatch') then
  perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'safenow_dispatch','Credencial exclusiva dos jobs SafeNow.');
 end if;
end $$;
select cron.schedule('safenow-push','* * * * *',$job$
 select net.http_post(url:=(select project_url from private.runtime_config where id)||'/functions/v1/push-dispatch',
 headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='safenow_dispatch')),
 body:='{}'::jsonb,timeout_milliseconds:=30000);
$job$);
select cron.schedule('safenow-retention','20 6 * * *',$job$
 select net.http_post(url:=(select project_url from private.runtime_config where id)||'/functions/v1/retention',
 headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='safenow_dispatch')),
 body:='{}'::jsonb,timeout_milliseconds:=60000);
$job$);
