-- Simplificação solicitada: apenas usuário comum e administrador.
-- Mantém identidade Auth, status, relatos, votos e preferências existentes.
with converted as (
  update public.profiles
  set role = 'user', updated_at = now()
  where role = 'collaborator'
  returning id
)
insert into public.audit_log(action, target_id, reason)
select 'migrate_collaborator_to_user', id,
  'Perfil de colaborador incorporado ao usuário comum; permissões comunitárias preservadas.'
from converted;

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('user', 'admin'));

create or replace function private.new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Cadastro público nunca escolhe papel, inclusive com metadados forjados.
  if coalesce((new.raw_user_meta_data->>'terms_accepted')::boolean, false) = false then
    raise exception 'Aceite dos termos obrigatório.';
  end if;
  insert into public.profiles(id, name, role, terms_accepted_at)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), 'Usuário'), 80),
    'user', now()
  );
  insert into public.notification_preferences(user_id) values (new.id);
  return new;
end $$;

-- Função chamada somente pelo trigger de Auth; nenhuma nova permissão de cliente.
revoke all on function private.new_user() from public, anon, authenticated;
