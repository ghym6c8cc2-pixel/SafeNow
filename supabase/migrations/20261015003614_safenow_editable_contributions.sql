-- Uma opinião atual por pessoa; avisos de resolução independentes.
create table private.resolution_reports (
  user_id uuid references auth.users(id) on delete set null,
  alert_id uuid not null references public.alerts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, alert_id)
);
create index resolution_reports_alert on private.resolution_reports(alert_id);
create table private.contribution_history (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  alert_id uuid not null references public.alerts(id) on delete cascade,
  scope text not null check(scope in ('opinion', 'resolution')),
  previous_value text, next_value text,
  created_at timestamptz not null default now()
);
create index contribution_history_alert on private.contribution_history(alert_id);
alter table private.resolution_reports enable row level security;
alter table private.contribution_history enable row level security;
revoke all on private.resolution_reports, private.contribution_history from public, anon, authenticated;
revoke all on sequence private.contribution_history_id_seq from public, anon, authenticated;

-- Preserva votos anteriores como histórico e separa as resoluções antigas.
insert into private.contribution_history(user_id, alert_id, scope, next_value, created_at)
select user_id, alert_id, case when kind='resolved' then 'resolution' else 'opinion' end,
  case when kind='resolved' then 'reported' else kind end, created_at from private.votes;
insert into private.resolution_reports(user_id, alert_id, created_at)
select user_id, alert_id, created_at from private.votes where kind='resolved';
delete from private.votes where kind='resolved';
alter table private.votes drop constraint votes_kind_check;
alter table private.votes add constraint votes_kind_check check(kind in ('confirm','contest','spam'));
alter table private.votes add column updated_at timestamptz not null default now();

create or replace function private.recalculate(a uuid)
returns void language plpgsql security definer set search_path='' as $$
declare c int; d int; s int; r int; e int; old text; next text; m boolean;
begin
  select status,moderated into old,m from public.alerts where id=a for update;
  if not found then return; end if;
  select count(*) filter(where kind='confirm'),count(*) filter(where kind='contest'),
    count(*) filter(where kind='spam') into c,d,s from private.votes where alert_id=a;
  select count(*) into r from private.resolution_reports where alert_id=a;
  select count(*) into e from public.evidence where alert_id=a;
  next:=old;
  if not m and old in ('active','under_review','contested','confirmed') then
    -- Recalcula também ao retirar/trocar opinião: consenso antigo não fica preso.
    next:=case when s>=3 then 'under_review' when d>=3 then 'contested'
      when c>=3 and c>d then 'confirmed' else 'active' end;
  end if;
  update public.alerts set confirmations=c,contests=d,spam_votes=s,resolved_votes=r,
    evidence_count=e,status=next,
    score=private.score(c,d,s,e,extract(epoch from(now()-occurred_at))/3600,m,next),updated_at=now()
  where id=a;
  if next<>old then
    insert into public.status_history(alert_id,from_status,to_status,reason)
    values(a,old,next,'Status recalculado após atualização das opiniões comunitárias.');
  end if;
end $$;

create function public.my_contribution(a uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=private.require_active();
begin
  if not private.can_view(a) then raise exception 'Alerta indisponível.' using errcode='42501'; end if;
  return jsonb_build_object(
    'opinion',(select kind from private.votes where user_id=u and alert_id=a),
    'resolution_reported',exists(select 1 from private.resolution_reports where user_id=u and alert_id=a)
  );
end $$;

create function public.report_resolution(a uuid, reported boolean)
returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_active(); s text; previous boolean;
begin
  select status into s from public.alerts where id=a for update;
  if not found or not private.can_view(a) or reported is null then
    raise exception 'Aviso de resolução não permitido.' using errcode='42501';
  end if;
  select exists(select 1 from private.resolution_reports where user_id=u and alert_id=a) into previous;
  if reported=previous then return; end if;
  if reported and s not in ('active','under_review','confirmed','contested') then
    raise exception 'Este alerta não recebe novos avisos de resolução.';
  end if;
  perform private.rate_limit('resolution',20,3600);
  if reported then
    insert into private.resolution_reports(user_id,alert_id) values(u,a);
  else
    delete from private.resolution_reports where user_id=u and alert_id=a;
  end if;
  insert into private.contribution_history(user_id,alert_id,scope,previous_value,next_value)
  values(u,a,'resolution',case when previous then 'reported' end,case when reported then 'reported' end);
  perform private.recalculate(a);
  insert into public.status_history(alert_id,from_status,to_status,reason)
  select a,status,status,case when reported
    then 'Resolução informada pela comunidade. Aguarda análise da moderação.'
    else 'Um aviso de resolução foi retirado. O status administrativo foi preservado.' end
  from public.alerts where id=a;
end $$;

create or replace function public.vote_alert(a uuid,k text)
returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_active(); s text; previous text;
begin
  -- Compatibilidade com clientes antigos: resolução nunca mais é uma opinião.
  if k='resolved' then perform public.report_resolution(a,true); return; end if;
  select status into s from public.alerts where id=a for update;
  if not found or not private.can_view(a) or private.owns(a) then
    raise exception 'Você não pode validar este alerta.' using errcode='42501';
  end if;
  if k is not null and k not in ('confirm','contest','spam') then raise exception 'Opinião inválida.'; end if;
  select kind into previous from private.votes where user_id=u and alert_id=a;
  if k is not distinct from previous then return; end if;
  if k is not null and s not in ('active','under_review','confirmed','contested') then
    raise exception 'Este alerta não recebe novas opiniões. Você pode retirar a anterior.';
  end if;
  perform private.rate_limit('vote',30,3600);
  if k is null then
    delete from private.votes where user_id=u and alert_id=a;
  else
    insert into private.votes(user_id,alert_id,kind) values(u,a,k)
    on conflict(user_id,alert_id) do update set kind=excluded.kind,updated_at=now();
  end if;
  insert into private.contribution_history(user_id,alert_id,scope,previous_value,next_value)
  values(u,a,'opinion',previous,k);
  perform private.recalculate(a);
end $$;

revoke all on function public.my_contribution(uuid),public.report_resolution(uuid,boolean) from public,anon;
grant execute on function public.my_contribution(uuid),public.report_resolution(uuid,boolean) to authenticated;
revoke all on function private.recalculate(uuid) from public,anon,authenticated;

-- Não mantém como decisão administrativa um encerramento automático antigo.
insert into public.status_history(alert_id,from_status,to_status,reason)
select id,'resolved','active','Resolução comunitária anterior encaminhada à análise administrativa.'
from public.alerts where status='resolved' and not moderated;
update public.alerts set status='active' where status='resolved' and not moderated;
do $$ declare a uuid; begin
  for a in select id from public.alerts loop perform private.recalculate(a); end loop;
end $$;
