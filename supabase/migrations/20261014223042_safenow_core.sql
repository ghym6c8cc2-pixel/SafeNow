-- SafeNow: owner identity and precise GPS NEVER enter public alerts or Realtime.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null check(char_length(name) between 2 and 80),
 role text not null default 'user' check(role in ('user','collaborator','admin')),
 status text not null default 'active' check(status in ('active','suspended','deletion_requested')),
 anonymous_default boolean not null default true,
 terms_accepted_at timestamptz not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.categories (
 id text primary key, name text not null, description text not null default '',
 default_risk int not null check(default_risk between 1 and 4), icon text not null, active boolean not null default true
);
create table public.alerts (
 id uuid primary key default gen_random_uuid(), title text not null check(char_length(title) between 4 and 100),
 description text not null check(char_length(description) between 8 and 2000),
 category_id text not null references public.categories(id),
 latitude double precision not null check(latitude between -90 and 90),
 longitude double precision not null check(longitude between -180 and 180),
 region text not null default '' check(char_length(region)<=120), risk int not null check(risk between 1 and 4),
 status text not null default 'active' check(status in ('active','under_review','confirmed','contested','resolved','inactive','spam','deleted')),
 score int not null default 40 check(score between 0 and 100), anonymous boolean not null default true,
 public_author_name text, occurred_at timestamptz not null, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '24 hours',
 evidence_count int not null default 0, confirmations int not null default 0, contests int not null default 0,
 spam_votes int not null default 0, resolved_votes int not null default 0, moderated boolean not null default false,
 check(not anonymous or public_author_name is null)
);
create table private.alert_owners (
 alert_id uuid primary key references public.alerts(id) on delete cascade,
 user_id uuid references auth.users(id) on delete set null,
 latitude double precision not null, longitude double precision not null,
 accuracy double precision check(accuracy between 0 and 100000), captured_at timestamptz not null
);
create table public.evidence (
 id uuid primary key default gen_random_uuid(), alert_id uuid not null references public.alerts(id) on delete cascade,
 kind text not null check(kind in ('image','video')), path text not null unique,
 anonymized boolean not null default true check(anonymized),
 bytes int not null check(bytes between 1 and 20971520), mime text not null check(mime in ('image/jpeg','image/png','video/mp4')),
 created_at timestamptz not null default now()
);
create table private.votes (
 user_id uuid references auth.users(id) on delete set null, alert_id uuid not null references public.alerts(id) on delete cascade,
 kind text not null check(kind in ('confirm','contest','resolved','spam')), created_at timestamptz not null default now(),
 unique(user_id,alert_id)
);
create table public.comments (
 id uuid primary key default gen_random_uuid(), alert_id uuid not null references public.alerts(id) on delete cascade,
 body text not null check(char_length(body) between 2 and 500), created_at timestamptz not null default now()
);
create table private.comment_owners (comment_id uuid primary key references public.comments(id) on delete cascade, user_id uuid references auth.users(id) on delete set null);
create table public.status_history (
 id uuid primary key default gen_random_uuid(), alert_id uuid not null references public.alerts(id) on delete cascade,
 from_status text, to_status text not null, reason text not null, created_at timestamptz not null default now()
);
create table public.notification_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade, enabled boolean not null default false,
 radius_m int not null default 3000 check(radius_m between 100 and 20000), categories text[] not null default '{}',
 sound boolean not null default true, latitude double precision check(latitude between -90 and 90),
 longitude double precision check(longitude between -180 and 180), zone_name text not null default '' check(char_length(zone_name)<=80),
 quiet_start int check(quiet_start between 0 and 23), quiet_end int check(quiet_end between 0 and 23),
 timezone text not null default 'America/Sao_Paulo', updated_at timestamptz not null default now(),
 check((quiet_start is null)=(quiet_end is null)), check((latitude is null)=(longitude is null))
);
create table public.push_tokens (
 token text primary key check(token ~ '^ExponentPushToken\[[A-Za-z0-9_-]+\]$|^ExpoPushToken\[[A-Za-z0-9_-]+\]$'),
 user_id uuid not null references auth.users(id) on delete cascade,
 updated_at timestamptz not null default now()
);
create table public.safe_places (
 id uuid primary key default gen_random_uuid(), name text not null, description text not null,
 latitude double precision not null check(latitude between -90 and 90), longitude double precision not null check(longitude between -180 and 180),
 verified_at timestamptz, active boolean not null default true
);
create table public.audit_log (
 id bigint generated always as identity primary key, actor_id uuid references auth.users(id) on delete set null,
 action text not null, target_id uuid, reason text not null, created_at timestamptz not null default now()
);
create table private.rate_limits (user_id uuid not null references auth.users(id) on delete cascade, action text not null, window_start timestamptz not null, hits int not null, primary key(user_id,action));
create table private.notification_jobs (
 id bigint generated always as identity primary key, alert_id uuid not null references public.alerts(id) on delete cascade,
 kind text not null, created_at timestamptz not null default now(), unique(alert_id,kind)
);
create table private.notification_deliveries (
 job_id bigint not null references private.notification_jobs(id) on delete cascade, token text not null,
 state text not null check(state in ('claimed','sent','failed','unknown')), ticket text, created_at timestamptz not null default now(),
 primary key(job_id,token)
);
create index alerts_nearby on public.alerts(status,created_at desc);
create index alerts_category on public.alerts(category_id);
create index owners_user on private.alert_owners(user_id);
create index comments_alert on public.comments(alert_id,created_at);
create index history_alert on public.status_history(alert_id,created_at);
create index votes_alert on private.votes(alert_id);

