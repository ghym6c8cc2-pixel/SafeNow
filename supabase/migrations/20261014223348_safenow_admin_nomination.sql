-- Only a trusted server operator can nominate the FIRST administrator.
-- A public signup cannot write this table; email ownership must be confirmed by Auth.
create table private.admin_nomination (
 email text primary key check(email=lower(trim(email)) and email like '%@%'),
 requested_at timestamptz not null default now(), completed_at timestamptz
);
create unique index one_pending_admin_nomination on private.admin_nomination((true)) where completed_at is null;
alter table private.admin_nomination enable row level security;
revoke all on private.admin_nomination from public,anon,authenticated;
grant all on private.admin_nomination to service_role;
create function private.promote_nominated_admin() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.email_confirmed_at is null then return new; end if;
 if tg_op='UPDATE' then if old.email_confirmed_at is not null then return new; end if; end if;
 perform pg_advisory_xact_lock(hashtext('safenow:first-admin'));
 if exists(select 1 from public.profiles where role='admin') then return new; end if;
 perform 1 from private.admin_nomination where email=lower(new.email) and completed_at is null for update;
 if not found then return new; end if;
 update public.profiles set role='admin',updated_at=now() where id=new.id and status='active';
 if not found then return new; end if;
 update private.admin_nomination set completed_at=now() where email=lower(new.email);
 insert into public.audit_log(action,target_id,reason) values('bootstrap_admin_verified',new.id,'Primeiro administrador nomeado no servidor; e-mail confirmado pelo Supabase Auth.');
 return new;
end $$;
revoke all on function private.promote_nominated_admin() from public,anon,authenticated;
create trigger safenow_bootstrap_verified after insert or update of email_confirmed_at on auth.users for each row execute function private.promote_nominated_admin();
