-- Testes de segurança e regras de agenda (rodados num Postgres que imita o Supabase).
\set ON_ERROR_STOP 0
\pset tuples_only on
\echo '--- VISITANTE (anon) ---'
set role anon;
\echo '1 ler clientes (deve negar):'
select count(*) from public.clients;
\echo '2 ler agendamentos (deve negar):'
select count(*) from public.appointments;
\echo '3 ler bloqueios (deve negar):'
select count(*) from public.time_off;
\echo '4 ler serviços (9):'
select count(*) from public.services;
\echo '5 alterar preço (deve negar):'
update public.services set price_cents = 1 where id='gel';
\echo '6 chamar função privada (deve negar):'
select private.check_slot(now(), 60);
\echo '7 horários livres para gel (quantidade > 0):'
select count(*) from public.available_slots(array['gel']);
reset role;
select ((current_date + i) + time '10:00') at time zone 'America/Sao_Paulo' as d10 from generate_series(2,9) i
 where extract(dow from current_date + i) between 1 and 5 limit 1 \gset
set role anon;
\echo '8 agendar gel 10h (pendente):'
select public.book_appointment(array['gel'], :'d10', 'Maria Teste', '(11) 91234-5678', '{"rua":"Rua A","numero":"10","bairro":"Centro","cidade":"São Paulo"}', 'nude') ->> 'status';
\echo '9 mesmo horário outra cliente (OCUPADO):'
select public.book_appointment(array['manicure'], :'d10', 'Ana', '11988887777', '{"rua":"Rua B","numero":"2","bairro":"Centro","cidade":"SP"}');
\echo '10 começando 11:30 (gel termina 11h + 40 de deslocamento → OCUPADO):'
select public.book_appointment(array['manicure'], (:'d10'::timestamptz + interval '90 min'), 'Ana', '11988887777', '{"rua":"Rua B","numero":"2","bairro":"Centro","cidade":"SP"}');
\echo '11 começando 12:00 (livre → pendente):'
select public.book_appointment(array['manicure'], (:'d10'::timestamptz + interval '120 min'), 'Ana', '11988887777', '{"rua":"Rua B","numero":"2","bairro":"Centro","cidade":"SP"}') ->> 'status';
\echo '12 9:30 + 45min + 40 invade as 10h (OCUPADO):'
select public.book_appointment(array['manicure'], (:'d10'::timestamptz - interval '30 min'), 'Bia', '11977776666', '{"rua":"Rua C","numero":"3","bairro":"Centro","cidade":"SP"}');
\echo '13 só nail art (SO_ADICIONAL):'
select public.book_appointment(array['nailart'], (:'d10'::timestamptz + interval '6 hours'), 'Bia', '11977776666', '{"rua":"Rua C","numero":"3","bairro":"Centro","cidade":"SP"}');
\echo '14 20h (FORA_DO_EXPEDIENTE):'
select public.book_appointment(array['gel'], (:'d10'::timestamptz + interval '10 hours'), 'Bia', '11977776666', '{"rua":"Rua C","numero":"3","bairro":"Centro","cidade":"SP"}');
\echo '15 14:07 (HORARIO_INVALIDO):'
select public.book_appointment(array['gel'], (:'d10'::timestamptz + interval '4 hours 7 min'), 'Bia', '11977776666', '{"rua":"Rua C","numero":"3","bairro":"Centro","cidade":"SP"}');
\echo '16 ontem (ANTECEDENCIA ou FECHADO):'
select public.book_appointment(array['gel'], (:'d10'::timestamptz - interval '7 days'), 'Bia', '11977776666', '{"rua":"Rua C","numero":"3","bairro":"Centro","cidade":"SP"}');
\echo '17 telefone inválido:'
select public.book_appointment(array['gel'], (:'d10'::timestamptz + interval '6 hours'), 'Bia', '123', '{"rua":"Rua C","numero":"3","bairro":"Centro","cidade":"SP"}');
\echo '18 endereço faltando:'
select public.book_appointment(array['gel'], (:'d10'::timestamptz + interval '6 hours'), 'Bia', '11977776666', '{"rua":"Rua C"}');
\echo '19 serviço inexistente:'
select public.book_appointment(array['hack'], (:'d10'::timestamptz + interval '6 hours'), 'Bia', '11977776666', '{"rua":"Rua C","numero":"3","bairro":"Centro","cidade":"SP"}');
\echo '20 código falso (vazio):'
select public.get_booking(gen_random_uuid());
reset role;
select manage_token as tk from public.appointments where service_ids = array['gel'] \gset
set role anon;
\echo '21 consultar pelo código (sem telefone nem endereço completo):'
select public.get_booking(:'tk');
\echo '22 remarcar: o próprio horário das 10h aparece como opção (1):'
select count(*) from public.available_slots(array['gel'], null, null, :'tk') where slot = :'d10';
\echo '23 remarcar para 16h:'
select public.reschedule_booking(:'tk', (:'d10'::timestamptz + interval '6 hours')) ->> 'starts_at';
\echo '24 cancelar:'
select public.cancel_booking(:'tk') ->> 'status';
\echo '25 cancelar de novo (JA_ENCERRADO):'
select public.cancel_booking(:'tk');
\echo '26 16h voltou a ficar livre (1):'
select count(*) from public.available_slots(array['gel']) where slot = (:'d10'::timestamptz + interval '6 hours');
\echo '27 4º agendamento futuro do mesmo telefone (LIMITE_AGENDAMENTOS no 3º extra):'
select public.book_appointment(array['manicure'], (:'d10'::timestamptz + interval '1 day'), 'Ana', '11988887777', '{"rua":"Rua B","numero":"2","bairro":"Centro","cidade":"SP"}') ->> 'status';
select public.book_appointment(array['manicure'], (:'d10'::timestamptz + interval '2 days'), 'Ana', '11988887777', '{"rua":"Rua B","numero":"2","bairro":"Centro","cidade":"SP"}') ->> 'status';
select public.book_appointment(array['manicure'], (:'d10'::timestamptz + interval '7 days'), 'Ana', '11988887777', '{"rua":"Rua B","numero":"2","bairro":"Centro","cidade":"SP"}') ->> 'status';
reset role;
\echo '--- LOGADA MAS NÃO É ADMIN ---'
insert into auth.users values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');
insert into private.admins values ('00000000-0000-0000-0000-00000000000a');
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
\echo '28 ver agendamentos (0):'
select count(*) from public.appointments;
\echo '29 ver clientes (0):'
select count(*) from public.clients;
\echo '30 alterar preço (não muda → t):'
update public.services set price_cents = 1 where id='gel';
select price_cents is null from public.services where id='gel';
\echo '31 se colocar como admin (deve negar):'
insert into private.admins values ('00000000-0000-0000-0000-00000000000b');
\echo '--- ADMIN ---'
reset role; set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
\echo '32 ver agendamentos com cliente:'
select a.status, c.name, c.phone from public.appointments a join public.clients c on c.id=a.client_id order by a.starts_at;
\echo '33 alterar preço do gel para R$ 80 (8000):'
update public.services set price_cents = 8000 where id='gel'; select price_cents from public.services where id='gel';
\echo '34 folga no dia inteiro → 0 horários nesse dia:'
insert into public.time_off (starts_at, ends_at, reason) values (date_trunc('day', :'d10'::timestamptz at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo', (date_trunc('day', :'d10'::timestamptz at time zone 'America/Sao_Paulo') + interval '1 day') at time zone 'America/Sao_Paulo', 'Folga');
select count(*) from public.available_slots(array['gel']) where (slot at time zone 'America/Sao_Paulo')::date = (:'d10'::timestamptz at time zone 'America/Sao_Paulo')::date;
\echo '35 horário de funcionamento inválido (deve negar):'
update public.settings set hours = '{"1":["19:00","09:00"]}';
\echo '36 confirmar agendamento:'
update public.appointments set status='confirmado', confirmed_at=now() where status='pendente' and service_ids = array['manicure'] and starts_at = (:'d10'::timestamptz + interval '120 min');
select count(*) from public.appointments where status='confirmado';
\echo '37 admin forçando sobreposição direto na tabela (deve negar):'
insert into public.appointments (client_id, service_ids, service_names, starts_at, ends_at, block_until, address)
 select client_id, service_ids, 'x', starts_at, ends_at, block_until, address from public.appointments where status='confirmado' limit 1;
