-- Pruebas de la spec 01. Ejecutar con: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- Datos: dos sedes, un admin y un cajero por sede
insert into public.sedes (id, nombre, tipo) values
  ('00000000-0000-0000-0000-0000000000a1', 'Sede A', 'panaderia'),
  ('00000000-0000-0000-0000-0000000000b1', 'Sede B', 'asadero');

insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'admin@pos.local',
   '{"rol":"admin","nombre_usuario":"admin","nombre_completo":"Admin"}'),
  ('00000000-0000-0000-0000-000000000002', 'caja.a@pos.local',
   '{"rol":"cajero","nombre_usuario":"caja.a","nombre_completo":"Caja A","sede_id":"00000000-0000-0000-0000-0000000000a1"}'),
  ('00000000-0000-0000-0000-000000000003', 'caja.b@pos.local',
   '{"rol":"cajero","nombre_usuario":"caja.b","nombre_completo":"Caja B","sede_id":"00000000-0000-0000-0000-0000000000b1"}');

select is((select count(*)::int from public.perfiles), 3, 'el trigger crea los perfiles desde Auth');

-- Cajero de la sede A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

select is((select count(*)::int from public.sedes), 1, 'cajero ve solo su sede');
select is((select count(*)::int from public.perfiles), 1, 'cajero ve solo su perfil');
select throws_ok(
  $$insert into public.sedes (nombre, tipo) values ('X', 'asadero')$$,
  '42501', null, 'cajero no crea sedes');
select is_empty(
  $$update public.perfiles set nombre_completo = 'hack' where id = '00000000-0000-0000-0000-000000000003' returning 1$$,
  'cajero no edita otros perfiles');

-- Admin
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is((select count(*)::int from public.sedes), 2, 'admin ve todas las sedes');
select is((select count(*)::int from public.perfiles), 3, 'admin ve todos los perfiles');
select throws_ok(
  $$update public.sedes set tipo = 'asadero' where nombre = 'Sede A'$$,
  'P0001', 'TIPO_SEDE_INMUTABLE', 'el tipo de sede no cambia');
select throws_ok(
  $$update public.perfiles set activo = false where nombre_usuario = 'admin'$$,
  'P0001', 'ULTIMO_ADMIN', 'no se desactiva el último admin');
select throws_ok(
  $$insert into public.sedes (nombre, tipo) values ('sede a', 'asadero')$$,
  '23505', null, 'nombre de sede único sin importar mayúsculas');

update public.sedes set activa = false where nombre = 'Sede B';
select throws_ok(
  $$update public.perfiles set sede_id = '00000000-0000-0000-0000-0000000000b1' where nombre_usuario = 'caja.a'$$,
  'P0001', 'SEDE_NO_DISPONIBLE', 'no se asigna un cajero a una sede inactiva');

-- Usuario anónimo
reset role;
set local role anon;
select throws_ok($$select * from public.sedes$$, '42501', null, 'anónimo no lee sedes');

select * from finish();
rollback;
