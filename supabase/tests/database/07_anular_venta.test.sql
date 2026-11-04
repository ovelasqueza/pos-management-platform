-- Pruebas de anulación de ventas (script 18). Ejecutar con: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into public.sedes (id, nombre, tipo) values
  ('00000000-0000-0000-0000-0000000000a7', 'Panaderia Anular', 'panaderia');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000071', 'admin.an@pos.local'),
  ('00000000-0000-0000-0000-000000000072', 'caja.an@pos.local'),
  ('00000000-0000-0000-0000-000000000073', 'otra.an@pos.local');
insert into public.perfiles (id, nombre_completo, nombre_usuario, rol, sede_id) values
  ('00000000-0000-0000-0000-000000000071', 'Admin', 'admin.an', 'admin', null),
  ('00000000-0000-0000-0000-000000000072', 'Caja', 'caja.an', 'cajero', '00000000-0000-0000-0000-0000000000a7'),
  ('00000000-0000-0000-0000-000000000073', 'Otra', 'otra.an', 'cajero', '00000000-0000-0000-0000-0000000000a7');
insert into public.productos (id, tipo, nombre, precio_referencia) values
  ('00000000-0000-0000-0000-00000000e071', 'panaderia', 'PAN ANULAR', 1000);

-- ── Cajero: turno con 3 ventas ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000072","role":"authenticated"}', true);
select set_config('request.headers', '{"x-pos-dispositivo":"77777777-7777-7777-7777-777777777777"}', true);
select set_config('pruebas.turno', public.abrir_turno(10000)::text, true);
select set_config('pruebas.v1', (public.registrar_venta(gen_random_uuid(), 'efectivo',
  '[{"producto_id":"00000000-0000-0000-0000-00000000e071","cantidad":5,"precio":1000}]', 5000) ->> 'venta_id'), true);
select set_config('pruebas.v2', (public.registrar_venta(gen_random_uuid(), 'transferencia',
  '[{"producto_id":"00000000-0000-0000-0000-00000000e071","cantidad":3,"precio":1000}]') ->> 'venta_id'), true);
select set_config('pruebas.v3', (public.registrar_venta(gen_random_uuid(), 'efectivo',
  '[{"producto_id":"00000000-0000-0000-0000-00000000e071","cantidad":2,"precio":1000}]', 2000) ->> 'venta_id'), true);

select throws_ok(format('select public.anular_venta(%L, %L)', current_setting('pruebas.v1'), '   '),
  'P0001', 'MOTIVO_INVALIDO', 'el motivo es obligatorio');
select throws_ok(format('select public.anular_venta(%L, %L)', current_setting('pruebas.v1'), repeat('x', 121)),
  'P0001', 'MOTIVO_INVALIDO', 'el motivo admite máximo 120 caracteres');

-- Desde otro equipo no se anula
select set_config('request.headers', '{"x-pos-dispositivo":"88888888-8888-8888-8888-888888888888"}', true);
select throws_ok(format('select public.anular_venta(%L, %L)', current_setting('pruebas.v1'), 'Error'),
  'P0001', 'TURNO_EN_OTRO_EQUIPO', 'solo desde el equipo del turno');
select set_config('request.headers', '{"x-pos-dispositivo":"77777777-7777-7777-7777-777777777777"}', true);

select set_config('pruebas.t1', public.anular_venta(current_setting('pruebas.v1')::uuid, '  Producto equivocado ')::text, true);
select ok((current_setting('pruebas.t1')::jsonb ->> 'anulada_en') is not null, 'el ticket trae la hora de anulación');
select is(current_setting('pruebas.t1')::jsonb ->> 'motivo_anulacion', 'Producto equivocado', 'el ticket trae el motivo (sin espacios)');
select lives_ok(format('select public.anular_venta(%L, %L)', current_setting('pruebas.v1'), 'Otro motivo'),
  'anular otra vez (reintento) no falla');