create function private.is_active() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and status='active')
$$;
create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and status='active' and role='admin')
$$;
create function private.owns(a uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.alert_owners where alert_id=a and user_id=auth.uid())
$$;
create function private.can_view(a uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_active() and exists(select 1 from public.alerts where id=a and
 (status not in ('deleted','spam') or private.owns(a) or private.is_admin()))
$$;
create function private.require_active() returns uuid language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_active() then raise exception 'Acesso negado. Entre novamente ou verifique sua conta.' using errcode='42501'; end if;
 return auth.uid();
end $$;
create function private.require_admin() returns uuid language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Acesso administrativo negado.' using errcode='42501'; end if;
 return auth.uid();
end $$;
create function private.rate_limit(a text, max_hits int, seconds int) returns void language plpgsql security definer set search_path='' as $$
declare n int; u uuid:=private.require_active();
begin
 insert into private.rate_limits values(u,a,now(),1) on conflict(user_id,action) do update
 set hits=case when private.rate_limits.window_start < now()-make_interval(secs=>seconds) then 1 else private.rate_limits.hits+1 end,
 window_start=case when private.rate_limits.window_start < now()-make_interval(secs=>seconds) then now() else private.rate_limits.window_start end returning hits into n;
 if n>max_hits then raise exception 'Limite temporário atingido. Aguarde para tentar novamente.'; end if;
end $$;
create function private.new_user() returns trigger language plpgsql security definer set search_path='' as $$
declare r text:=coalesce(new.raw_user_meta_data->>'signup_role','user');
begin
 -- Never accept admin, role or status from user-controlled metadata.
 if r not in ('user','collaborator') then r:='user'; end if;
 if coalesce((new.raw_user_meta_data->>'terms_accepted')::boolean,false)=false then raise exception 'Aceite dos termos obrigatório.'; end if;
 insert into public.profiles(id,name,role,terms_accepted_at) values(new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'name'),''),'Usuário'),80),r,now());
 insert into public.notification_preferences(user_id) values(new.id);
 return new;
end $$;
create trigger create_profile after insert on auth.users for each row execute function private.new_user();

