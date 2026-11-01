-- Pruebas de la spec 06 (caja mayor). Ejecutar con: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

insert into public.sedes (id, nombre, tipo) values
  ('00000000-0000-0000-0000-0000000000a1', 'Panaderia A', 'panaderia'),
  ('00000000-0000-0000-0000-0000000000b1', 'Asadero B', 'asadero');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'admin.cm@pos.local'),
  ('00000000-0000-0000-0000-000000000002', 'caja.cm@pos.local');
insert into public.perfiles (id, nombre_completo, nombre_usuario, rol, sede_id) values
  ('00000000-0000-0000-0000-000000000001', 'Admin', 'admin.cm', 'admin', null),
  ('00000000-0000-0000-0000-000000000002', 'Caja', 'caja.cm', 'cajero', '00000000-0000-0000-0000-0000000000a1');
insert into public.productos (id, tipo, nombre, precio_referencia) values
  ('00000000-0000-0000-0000-00000000e001', 'panaderia', 'PAN', 1000);

select is((select count(*)::int from public.caja_mayor_saldos
           where sede_id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1') and saldo = 0),
  6, 'cada sede nueva tiene caja mayor en $ 0 (3 partes)');

-- ── Cajero: turno con ventas de los 3 métodos ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select set_config('request.headers', '{"x-pos-dispositivo":"11111111-1111-1111-1111-111111111111"}', true);
select set_config('pruebas.turno', public.abrir_turno(50000)::text, true);
select public.registrar_venta(gen_random_uuid(), 'efectivo',
  '[{"producto_id":"00000000-0000-0000-0000-00000000e001","cantidad":10,"precio":1000}]', 10000);
select public.registrar_venta(gen_random_uuid(), 'transferencia',
  '[{"producto_id":"00000000-0000-0000-0000-00000000e001","cantidad":3,"precio":1000}]');
select public.registrar_venta(gen_random_uuid(), 'tarjeta',
  '[{"producto_id":"00000000-0000-0000-0000-00000000e001","cantidad":2,"precio":1000}]');

select is((select count(*)::int from public.caja_mayor_saldos), 0, 'cajero no lee los saldos directo');
select is((select count(*)::int from public.caja_mayor_movimientos), 0, 'cajero no lee movimientos');
select throws_ok($$select public.caja_mayor_ajustar('00000000-0000-0000-0000-0000000000a1', 'efectivo', 1000, 'x')$$,
  'P0001', 'SOLO_ADMIN', 'cajero no ajusta la caja mayor');
select throws_ok($$select public.registrar_gasto(5000, 'Pedido', 5000, 'efectivo')$$,
  'P0001', 'CAJA_MAYOR_INSUFICIENTE', 'gasto mayor al saldo de la parte se rechaza');

-- ── Admin fija saldos ──
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is(public.caja_mayor_fijar('00000000-0000-0000-0000-0000000000a1', 'efectivo', 100000, 'Saldo inicial'),
  100000::bigint, 'admin fija el saldo de efectivo');
select is(public.caja_mayor_fijar('00000000-0000-0000-0000-0000000000a1', 'transferencia', 20000, 'Saldo inicial'),
  20000::bigint, 'admin fija el saldo de QR');
select throws_ok($$select public.caja_mayor_ajustar('00000000-0000-0000-0000-0000000000a1', 'transferencia', -20001, 'Consignación')$$,
  'P0001', 'CAJA_MAYOR_INSUFICIENTE', 'quitar no deja la parte en negativo');

-- ── Cajero: gastos con origen ──
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is(public.caja_mayor_saldo() ->> 'total', '120000', 'el cajero ve el saldo de su sede');
select set_config('pruebas.g1', public.registrar_gasto(4000, 'Bolsas')::text, true);
select set_config('pruebas.g2', public.registrar_gasto(30000, 'Pedido harina', 30000, 'efectivo')::text, true);
select set_config('pruebas.g3', public.registrar_gasto(10000, 'Pedido gaseosas', 4000, 'transferencia')::text, true);
select is(public.caja_mayor_saldo() ->> 'efectivo', '70000', 'gasto de caja mayor resta de su parte');
select is(public.caja_mayor_saldo() ->> 'transferencia', '16000', 'gasto con ambas resta solo su parte de la caja mayor');
select throws_ok($$select public.registrar_gasto(50001, 'Mucho')$$,
  'P0001', 'EFECTIVO_INSUFICIENTE', 'el esperado solo descuenta lo que salió de la caja (50000)');
select lives_ok($$select public.registrar_gasto(50000, 'Justo', 50000, 'efectivo')$$,
  'gasto de caja mayor no depende del esperado');
select lives_ok($$select public.registrar_gasto(2000, 'Partes', 1000, 1000, 0)$$, 'un gasto puede salir de varias partes');
select throws_ok($$select public.registrar_gasto(5000, 'X', 0, 0, 1)$$,
  'P0001', 'CAJA_MAYOR_INSUFICIENTE: Tarjeta', 'el error dice qué parte no alcanza');
select public.anular_gasto(current_setting('pruebas.g2')::uuid);
select is(public.caja_mayor_saldo() ->> 'efectivo', '49000', 'anular devuelve a la caja mayor');
select throws_ok(format('update public.gastos set monto = 1 where id = %L', current_setting('pruebas.g1')),
  '42501', null, 'el cajero no edita gastos directo');

-- ── Cierre ──
select throws_ok(format('select public.cerrar_turno(%L, 49000, 49001)', current_setting('pruebas.turno')),
  'P0001', 'ENVIO_MAYOR_INVALIDO', 'no se envía más de lo contado');
select set_config('pruebas.rep', public.cerrar_turno(current_setting('pruebas.turno')::uuid, 49000, 30000)::text, true);
select is((current_setting('pruebas.rep')::jsonb ->> 'diferencia')::int, -1000, 'diferencia sobre todo lo contado');
select is((current_setting('pruebas.rep')::jsonb ->> 'queda_en_caja')::int, 19000, 'queda en caja = contado − enviado');
select is((current_setting('pruebas.rep')::jsonb -> 'caja_mayor' ->> 'total')::int, 35000,
  'al cerrar entran efectivo enviado + QR + tarjeta');
select is(public.caja_mayor_saldo() ->> 'total', '99000', 'saldo total después del cierre');
select is(public.base_sugerida(), 19000, 'la base sugerida es lo que quedó en caja');

-- ── Admin revisa ──
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select sum(monto)::bigint from public.caja_mayor_movimientos where sede_id = '00000000-0000-0000-0000-0000000000a1'),
  99000::bigint, 'la suma de movimientos coincide con el saldo');
select throws_ok($$delete from public.caja_mayor_movimientos$$, '42501', null, 'los movimientos no se borran');
select ok((select bool_and(base + efectivo - gastos = esperado) from public.rep_cuadre_diario(
  '00000000-0000-0000-0000-0000000000a1', (now() at time zone 'America/Bogota')::date, (now() at time zone 'America/Bogota')::date)),
  'el cuadre diario cuadra con los gastos de caja');

select * from finish();
rollback;