select is((select motivo_anulacion from public.ventas where id = current_setting('pruebas.v1')::uuid),
  'Producto equivocado', 'el reintento no cambia el motivo');
select is((select count(*)::int from public.ventas where turno_id = current_setting('pruebas.turno')::uuid),
  3, 'la venta anulada no se borra');
select public.anular_venta(current_setting('pruebas.v2')::uuid, 'Cliente no pagó el QR');

select throws_ok(format('update public.ventas set motivo_anulacion = %L where id = %L', 'x', current_setting('pruebas.v3')),
  '42501', null, 'el cajero no edita ventas directo');
select throws_ok(format('delete from public.ventas where id = %L', current_setting('pruebas.v3')),
  '42501', null, 'el cajero no borra ventas');

-- Otro cajero no anula ventas ajenas
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000073","role":"authenticated"}', true);
select throws_ok(format('select public.anular_venta(%L, %L)', current_setting('pruebas.v3'), 'Ajena'),
  'P0001', 'VENTA_NO_ANULABLE', 'un cajero no anula ventas de otro');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000072","role":"authenticated"}', true);

-- Esperado = 10000 + 2000 (v3) = 12000. Gasto de caja por todo → anular v3 lo dejaría negativo
select public.registrar_gasto(12000, 'Pedido');
select throws_ok(format('select public.anular_venta(%L, %L)', current_setting('pruebas.v3'), 'Error'),
  'P0001', 'EFECTIVO_INSUFICIENTE', 'anular no deja el esperado en negativo');

-- ── Cierre ──
select set_config('pruebas.rep', public.cerrar_turno(current_setting('pruebas.turno')::uuid, 0)::text, true);
select is((current_setting('pruebas.rep')::jsonb ->> 'ventas_cantidad')::int, 1, 'el reporte cuenta solo ventas vigentes');
select is((current_setting('pruebas.rep')::jsonb ->> 'ventas_total')::int, 2000, 'el total vendido excluye las anuladas');
select is((current_setting('pruebas.rep')::jsonb -> 'por_metodo' ->> 'transferencia')::int, 0, 'QR anulado no cuenta');
select is((current_setting('pruebas.rep')::jsonb ->> 'esperado')::int, 0, 'el esperado excluye la venta anulada');
select is(jsonb_array_length(current_setting('pruebas.rep')::jsonb -> 'anuladas'), 2, 'el reporte lista las anuladas');
select is((current_setting('pruebas.rep')::jsonb ->> 'anuladas_total')::int, 8000, 'total anulado en el reporte');
select is((current_setting('pruebas.rep')::jsonb -> 'productos' -> 0 ->> 'unidades')::int, 2, 'productos vendidos sin anuladas');
select is((current_setting('pruebas.rep')::jsonb -> 'caja_mayor' ->> 'transferencia')::int, 0, 'QR anulado no pasa a caja mayor');
select throws_ok(format('select public.anular_venta(%L, %L)', current_setting('pruebas.v3'), 'Tarde'),
  'P0001', 'TURNO_CERRADO', 'con el turno cerrado no se anula');

-- ── Admin ──
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000071","role":"authenticated"}', true);
select is((select count(*)::int from public.rep_ventas_anuladas('00000000-0000-0000-0000-0000000000a7',
  (now() at time zone 'America/Bogota')::date, (now() at time zone 'America/Bogota')::date)),
  2, 'el reporte de anuladas las muestra');
select is((public.rep_resumen('00000000-0000-0000-0000-0000000000a7',
  (now() at time zone 'America/Bogota')::date, (now() at time zone 'America/Bogota')::date) ->> 'total')::int,
  2000, 'el resumen excluye las anuladas');
select throws_ok($$select public.anular_venta(gen_random_uuid(), 'x')$$,
  'P0001', 'SOLO_CAJERO', 'el admin no anula ventas');

select * from finish();
rollback;
