-- Runtime configuration contains no secret; the job credential stays in Supabase Vault.
create table private.runtime_config(id boolean primary key default true check(id),project_url text not null,dispatch_secret_name text not null default 'safenow_dispatch');
create table private.verification_runs(id uuid primary key default gen_random_uuid(),status text not null default 'pending' check(status in ('pending','running','finished')),created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '10 minutes',completed_at timestamptz,result jsonb);
alter table private.runtime_config enable row level security;
alter table private.verification_runs enable row level security;
revoke all on private.runtime_config,private.verification_runs from public,anon,authenticated;
grant all on private.runtime_config,private.verification_runs to service_role;
create function public.authorize_dispatch(provided text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare expected text;
begin
 if provided is null or char_length(provided)<>64 then return false; end if;
 select v.decrypted_secret into expected from vault.decrypted_secrets v join private.runtime_config c on c.dispatch_secret_name=v.name where c.id;
 return expected is not null and extensions.digest(provided,'sha256')=extensions.digest(expected,'sha256');
end $$;
create function public.claim_verification_run() returns uuid language plpgsql security definer set search_path='' as $$
declare run_id uuid;
begin
 select id into run_id from private.verification_runs where status='pending' and expires_at>now() order by created_at desc limit 1 for update skip locked;
 if run_id is not null then update private.verification_runs set status='running' where id=run_id; end if;
 return run_id;
end $$;
create function public.finish_verification_run(run_id uuid,report jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if octet_length(report::text)>20000 then raise exception 'Resultado excede o limite.'; end if;
 update private.verification_runs set status='finished',completed_at=now(),result=report where id=run_id and status='running';
end $$;
create function public.retention_work() returns jsonb language sql stable security definer set search_path='' as $$
 with expired as(select id from public.alerts where status in ('deleted','spam') and updated_at<now()-interval '30 days' limit 100)
 select jsonb_build_object('alerts',(select coalesce(jsonb_agg(id),'[]') from expired),
 'paths',(select coalesce(jsonb_agg(path),'[]') from public.evidence where alert_id in(select id from expired)),
 'accounts',(select coalesce(jsonb_agg(id),'[]') from public.profiles where status='deletion_requested' and role<>'admin' and updated_at<now()-interval '1 day'))
$$;
create function public.retention_complete(alert_ids uuid[]) returns void language plpgsql security definer set search_path='' as $$
begin
 delete from public.alerts where id=any(alert_ids) and status in ('deleted','spam') and updated_at<now()-interval '30 days';
 update private.alert_owners set latitude=round(latitude::numeric,3),longitude=round(longitude::numeric,3),accuracy=null where captured_at<now()-interval '30 days';
 delete from public.audit_log where created_at<now()-interval '90 days';
 delete from private.verification_runs where created_at<now()-interval '7 days';
end $$;
revoke all on function public.authorize_dispatch(text),public.claim_verification_run(),public.finish_verification_run(uuid,jsonb),public.retention_work(),public.retention_complete(uuid[]) from public,anon,authenticated;
grant execute on function public.authorize_dispatch(text),public.claim_verification_run(),public.finish_verification_run(uuid,jsonb),public.retention_work(),public.retention_complete(uuid[]) to service_role;
