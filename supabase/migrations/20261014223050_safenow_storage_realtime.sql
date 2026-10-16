insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('evidence','evidence',false,20971520,array['image/jpeg','image/png','video/mp4']) on conflict(id) do nothing;
-- Upload, update and delete go ONLY through validated Edge Function with service credentials.
create policy evidence_storage_read on storage.objects for select to authenticated using(
 bucket_id='evidence' and exists(select 1 from public.evidence e where e.path=name and private.can_view(e.alert_id))
);
-- Postgres Changes MVP: public alert payload contains no author ID or precise location.
-- RLS checks subscription reads. Private author/vote tables are never published.
alter publication supabase_realtime add table public.alerts;

create function public.register_evidence(a uuid,p text,k text,b int,m text) returns uuid language plpgsql security definer set search_path='' as $$
declare e uuid;
begin
 -- Only the backend after authenticating and checking ownership may call this RPC.
 if not exists(select 1 from public.alerts where id=a and status not in ('spam','deleted')) then raise exception 'Alerta indisponível.'; end if;
 perform 1 from public.alerts where id=a for update;
 if (select count(*) from public.evidence where alert_id=a)>=3 then raise exception 'Máximo de 3 evidências por alerta.'; end if;
 insert into public.evidence(alert_id,path,kind,bytes,mime) values(a,p,k,b,m) returning id into e;
 perform private.recalculate(a); return e;
end $$;
create function public.evidence_upload_allowed(a uuid) returns boolean language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_active();
 return private.owns(a) and exists(select 1 from public.alerts where id=a and status='active' and created_at>now()-interval '15 minutes')
 and (select count(*) from public.evidence where alert_id=a)<3;
end $$;
revoke all on function public.register_evidence(uuid,text,text,int,text) from public,anon,authenticated;
grant execute on function public.register_evidence(uuid,text,text,int,text) to service_role;
revoke all on function public.evidence_upload_allowed(uuid) from public,anon;
grant execute on function public.evidence_upload_allowed(uuid) to authenticated;

create function public.notification_work() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'jobs',(select coalesce(jsonb_agg(j),'[]') from (select j.* from private.notification_jobs j where j.created_at>now()-interval '1 hour' order by j.id limit 100) j),
 'tokens',(select coalesce(jsonb_agg(t),'[]') from (select t.token,t.user_id from public.push_tokens t join public.profiles p on p.id=t.user_id where p.status='active') t),
 'preferences',(select coalesce(jsonb_agg(p),'[]') from public.notification_preferences p where enabled),
 'alerts',(select coalesce(jsonb_agg(a),'[]') from public.alerts a where created_at>now()-interval '25 hours' and expires_at>now())
 )
$$;
create function public.claim_delivery(j bigint,t text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 insert into private.notification_deliveries(job_id,token,state) values(j,t,'claimed') on conflict do nothing;
 return found;
end $$;
create function public.finish_delivery(j bigint,t text,s text,ticket_id text default null) returns void language sql security definer set search_path='' as $$
 update private.notification_deliveries set state=s,ticket=ticket_id where job_id=j and token=t
$$;
create function public.maintenance() returns void language plpgsql security definer set search_path='' as $$
declare a record;
begin
 for a in select id,status from public.alerts where expires_at<now() and status in ('active','confirmed','contested') for update loop
  update public.alerts set status='inactive',updated_at=now() where id=a.id;
  insert into public.status_history(alert_id,from_status,to_status,reason) values(a.id,a.status,'inactive','Prazo de revisão expirado.');
 end loop;
 for a in select id from public.alerts where status not in ('deleted','spam') loop perform private.recalculate(a.id); end loop;
 delete from private.notification_jobs where created_at<now()-interval '7 days';
 delete from public.push_tokens where updated_at<now()-interval '90 days';
end $$;
revoke all on function public.notification_work(),public.claim_delivery(bigint,text),public.finish_delivery(bigint,text,text,text),public.maintenance() from public,anon,authenticated;
grant execute on function public.notification_work(),public.claim_delivery(bigint,text),public.finish_delivery(bigint,text,text,text),public.maintenance() to service_role;
