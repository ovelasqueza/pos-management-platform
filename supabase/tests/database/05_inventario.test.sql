-- Pruebas de la spec 05 (inventario por fecha). Ejecutar con: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- Datos: panadería activa, panadería inactiva, asadero; un admin y un cajero
insert into public.sedes (id, nombre, tipo) values
  ('00000000-0000-0000-0000-0000000000a1', 'Panaderia A', 'panaderia'),
  ('00000000-0000-0000-0000-0000000000a2', 'Panaderia Inactiva', 'panaderia'),
  ('00000000-0000-0000-0000-0000000000b1', 'Asadero B', 'asadero');
-- Perfiles directos (sin app_metadata, para no depender del trigger de Auth)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'admin.inv@pos.local'),
  ('00000000-0000-0000-0000-000000000002', 'caja.inv@pos.local');
insert into public.perfiles (id, nombre_completo, nombre_usuario, rol, sede_id) values
  ('00000000-0000-0000-0000-000000000001', 'Admin', 'admin.inv', 'admin', null),
  ('00000000-0000-0000-0000-000000000002', 'Caja', 'caja.inv', 'cajero', '00000000-0000-0000-0000-0000000000a1');

insert into public.productos (id, tipo, nombre, precio_referencia) values
  ('00000000-0000-0000-0000-00000000e001', 'panaderia', 'PAN', 500),
  ('00000000-0000-0000-0000-00000000e002', 'panaderia', 'TORTA', 3000),
  ('00000000-0000-0000-0000-00000000e004', 'asadero', 'POLLO', 30000);
update public.productos_sede set habilitado = false
  where producto_id = '00000000-0000-0000-0000-00000000e002' and sede_id = '00000000-0000-0000-0000-0000000000a1';
insert into public.costos_producto_sede (sede_id, producto_id, costo) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000e001', 200);
insert into public.articulos_inventario (id, sede_id, nombre, unidad, costo) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a1', ' harina  de trigo ', 'bulto', 95000),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-0000000000a1', 'levadura', 'kilo', null),
  ('00000000-0000-0000-0000-00000000c003', '00000000-0000-0000-0000-0000000000b1', 'carbon', 'bulto', 40000);
update public.sedes set activa = false where id = '00000000-0000-0000-0000-0000000000a2';

select is((select nombre from public.articulos_inventario where id = '00000000-0000-0000-0000-00000000c001'),
  'HARINA DE TRIGO', 'el nombre del artículo queda en mayúsculas');

-- ── Cajero ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

select is((select count(*)::int from public.articulos_inventario), 0, 'cajero no ve artículos');
select throws_ok($$select public.inv_crear('00000000-0000-0000-0000-0000000000a1', null, null)$$,
  'P0001', 'SOLO_ADMIN', 'cajero no crea inventarios');
select throws_ok(
  $$insert into public.lineas_inventario (inventario_id, articulo_id, nombre, unidad)
    values (gen_random_uuid(), '00000000-0000-0000-0000-00000000c001', 'X', 'unidad')$$,
  '42501', null, 'cajero no escribe líneas directo');
select is((select count(*)::int from public.productos_vendibles), 1, 'la caja solo ve productos, no artículos');

-- ── Admin ──
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select throws_ok(
  $$select public.inv_crear('00000000-0000-0000-0000-0000000000a1', (now() at time zone 'America/Bogota')::date + 1, null)$$,
  'P0001', 'FECHA_FUTURA', 'fecha futura rechazada');
select throws_ok($$select public.inv_crear('00000000-0000-0000-0000-0000000000a2', null, null)$$,
  'P0001', 'INVENTARIO_SEDE_INACTIVA', 'sede inactiva no crea inventarios');

select set_config('pruebas.inv',
  public.inv_crear('00000000-0000-0000-0000-0000000000a1', null, ' Cierre de mes ')::text, true);

select is((select count(*)::int from public.lineas_inventario where inventario_id = current_setting('pruebas.inv')::uuid),
  3, 'lista inicial: productos habilitados + artículos activos de la sede');
