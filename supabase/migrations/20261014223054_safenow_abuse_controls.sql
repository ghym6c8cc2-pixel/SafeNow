create or replace function public.evidence_upload_allowed(a uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform private.require_active();
 perform private.rate_limit('upload',10,3600);
 return private.owns(a) and exists(select 1 from public.alerts where id=a and status='active' and created_at>now()-interval '15 minutes')
 and (select count(*) from public.evidence where alert_id=a)<3;
end $$;
-- Atomic per-device delivery claim, bounded to 5/hour and at least 60s between notices.
create or replace function public.claim_delivery(j bigint,t text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(t,0));
 if (select count(*) from private.notification_deliveries where token=t and created_at>now()-interval '1 hour')>=5
 or exists(select 1 from private.notification_deliveries where token=t and created_at>now()-interval '60 seconds') then return false; end if;
 insert into private.notification_deliveries(job_id,token,state) values(j,t,'claimed') on conflict do nothing;
 return found;
end $$;
