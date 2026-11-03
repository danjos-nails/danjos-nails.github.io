-- =====================================================================
-- D’Anjos Nails — banco de dados (Supabase / Postgres)
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em Run.
-- Depois rode seed.sql (serviços iniciais) e o passo do admin no LEIA-ME.
--
-- Segurança:
--  • RLS ligado em todas as tabelas.
--  • Visitantes (anon) só leem serviços ativos e configurações públicas.
--  • Visitantes agendam, consultam, cancelam e remarcam APENAS por funções
--    que validam tudo no servidor e nunca devolvem dados de outras clientes.
--  • Só usuárias cadastradas em private.admins acessam agenda e clientes.
--  • Horários sobrepostos são impedidos pelo próprio banco (exclusion constraint).
-- =====================================================================

create schema if not exists private;
revoke all on schema private from public;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
do $$ begin
  create type public.status_agendamento as enum ('pendente', 'confirmado', 'concluido', 'cancelado', 'faltou');
exception when duplicate_object then null; end $$;

-- valida o formato dos horários de atendimento
create or replace function private.hours_ok(p jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare k int; v jsonb;
begin
  if jsonb_typeof(p) <> 'object' then return false; end if;
  for k in 0..6 loop
    v := p -> k::text;
    continue when v is null or jsonb_typeof(v) = 'null';
    if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) <> 2 then return false; end if;
    if (v ->> 0) !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or (v ->> 1) !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then return false; end if;
    if (v ->> 0) >= (v ->> 1) then return false; end if;
  end loop;
  return true;
end $$;

-- ---------------------------------------------------------------------
-- Configurações (linha única)
-- hours: { "0": null, "1": ["09:00","19:00"], ... }  0 = domingo
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  id                smallint primary key default 1 check (id = 1),
  timezone          text not null default 'America/Sao_Paulo',
  hours             jsonb not null default '{"0":null,"1":["09:00","19:00"],"2":["09:00","19:00"],"3":["09:00","19:00"],"4":["09:00","19:00"],"5":["09:00","19:00"],"6":["08:00","16:00"]}',
  buffer_min        int not null default 40   check (buffer_min between 0 and 240),
  step_min          int not null default 30   check (step_min in (15, 20, 30, 45, 60)),
  min_notice_min    int not null default 120  check (min_notice_min between 0 and 10080),
  days_ahead        int not null default 21   check (days_ahead between 1 and 120),
  cancel_notice_min int not null default 1440 check (cancel_notice_min between 0 and 10080),
  updated_at        timestamptz not null default now(),
  constraint hours_formato check (private.hours_ok(hours))
);