select is((select costo from public.lineas_inventario where nombre = 'PAN'), 200, 'copia el costo del producto');
select throws_ok(
  $$select public.inv_crear('00000000-0000-0000-0000-0000000000a1', (now() at time zone 'America/Bogota')::date - 1, null)$$,
  'P0001', 'INVENTARIO_EN_CURSO', 'un solo inventario en curso por sede');
select lives_ok($$select public.inv_crear('00000000-0000-0000-0000-0000000000b1', null, null)$$,
  'otra sede puede tener inventario el mismo día');

select throws_ok($$select public.inv_cantidad((select id from public.lineas_inventario where nombre = 'PAN'), 2.5)$$,
  'P0001', 'CANTIDAD_INVALIDA', 'productos de venta solo en enteros');
select is((public.inv_cantidad((select id from public.lineas_inventario where nombre = 'HARINA DE TRIGO'), 9.5) ->> 'valor')::int,
  902500, '9½ bultos × $ 95.000');
select is((select total from public.inventarios_resumen where id = current_setting('pruebas.inv')::uuid),
  902500::bigint, 'el total no suma líneas sin costo');
select is((select sin_costo from public.inventarios_resumen where id = current_setting('pruebas.inv')::uuid),
  1, 'cuenta las líneas sin costo');

select throws_ok(
  $$select public.inv_agregar(current_setting('pruebas.inv')::uuid, '00000000-0000-0000-0000-00000000e004', null)$$,
  'P0001', 'LINEA_INVALIDA', 'producto de otro catálogo rechazado');
select throws_ok(
  $$select public.inv_agregar(current_setting('pruebas.inv')::uuid, null, '00000000-0000-0000-0000-00000000c003')$$,
  'P0001', 'LINEA_INVALIDA', 'artículo de otra sede rechazado');

-- Cambiar un costo no altera el inventario; "Actualizar costos" sí
reset role;
update public.costos_producto_sede set costo = 250 where producto_id = '00000000-0000-0000-0000-00000000e001';
set local role authenticated;
select is((select costo from public.lineas_inventario where nombre = 'PAN'), 200, 'cambiar el costo no toca inventarios hechos');
select public.inv_actualizar_costos(current_setting('pruebas.inv')::uuid);
select is((select costo from public.lineas_inventario where nombre = 'PAN'), 250, 'Actualizar costos copia los vigentes');

-- Finalizar, editar finalizado (reabrir)
select public.inv_finalizar(current_setting('pruebas.inv')::uuid);
select throws_ok($$select public.inv_cantidad((select id from public.lineas_inventario where nombre = 'PAN'), 1)$$,
  'P0001', 'INVENTARIO_FINALIZADO', 'un finalizado no se modifica');
select throws_ok($$select public.inv_borrar(current_setting('pruebas.inv')::uuid)$$,
  'P0001', 'INVENTARIO_FINALIZADO', 'un finalizado no se borra');
select public.inv_reabrir(current_setting('pruebas.inv')::uuid);
select lives_ok($$select public.inv_cantidad((select id from public.lineas_inventario where nombre = 'PAN'), 31)$$,
  'reabierto se puede editar');

-- Altas automáticas (script 14): materia prima y producto nuevos entran al inventario en curso
reset role;
insert into public.articulos_inventario (sede_id, nombre, unidad) values ('00000000-0000-0000-0000-0000000000a1', 'sal', 'libra');
insert into public.productos (tipo, nombre, precio_referencia) values ('panaderia', 'CROISSANT', 2500);
set local role authenticated;
select is((select count(*)::int from public.lineas_inventario
           where inventario_id = current_setting('pruebas.inv')::uuid and nombre in ('SAL', 'CROISSANT')),
  2, 'materia prima y producto nuevos entran solos al inventario en curso');

-- Sede inactiva: solo consulta
reset role;
update public.sedes set activa = false where id = '00000000-0000-0000-0000-0000000000a1';
set local role authenticated;
select throws_ok($$select public.inv_cantidad((select id from public.lineas_inventario where nombre = 'PAN'), 5)$$,
  'P0001', 'INVENTARIO_SEDE_INACTIVA', 'inventario de sede inactiva es solo consulta');

select * from finish();
rollback;
