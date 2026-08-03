-- SISTEMA CAPEX SEGURO V4
-- Instalador idempotente: pode ser executado novamente sem erro de política duplicada.

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('admin','viewer');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null default '',
  role public.app_role not null default 'viewer',
  is_active boolean not null default true,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists full_name text not null default '';
alter table public.profiles add column if not exists role public.app_role not null default 'viewer';
alter table public.profiles add column if not exists is_active boolean not null default true;
alter table public.profiles add column if not exists must_change_password boolean not null default false;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
update public.profiles p set email = u.email from auth.users u where p.id=u.id and coalesce(p.email,'')='';
create unique index if not exists profiles_email_lower_uidx on public.profiles(lower(email)) where email is not null;

create table if not exists public.capex_items (
  id uuid primary key default gen_random_uuid(),
  categoria text not null check (categoria in ('obra','manutencao')),
  ordem text not null,
  nome text not null,
  inicio date,
  fim date,
  capex numeric(18,2) not null default 0 check (capex >= 0),
  tipologia text not null default 'Outros',
  contingenciada boolean not null default false,
  realizado jsonb not null default '{}'::jsonb check (jsonb_typeof(realizado)='object'),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.capex_items add column if not exists created_by uuid references auth.users(id);
alter table public.capex_items add column if not exists updated_by uuid references auth.users(id);
alter table public.capex_items add column if not exists deleted_at timestamptz;
alter table public.capex_items add column if not exists deleted_by uuid references auth.users(id);
create unique index if not exists capex_items_active_categoria_ordem_uidx on public.capex_items(categoria,ordem) where deleted_at is null;
create index if not exists capex_items_categoria_idx on public.capex_items(categoria) where deleted_at is null;

create table if not exists public.import_history (
  id bigint generated always as identity primary key,
  file_name text not null,
  file_size bigint,
  file_hash text,
  total_records integer not null default 0,
  created_records integer not null default 0,
  updated_records integer not null default 0,
  ignored_records integer not null default 0,
  status text not null default 'completed',
  error_message text,
  imported_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.import_history add column if not exists file_size bigint;
alter table public.import_history add column if not exists file_hash text;
alter table public.import_history add column if not exists ignored_records integer not null default 0;
alter table public.import_history add column if not exists status text not null default 'completed';
alter table public.import_history add column if not exists error_message text;

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id text,
  operation text not null,
  actor_id uuid,
  actor_email text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_log add column if not exists actor_email text;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_active_user()
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active);
$$;
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role='admin');
$$;
revoke all on function private.is_active_user() from public,anon;
revoke all on function private.is_admin() from public,anon;
grant execute on function private.is_active_user() to authenticated;
grant execute on function private.is_admin() to authenticated;

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,email,full_name,role,is_active,must_change_password)
  values(new.id,coalesce(new.email,''),coalesce(new.raw_user_meta_data->>'full_name',''),
    case when new.raw_app_meta_data->>'app_role'='admin' then 'admin'::public.app_role else 'viewer'::public.app_role end,
    true,coalesce((new.raw_app_meta_data->>'must_change_password')::boolean,false))
  on conflict(id) do update set email=excluded.email, updated_at=now();
  return new;
end;$$;
revoke all on function private.handle_new_user() from public,anon,authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert or update of email on auth.users for each row execute function private.handle_new_user();

insert into public.profiles(id,email,full_name,role,is_active)
select u.id,coalesce(u.email,''),coalesce(u.raw_user_meta_data->>'full_name',''),'viewer',true from auth.users u
on conflict(id) do update set email=excluded.email;

create or replace function private.set_updated_at()
returns trigger language plpgsql security invoker set search_path='' as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function private.set_updated_at();
drop trigger if exists capex_items_updated_at on public.capex_items;
create trigger capex_items_updated_at before update on public.capex_items for each row execute function private.set_updated_at();

create or replace function private.audit_capex_changes()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_email text; v_id text;
begin
  select email into v_email from public.profiles where id=(select auth.uid());
  if tg_op='DELETE' then v_id=old.id::text; else v_id=new.id::text; end if;
  insert into public.audit_log(table_name,record_id,operation,actor_id,actor_email,old_data,new_data)
  values(tg_table_name,v_id,tg_op,(select auth.uid()),v_email,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end);
  if tg_op='DELETE' then return old; else return new; end if;
end;$$;
revoke all on function private.audit_capex_changes() from public,anon,authenticated;
drop trigger if exists capex_items_audit on public.capex_items;
create trigger capex_items_audit after insert or update or delete on public.capex_items for each row execute function private.audit_capex_changes();

alter table public.profiles enable row level security;
alter table public.capex_items enable row level security;
alter table public.import_history enable row level security;
alter table public.audit_log enable row level security;

-- Remove TODAS as políticas atuais das quatro tabelas antes de recriar.
do $$ declare r record; begin
  for r in select schemaname,tablename,policyname from pg_policies
           where schemaname='public' and tablename in ('profiles','capex_items','import_history','audit_log')
  loop execute format('drop policy if exists %I on %I.%I',r.policyname,r.schemaname,r.tablename); end loop;
end $$;

create policy profiles_select on public.profiles for select to authenticated
using ((select private.is_active_user()) and ((select auth.uid())=id or (select private.is_admin())));
create policy items_select on public.capex_items for select to authenticated
using ((select private.is_active_user()) and deleted_at is null);
create policy items_insert on public.capex_items for insert to authenticated
with check ((select private.is_admin()) and created_by=(select auth.uid()) and updated_by=(select auth.uid()) and deleted_at is null);
create policy items_update on public.capex_items for update to authenticated
using ((select private.is_admin()) and deleted_at is null)
with check ((select private.is_admin()) and updated_by=(select auth.uid()));
create policy history_select on public.import_history for select to authenticated
using ((select private.is_active_user()));
create policy history_insert on public.import_history for insert to authenticated
with check ((select private.is_admin()) and imported_by=(select auth.uid()));
create policy audit_select on public.audit_log for select to authenticated
using ((select private.is_admin()));

revoke all on public.profiles,public.capex_items,public.import_history,public.audit_log from anon;
grant select on public.profiles,public.capex_items,public.import_history to authenticated;
grant insert,update on public.capex_items to authenticated;
grant insert on public.import_history to authenticated;
grant select on public.audit_log to authenticated;
grant usage,select on all sequences in schema public to authenticated;

create or replace function public.bootstrap_first_admin(admin_email text)
returns text language plpgsql security definer set search_path='' as $$
declare uid uuid;
begin
  select id into uid from auth.users where lower(email)=lower(trim(admin_email));
  if uid is null then raise exception 'Usuário não encontrado em Authentication: %',admin_email; end if;
  update public.profiles set role='admin',is_active=true,email=lower(trim(admin_email)),full_name=case when full_name='' then 'Administrador' else full_name end where id=uid;
  update auth.users set raw_app_meta_data=coalesce(raw_app_meta_data,'{}'::jsonb)||jsonb_build_object('app_role','admin') where id=uid;
  return 'ADMIN CONFIGURADO: '||admin_email;
end;$$;
revoke all on function public.bootstrap_first_admin(text) from public,anon,authenticated;

select 'INSTALAÇÃO V4 CONCLUÍDA' as resultado;