-- ---------------------------------------------------------------------
-- Serviços
-- ---------------------------------------------------------------------
create table if not exists public.services (
  id           text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  name         text not null check (char_length(name) between 2 and 80),
  summary      text not null default '' check (char_length(summary) <= 600),
  benefits     text[] not null default '{}' check (cardinality(benefits) <= 8),
  care         text[] not null default '{}' check (cardinality(care) <= 8),
  maintenance  text check (char_length(maintenance) <= 400),
  duration_min int not null check (duration_min between 10 and 480),
  price_cents  int check (price_cents between 0 and 10000000),
  category     text not null default 'maos' check (category in ('maos', 'pes', 'extra')),
  is_addon     boolean not null default false,
  active       boolean not null default true,
  sort         int not null default 0,
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Bloqueios, folgas e feriados
-- ---------------------------------------------------------------------
create table if not exists public.time_off (
  id         bigint generated always as identity primary key,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  reason     text check (char_length(reason) <= 120),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists time_off_range_idx on public.time_off using gist (tstzrange(starts_at, ends_at));

-- ---------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------
create table if not exists public.clients (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 2 and 80),
  phone      text not null unique check (phone ~ '^55[0-9]{10,11}$'),
  notes      text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Agendamentos
-- block_until = fim + tempo de deslocamento. Dois agendamentos ativos
-- nunca podem ter [starts_at, block_until) sobrepostos.
-- ---------------------------------------------------------------------
create table if not exists public.appointments (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients (id) on delete restrict,
  service_ids   text[] not null check (cardinality(service_ids) between 1 and 6),
  service_names text not null,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  block_until   timestamptz not null,
  status        public.status_agendamento not null default 'pendente',
  price_cents   int,
  address       jsonb not null default '{}',
  notes         text check (char_length(notes) <= 500),
  manage_token  uuid not null unique default gen_random_uuid(),
  confirmed_at  timestamptz,
  cancelled_at  timestamptz,
  cancelled_by  text check (cancelled_by in ('cliente', 'profissional')),
  reminded_at   timestamptz,
  created_at    timestamptz not null default now(),
  check (ends_at > starts_at and block_until >= ends_at),
  constraint sem_sobreposicao exclude using gist (tstzrange(starts_at, block_until) with &&)
    where (status in ('pendente', 'confirmado'))
);
create index if not exists appointments_client_idx on public.appointments (client_id);
create index if not exists appointments_starts_idx on public.appointments (starts_at);

-- ---------------------------------------------------------------------
-- Administradoras (schema privado, fora da API)
-- ---------------------------------------------------------------------
create table if not exists private.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.admins where user_id = (select auth.uid()));
$$;
revoke all on function private.is_admin() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.settings     enable row level security;
alter table public.services     enable row level security;
alter table public.time_off     enable row level security;
alter table public.clients      enable row level security;
alter table public.appointments enable row level security;
alter table private.admins      enable row level security;

drop policy if exists settings_leitura on public.settings;
create policy settings_leitura on public.settings for select to anon, authenticated using (true);
drop policy if exists settings_admin on public.settings;
create policy settings_admin on public.settings for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

drop policy if exists services_leitura on public.services;
create policy services_leitura on public.services for select to anon using (active);
drop policy if exists services_leitura_logada on public.services;
create policy services_leitura_logada on public.services for select to authenticated
  using (active or (select private.is_admin()));
drop policy if exists services_admin_ins on public.services;
create policy services_admin_ins on public.services for insert to authenticated with check ((select private.is_admin()));
drop policy if exists services_admin_upd on public.services;
create policy services_admin_upd on public.services for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists services_admin_del on public.services;
create policy services_admin_del on public.services for delete to authenticated using ((select private.is_admin()));

drop policy if exists time_off_admin on public.time_off;
create policy time_off_admin on public.time_off for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists clients_admin on public.clients;
create policy clients_admin on public.clients for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists appointments_admin on public.appointments;
create policy appointments_admin on public.appointments for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
-- private.admins: sem políticas = ninguém acessa pela API.

-- ---------------------------------------------------------------------
-- Permissões explícitas (o Supabase não expõe tabelas novas sozinho)
-- ---------------------------------------------------------------------
revoke all on public.settings, public.services, public.time_off, public.clients, public.appointments from anon, authenticated;
grant select on public.settings, public.services to anon, authenticated;
grant update (hours, buffer_min, step_min, min_notice_min, days_ahead, cancel_notice_min, timezone, updated_at) on public.settings to authenticated;
grant insert, update, delete on public.services to authenticated;
grant select, insert, update, delete on public.time_off, public.clients, public.appointments to authenticated;
grant select, insert, update, delete on public.settings, public.services, public.time_off, public.clients, public.appointments to service_role;

-- =====================================================================
-- Regras de agenda (privadas)
-- =====================================================================
create or replace function private.hm(p text)
returns int language sql immutable set search_path = '' as $$
  select split_part(p, ':', 1)::int * 60 + split_part(p, ':', 2)::int;
$$;

-- duração total dos serviços; valida a lista
create or replace function private.duration_of(p_ids text[])
returns int language plpgsql stable security definer set search_path = '' as $$
declare v_qtd int; v_min int; v_base int;
begin
  if p_ids is null or cardinality(p_ids) = 0 or cardinality(p_ids) > 6 then raise exception 'SERVICO_INVALIDO'; end if;
  select count(*), sum(duration_min), count(*) filter (where not is_addon)
    into v_qtd, v_min, v_base
    from public.services where id = any (p_ids) and active;
  if v_qtd <> (select count(distinct x) from unnest(p_ids) x) then raise exception 'SERVICO_INVALIDO'; end if;
  if v_base = 0 then raise exception 'SO_ADICIONAL'; end if;
  return v_min;
end $$;

-- devolve null se o horário estiver livre, ou o motivo
create or replace function private.check_slot(p_start timestamptz, p_minutes int, p_ignore uuid default null)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  s public.settings; v_local timestamp; v_h jsonb; v_open int; v_close int; v_ini int; v_end timestamptz; v_block timestamptz;
begin
  select * into s from public.settings where id = 1;
  v_local := p_start at time zone s.timezone;
  v_h := s.hours -> extract(dow from v_local)::int::text;
  if v_h is null or jsonb_typeof(v_h) <> 'array' then return 'FECHADO'; end if;
  v_open := private.hm(v_h ->> 0); v_close := private.hm(v_h ->> 1);
  if extract(second from v_local) <> 0 then return 'HORARIO_INVALIDO'; end if;
  v_ini := extract(hour from v_local)::int * 60 + extract(minute from v_local)::int;
  if v_ini < v_open or v_ini + p_minutes > v_close then return 'FORA_DO_EXPEDIENTE'; end if;
  if (v_ini - v_open) % s.step_min <> 0 then return 'HORARIO_INVALIDO'; end if;
  if p_start < now() + make_interval(mins => s.min_notice_min) then return 'ANTECEDENCIA'; end if;
  if v_local::date > (now() at time zone s.timezone)::date + s.days_ahead then return 'MUITO_DISTANTE'; end if;
  v_end := p_start + make_interval(mins => p_minutes);
  v_block := v_end + make_interval(mins => s.buffer_min);
  if exists (select 1 from public.time_off t where tstzrange(t.starts_at, t.ends_at) && tstzrange(p_start, v_end)) then return 'BLOQUEADO'; end if;
  if exists (select 1 from public.appointments a
             where a.status in ('pendente', 'confirmado') and (p_ignore is null or a.id <> p_ignore)
               and tstzrange(a.starts_at, a.block_until) && tstzrange(p_start, v_block)) then return 'OCUPADO'; end if;
  return null;
end $$;

create or replace function private.clean(p text, p_max int)
returns text language sql immutable set search_path = '' as $$
  select nullif(left(btrim(regexp_replace(coalesce(p, ''), '[\x00-\x1F\x7F]', ' ', 'g')), p_max), '');
$$;

revoke all on function private.hm(text), private.duration_of(text[]), private.check_slot(timestamptz, int, uuid), private.clean(text, int) from public;

-- =====================================================================
-- Funções públicas (chamadas pelo site)
-- =====================================================================

-- Horários livres para uma combinação de serviços.
create or replace function public.available_slots(p_service_ids text[], p_from date default null, p_to date default null, p_token uuid default null)
returns table (slot timestamptz) language plpgsql stable security definer set search_path = '' as $$
declare s public.settings; v_min int; v_ignore uuid; v_today date; d date; v_h jsonb; t int; v_open int; v_close int; v_c timestamptz;
begin
  select * into s from public.settings where id = 1;
  v_min := private.duration_of(p_service_ids);
  if p_token is not null then select a.id into v_ignore from public.appointments a where a.manage_token = p_token; end if;
  v_today := (now() at time zone s.timezone)::date;
  p_from := greatest(coalesce(p_from, v_today), v_today);
  p_to := least(coalesce(p_to, v_today + s.days_ahead), v_today + s.days_ahead, p_from + 62);
  for d in select generate_series(p_from, p_to, interval '1 day')::date loop
    v_h := s.hours -> extract(dow from d)::int::text;
    continue when v_h is null or jsonb_typeof(v_h) <> 'array';
    v_open := private.hm(v_h ->> 0); v_close := private.hm(v_h ->> 1);
    t := v_open;
    while t + v_min <= v_close loop
      v_c := (d + make_interval(mins => t)) at time zone s.timezone;
      if private.check_slot(v_c, v_min, v_ignore) is null then slot := v_c; return next; end if;
      t := t + s.step_min;
    end loop;
  end loop;
end $$;

-- Cria a solicitação de agendamento. Devolve o código para a cliente gerenciar.
create or replace function public.book_appointment(
  p_service_ids text[], p_start timestamptz, p_name text, p_phone text, p_address jsonb, p_notes text default null)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.settings; v_min int; v_motivo text; v_phone text; v_name text; v_addr jsonb; v_client uuid;
  v_names text; v_price int; v_row public.appointments;
begin
  select * into s from public.settings where id = 1;
  v_min := private.duration_of(p_service_ids);
  v_name := private.clean(p_name, 80);
  if v_name is null or char_length(v_name) < 2 then raise exception 'NOME_INVALIDO'; end if;
  v_phone := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if char_length(v_phone) in (10, 11) then v_phone := '55' || v_phone; end if;
  if v_phone !~ '^55[0-9]{10,11}$' then raise exception 'TELEFONE_INVALIDO'; end if;
  v_addr := jsonb_strip_nulls(jsonb_build_object(
    'cep', private.clean(p_address ->> 'cep', 9), 'rua', private.clean(p_address ->> 'rua', 100),
    'numero', private.clean(p_address ->> 'numero', 10), 'compl', private.clean(p_address ->> 'compl', 60),
    'bairro', private.clean(p_address ->> 'bairro', 60), 'cidade', private.clean(p_address ->> 'cidade', 60),
    'ref', private.clean(p_address ->> 'ref', 100)));
  if v_addr ->> 'rua' is null or v_addr ->> 'numero' is null or v_addr ->> 'bairro' is null or v_addr ->> 'cidade' is null then
    raise exception 'ENDERECO_INVALIDO'; end if;
  v_motivo := private.check_slot(p_start, v_min, null);
  if v_motivo is not null then raise exception '%', v_motivo; end if;

  insert into public.clients (name, phone) values (v_name, v_phone) on conflict (phone) do nothing;
  select id into v_client from public.clients where phone = v_phone;
  if (select count(*) from public.appointments where client_id = v_client and status in ('pendente', 'confirmado') and starts_at > now()) >= 3 then
    raise exception 'LIMITE_AGENDAMENTOS'; end if;

  select string_agg(name, ', ' order by array_position(p_service_ids, id)),
         case when bool_and(price_cents is not null) then sum(price_cents)::int end
    into v_names, v_price from public.services where id = any (p_service_ids);

  begin
    insert into public.appointments (client_id, service_ids, service_names, starts_at, ends_at, block_until, price_cents, address, notes)
    values (v_client, (select array_agg(distinct x) from unnest(p_service_ids) x), v_names, p_start,
            p_start + make_interval(mins => v_min), p_start + make_interval(mins => v_min + s.buffer_min),
            v_price, v_addr, private.clean(p_notes, 500))
    returning * into v_row;
  exception when exclusion_violation then raise exception 'OCUPADO';
  end;
  return jsonb_build_object('token', v_row.manage_token, 'starts_at', v_row.starts_at, 'ends_at', v_row.ends_at,
                            'services', v_row.service_names, 'price_cents', v_row.price_cents, 'status', v_row.status);
end $$;

-- Consulta pelo código (só dados do próprio agendamento, sem telefone).
create or replace function public.get_booking(p_token uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'status', a.status, 'starts_at', a.starts_at, 'ends_at', a.ends_at, 'services', a.service_names,
    'service_ids', a.service_ids, 'price_cents', a.price_cents, 'first_name', split_part(c.name, ' ', 1),
    'bairro', a.address ->> 'bairro',
    'can_change', a.status in ('pendente', 'confirmado') and a.starts_at - now() >= make_interval(mins => s.cancel_notice_min),
    'cancel_notice_min', s.cancel_notice_min)
  from public.appointments a join public.clients c on c.id = a.client_id cross join public.settings s
  where a.manage_token = p_token and s.id = 1;
$$;

create or replace function public.cancel_booking(p_token uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare s public.settings; a public.appointments;
begin
  select * into s from public.settings where id = 1;
  select * into a from public.appointments where manage_token = p_token for update;
  if not found then raise exception 'NAO_ENCONTRADO'; end if;
  if a.status not in ('pendente', 'confirmado') then raise exception 'JA_ENCERRADO'; end if;
  if a.starts_at - now() < make_interval(mins => s.cancel_notice_min) then raise exception 'PRAZO_ENCERRADO'; end if;
  update public.appointments set status = 'cancelado', cancelled_at = now(), cancelled_by = 'cliente' where id = a.id;
  return public.get_booking(p_token);
end $$;

create or replace function public.reschedule_booking(p_token uuid, p_new_start timestamptz)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare s public.settings; a public.appointments; v_min int; v_motivo text;
begin
  select * into s from public.settings where id = 1;
  select * into a from public.appointments where manage_token = p_token for update;
  if not found then raise exception 'NAO_ENCONTRADO'; end if;
  if a.status not in ('pendente', 'confirmado') then raise exception 'JA_ENCERRADO'; end if;
  if a.starts_at - now() < make_interval(mins => s.cancel_notice_min) then raise exception 'PRAZO_ENCERRADO'; end if;
  v_min := extract(epoch from (a.ends_at - a.starts_at))::int / 60;
  v_motivo := private.check_slot(p_new_start, v_min, a.id);
  if v_motivo is not null then raise exception '%', v_motivo; end if;
  begin
    update public.appointments
       set starts_at = p_new_start, ends_at = p_new_start + make_interval(mins => v_min),
           block_until = p_new_start + make_interval(mins => v_min + s.buffer_min),
           status = 'pendente', confirmed_at = null, reminded_at = null
     where id = a.id;
  exception when exclusion_violation then raise exception 'OCUPADO';
  end;
  return public.get_booking(p_token);
end $$;

revoke all on function public.available_slots(text[], date, date, uuid), public.book_appointment(text[], timestamptz, text, text, jsonb, text),
  public.get_booking(uuid), public.cancel_booking(uuid), public.reschedule_booking(uuid, timestamptz) from public;
grant execute on function public.available_slots(text[], date, date, uuid), public.book_appointment(text[], timestamptz, text, text, jsonb, text),
  public.get_booking(uuid), public.cancel_booking(uuid), public.reschedule_booking(uuid, timestamptz) to anon, authenticated;

-- O painel usa para saber se quem entrou é administradora.
create or replace function public.am_i_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (select 1 from private.admins where user_id = (select auth.uid()));
$$;
revoke all on function public.am_i_admin() from public;
grant execute on function public.am_i_admin() to authenticated;

-- updated_at automático
create or replace function private.touch() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists settings_touch on public.settings;
create trigger settings_touch before update on public.settings for each row execute function private.touch();
drop trigger if exists services_touch on public.services;
create trigger services_touch before update on public.services for each row execute function private.touch();

insert into public.settings (id) values (1) on conflict (id) do nothing;