create function private.transition_allowed(f text,t text) returns boolean language sql immutable set search_path='' as $$
 select case f
 when 'active' then t=any(array['under_review','confirmed','contested','resolved','inactive','spam','deleted'])
 when 'under_review' then t=any(array['active','confirmed','contested','resolved','spam','deleted'])
 when 'confirmed' then t=any(array['under_review','contested','resolved','inactive','spam','deleted'])
 when 'contested' then t=any(array['under_review','confirmed','resolved','inactive','spam','deleted'])
 when 'resolved' then t=any(array['under_review','deleted']) when 'inactive' then t=any(array['under_review','deleted'])
 when 'spam' then t=any(array['under_review','deleted']) else false end
$$;
create function private.score(c int,d int,s int,e int,age_hours numeric,moderated boolean,status text) returns int language sql immutable set search_path='' as $$
 select case when status in ('spam','deleted') then 0 when moderated and status='confirmed' then 95
 else greatest(0,least(90,round(40+least(c,10)*7-least(d,10)*9-least(s,10)*12+least(e,2)*5-least(24,floor(greatest(0,age_hours)/6))*2)::int)) end
$$;
create function private.recalculate(a uuid) returns void language plpgsql security definer set search_path='' as $$
declare c int; d int; s int; r int; e int; old text; next text; m boolean;
begin
 select status,moderated into old,m from public.alerts where id=a for update;
 select count(*) filter(where kind='confirm'),count(*) filter(where kind='contest'),count(*) filter(where kind='spam'),count(*) filter(where kind='resolved') into c,d,s,r from private.votes where alert_id=a;
 select count(*) into e from public.evidence where alert_id=a;
 next:=old;
 if not m and old in ('active','under_review','contested','confirmed') then
  if s>=3 then next:='under_review'; elsif r>=3 then next:='resolved'; elsif d>=3 then next:='contested'; elsif c>=3 and c>d then next:='confirmed'; end if;
 end if;
 update public.alerts set confirmations=c,contests=d,spam_votes=s,resolved_votes=r,evidence_count=e,status=next,
 score=private.score(c,d,s,e,extract(epoch from(now()-occurred_at))/3600,moderated,next),updated_at=now() where id=a;
 if next<>old then insert into public.status_history(alert_id,from_status,to_status,reason) values(a,old,next,'Atualização por contribuições comunitárias.'); end if;
end $$;
create function private.queue_notification() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' or (new.status='confirmed' and old.status<>'confirmed') then
  insert into private.notification_jobs(alert_id,kind) values(new.id,case when new.status='confirmed' then 'confirmed' else 'new' end) on conflict do nothing;
 end if; return new;
end $$;
create trigger notification_queue after insert or update of status on public.alerts for each row execute function private.queue_notification();

create function public.create_alert(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_active(); a uuid:=gen_random_uuid(); lat double precision; lon double precision; anon boolean;
begin
 perform private.rate_limit('report',5,3600);
 lat:=(p->'location'->>'latitude')::double precision; lon:=(p->'location'->>'longitude')::double precision;
 if lat is null or lon is null or not(lat between -90 and 90) or not(lon between -180 and 180) then raise exception 'Localização inválida.'; end if;
 if (p->'location'->>'captured_at')::timestamptz < now()-interval '30 minutes' or (p->'location'->>'captured_at')::timestamptz > now()+interval '5 minutes' then raise exception 'Atualize a localização.'; end if;
 if (p->>'occurred_at')::timestamptz>now()+interval '5 minutes' then raise exception 'Data inválida.'; end if;
 if not exists(select 1 from public.categories where id=p->>'category_id' and active) then raise exception 'Categoria indisponível.'; end if;
 anon:=coalesce((p->>'anonymous')::boolean,true);
 insert into public.alerts(id,title,description,category_id,latitude,longitude,region,risk,anonymous,public_author_name,occurred_at)
 values(a,trim(p->>'title'),trim(p->>'description'),p->>'category_id',round(lat::numeric,3),round(lon::numeric,3),coalesce(p->>'region',''),(p->>'risk')::int,anon,
 case when anon then null else (select name from public.profiles where id=u) end,(p->>'occurred_at')::timestamptz);
 insert into private.alert_owners values(a,u,lat,lon,(p->'location'->>'accuracy')::double precision,(p->'location'->>'captured_at')::timestamptz);
 insert into public.status_history(alert_id,to_status,reason) values(a,'active','Relato publicado. Informação comunitária ainda não verificada.');
 return a;
end $$;
create function public.my_alert_ids() returns setof uuid language plpgsql stable security definer set search_path='' as $$
begin perform private.require_active(); return query select alert_id from private.alert_owners where user_id=auth.uid(); end $$;
create function public.edit_alert(a uuid,p_title text,p_description text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_active(); perform private.rate_limit('edit',10,3600);
 perform 1 from public.alerts where id=a and status='active' and created_at>now()-interval '15 minutes' for update;
 if not found or not private.owns(a) then raise exception 'Correção permitida apenas ao autor, nos primeiros 15 minutos de um alerta ativo.'; end if;
 update public.alerts set title=trim(p_title),description=trim(p_description),updated_at=now() where id=a;
 insert into public.status_history(alert_id,from_status,to_status,reason) values(a,'active','active','Texto corrigido pelo autor.');
end $$;
create function public.delete_alert(a uuid) returns void language plpgsql security definer set search_path='' as $$
declare s text;
begin
 perform private.require_active(); select status into s from public.alerts where id=a for update;
 if not private.owns(a) or s='deleted' then raise exception 'Exclusão não permitida.'; end if;
 update public.alerts set status='deleted',score=0,public_author_name=null,updated_at=now() where id=a;
 insert into public.status_history(alert_id,from_status,to_status,reason) values(a,s,'deleted','Removido pelo autor.');
end $$;
create function public.vote_alert(a uuid,k text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_active(); s text;
begin
 perform private.rate_limit('vote',30,3600);
 select status into s from public.alerts where id=a for update;
 if not private.can_view(a) or private.owns(a) or s not in ('active','under_review','confirmed','contested') then raise exception 'Você não pode validar este alerta.'; end if;
 if exists(select 1 from private.votes where alert_id=a and user_id=u) then raise exception 'Você já contribuiu neste alerta.' using errcode='23505'; end if;
 insert into private.votes(user_id,alert_id,kind) values(u,a,k);
 perform private.recalculate(a);
end $$;
create function public.comment_alert(a uuid,b text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_active(); c uuid;
begin
 perform private.rate_limit('comment',10,3600);
 if not private.can_view(a) or exists(select 1 from public.alerts where id=a and status in ('deleted','spam')) then raise exception 'Comentário não permitido.'; end if;
 insert into public.comments(alert_id,body) values(a,trim(b)) returning id into c;
 insert into private.comment_owners values(c,u);
end $$;
create function public.moderate_alert(a uuid,s text,r text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_admin(); prev text;
begin
 if char_length(trim(r)) not between 8 and 500 then raise exception 'Informe um motivo de 8 a 500 caracteres.'; end if;
 select status into prev from public.alerts where id=a for update;
 if not private.transition_allowed(prev,s) then raise exception 'Transição de status não permitida.'; end if;
 update public.alerts set status=s,moderated=true,updated_at=now() where id=a;
 perform private.recalculate(a);
 -- Public history excludes free-form moderation reason, which may contain PII.
 insert into public.status_history(alert_id,from_status,to_status,reason) values(a,prev,s,'Status atualizado pela moderação.');
 insert into public.audit_log(actor_id,action,target_id,reason) values(u,'moderate_alert:'||s,a,trim(r));
end $$;
create function public.manage_user(u uuid,s text,r text) returns void language plpgsql security definer set search_path='' as $$
declare admin_id uuid:=private.require_admin();
begin
 if u=admin_id or s not in ('active','suspended') or char_length(trim(r)) not between 8 and 500 then raise exception 'Ação ou motivo inválido.'; end if;
 perform 1 from public.profiles where id=u and role<>'admin' for update;
 if not found then raise exception 'Conta indisponível para esta ação.'; end if;
 update public.profiles set status=s,updated_at=now() where id=u;
 insert into public.audit_log(actor_id,action,target_id,reason) values(admin_id,'account:'||s,u,trim(r));
end $$;
create function public.update_profile(n text,a boolean) returns void language plpgsql security definer set search_path='' as $$
begin perform private.require_active(); update public.profiles set name=trim(n),anonymous_default=a,updated_at=now() where id=auth.uid(); end $$;
create function public.request_account_deletion() returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_active();
begin
 if private.is_admin() then raise exception 'Transfira a administração antes de solicitar a exclusão pelo procedimento do servidor.'; end if;
 update public.profiles set status='deletion_requested',updated_at=now() where id=u;
 delete from public.push_tokens where user_id=u;
 delete from public.notification_preferences where user_id=u;
 update public.alerts set public_author_name=null,anonymous=true where id in(select alert_id from private.alert_owners where user_id=u);
 insert into public.audit_log(actor_id,action,target_id,reason) values(u,'deletion_requested',u,'Solicitação do titular; processamento em até 30 dias.');
end $$;

-- Least privilege: no direct mutations of reports, votes, evidence, roles or history.
revoke all on all tables in schema public from anon,authenticated;
revoke all on all tables in schema private from public,anon,authenticated;
revoke all on all sequences in schema public from anon,authenticated;
revoke all on all functions in schema public from public,anon,authenticated;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.is_active(),private.is_admin(),private.owns(uuid),private.can_view(uuid) to authenticated;
grant execute on function public.create_alert(jsonb),public.my_alert_ids(),public.edit_alert(uuid,text,text),public.delete_alert(uuid),public.vote_alert(uuid,text),public.comment_alert(uuid,text),public.moderate_alert(uuid,text,text),public.manage_user(uuid,text,text),public.update_profile(text,boolean),public.request_account_deletion() to authenticated;
grant select on public.profiles,public.categories,public.alerts,public.evidence,public.comments,public.status_history,public.safe_places,public.audit_log to authenticated;
grant select,insert,update,delete on public.notification_preferences,public.push_tokens to authenticated;
grant all on all tables in schema public,private to service_role;
grant all on all sequences in schema public,private to service_role;
grant execute on all functions in schema public,private to service_role;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.alerts enable row level security;
alter table public.evidence enable row level security;
alter table public.comments enable row level security;
alter table public.status_history enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_tokens enable row level security;
alter table public.safe_places enable row level security;
alter table public.audit_log enable row level security;
create policy own_profile on public.profiles for select to authenticated using(id=auth.uid() or private.is_admin());
create policy categories_read on public.categories for select to authenticated using(private.is_active() and active);
create policy alerts_read on public.alerts for select to authenticated using(private.is_active() and (status not in ('deleted','spam') or private.owns(id) or private.is_admin()));
create policy evidence_read on public.evidence for select to authenticated using(private.can_view(alert_id));
create policy comments_read on public.comments for select to authenticated using(private.can_view(alert_id));
create policy history_read on public.status_history for select to authenticated using(private.can_view(alert_id));
create policy preferences_own on public.notification_preferences for all to authenticated using(user_id=auth.uid() and private.is_active()) with check(user_id=auth.uid() and private.is_active());
create policy tokens_own on public.push_tokens for all to authenticated using(user_id=auth.uid() and private.is_active()) with check(user_id=auth.uid() and private.is_active());
create policy places_read on public.safe_places for select to authenticated using(active and private.is_active());
create policy audit_admin on public.audit_log for select to authenticated using(private.is_admin());
-- Defense in depth even on non-exposed schema.
alter table private.alert_owners enable row level security;
alter table private.votes enable row level security;
alter table private.comment_owners enable row level security;
alter table private.rate_limits enable row level security;
alter table private.notification_jobs enable row level security;
alter table private.notification_deliveries enable row level security;
