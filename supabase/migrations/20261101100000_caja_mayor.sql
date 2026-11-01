-- Spec 06: Caja mayor (pedido del usuario y del contador, 2026-11-01).
-- Saldo por sede en Efectivo, QR (transferencia) y Tarjeta. Entra al cerrar cada turno
-- (QR y tarjeta completos + el efectivo que decide el cajero) y sale con gastos y ajustes del admin.
-- Los gastos dicen de dónde sale el dinero: caja (cajón del turno), caja mayor o ambas.
-- Solo lo que sale de la caja se resta del efectivo esperado del turno.
--
-- Requiere: 01 a 14. Gastos y turnos anteriores quedan como caja (monto_mayor = 0).
-- Las RPC nuevas tienen argumentos con valor por defecto: la app anterior sigue funcionando
-- (registra gastos de caja y cierra sin enviar efectivo; QR y tarjeta pasan igual a la caja mayor).

-- ───────────────────────── Tablas ─────────────────────────

create table public.caja_mayor_saldos (
  sede_id uuid not null references public.sedes,
  parte public.metodo_pago not null,
  saldo bigint not null default 0 constraint caja_mayor_saldo_no_negativo check (saldo >= 0),
  primary key (sede_id, parte)
);

insert into public.caja_mayor_saldos (sede_id, parte)
select s.id, p.parte
from public.sedes s
cross join unnest(enum_range(null::public.metodo_pago)) as p(parte);

create type public.tipo_movimiento_mayor as enum ('cierre_turno', 'gasto', 'anulacion_gasto', 'admin');

create table public.caja_mayor_movimientos (
  id uuid primary key default gen_random_uuid(),
  sede_id uuid not null references public.sedes,
  parte public.metodo_pago not null,
  tipo public.tipo_movimiento_mayor not null,
  monto bigint not null check (monto <> 0),   -- + entra, − sale
  saldo_despues bigint not null check (saldo_despues >= 0),
  turno_id uuid references public.turnos,
  gasto_id uuid references public.gastos,
  usuario_id uuid not null references public.perfiles,
  descripcion text check (descripcion is null or length(trim(descripcion)) between 1 and 120),
  creado_en timestamptz not null default now(),
  constraint movimiento_admin_con_descripcion check (tipo <> 'admin' or descripcion is not null)
);
create index caja_mayor_mov_sede_fecha on public.caja_mayor_movimientos (sede_id, creado_en desc);
create index caja_mayor_mov_fecha on public.caja_mayor_movimientos (creado_en desc);
create index caja_mayor_mov_turno on public.caja_mayor_movimientos (turno_id);

create trigger caja_mayor_mov_inmutables before update or delete on public.caja_mayor_movimientos
  for each row execute function privado.rechazar_cambio();

-- Origen del gasto. monto sigue siendo el total; monto_caja se calcula.
-- (Columnas con valor constante y generada: no reescriben filas con triggers.)
alter table public.gastos
  add column monto_mayor int not null default 0,
  add column parte_mayor public.metodo_pago,
  add column monto_caja int generated always as (monto - monto_mayor) stored;
alter table public.gastos
  add constraint gastos_origen check (monto_mayor between 0 and monto),
  add constraint gastos_parte_mayor check ((monto_mayor = 0) = (parte_mayor is null));

-- Efectivo enviado a la caja mayor al cerrar (null en turnos anteriores a esta spec)
alter table public.turnos
  add column efectivo_a_mayor int,
  add constraint turnos_a_mayor check (
    efectivo_a_mayor is null
    or (cerrado_en is not null and efectivo_a_mayor between 0 and efectivo_contado)
  );

-- Un gasto solo cambia para anularse (una vez). No se borra.
create function privado.validar_gasto() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'REGISTRO_INMUTABLE';
  end if;
  if old.anulado_en is not null or new.anulado_en is null
     or new.turno_id <> old.turno_id or new.monto <> old.monto
     or new.monto_mayor <> old.monto_mayor or new.parte_mayor is distinct from old.parte_mayor
     or new.descripcion <> old.descripcion or new.creado_en <> old.creado_en then
    raise exception 'REGISTRO_INMUTABLE';
  end if;
  return new;
end;
$$;
create trigger gastos_inmutables before update or delete on public.gastos
  for each row execute function privado.validar_gasto();

-- Caja mayor en $ 0 para cada sede nueva
create function privado.al_crear_sede_caja_mayor() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.caja_mayor_saldos (sede_id, parte)
  select new.id, p.parte from unnest(enum_range(null::public.metodo_pago)) as p(parte);
  return new;
end;
$$;
create trigger al_crear_sede_caja_mayor after insert on public.sedes
  for each row execute function privado.al_crear_sede_caja_mayor();

-- ─────────────────────── Funciones internas ───────────────────────

-- Único lugar que cambia un saldo. Bloquea la fila y registra el movimiento.
-- Movimientos de $ 0 no se registran. Devuelve el saldo de la parte después.
create function privado.mover_caja_mayor(
  p_sede uuid, p_parte public.metodo_pago, p_monto bigint, p_tipo public.tipo_movimiento_mayor,
  p_turno uuid, p_gasto uuid, p_usuario uuid, p_descripcion text
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_saldo bigint;
begin
  insert into public.caja_mayor_saldos (sede_id, parte) values (p_sede, p_parte)
  on conflict do nothing;

  if coalesce(p_monto, 0) = 0 then
    select saldo into v_saldo from public.caja_mayor_saldos where sede_id = p_sede and parte = p_parte;
    return v_saldo;
  end if;

  begin
    update public.caja_mayor_saldos set saldo = saldo + p_monto
    where sede_id = p_sede and parte = p_parte
    returning saldo into v_saldo;
  exception
    when check_violation then
      raise exception 'CAJA_MAYOR_INSUFICIENTE';
  end;

  insert into public.caja_mayor_movimientos
    (sede_id, parte, tipo, monto, saldo_despues, turno_id, gasto_id, usuario_id, descripcion)
  values
    (p_sede, p_parte, p_tipo, p_monto, v_saldo, p_turno, p_gasto, p_usuario, nullif(trim(p_descripcion), ''));
  return v_saldo;
end;
$$;

-- Base + ventas en efectivo − gastos vigentes que salieron de la caja
create or replace function privado.efectivo_esperado(p_turno uuid) returns int
language sql stable security definer set search_path = '' as $$
  select (
    t.base
    + coalesce((select sum(v.total) from public.ventas v
                where v.turno_id = t.id and v.metodo = 'efectivo'), 0)
    - coalesce((select sum(g.monto_caja) from public.gastos g
                where g.turno_id = t.id and g.anulado_en is null), 0)
  )::int
  from public.turnos t
  where t.id = p_turno;
$$;

-- Instantánea del reporte de turno. Agrega origen de gastos y el bloque caja_mayor.
create function privado.armar_reporte(
  p_turno uuid, p_contado int, p_esperado int, p_cerrador public.perfiles, p_a_mayor int
) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'turno_id', t.id,
    'sede', jsonb_build_object('nombre', s.nombre, 'direccion', s.direccion, 'telefono', s.telefono),
    'cajero', c.nombre_completo,
    'abierto_en', t.abierto_en,
    'cerrado_en', now(),
    'cerrado_por_admin', case when (p_cerrador).rol = 'admin' then (p_cerrador).nombre_completo end,
    'base', t.base,
    'ventas_cantidad', (select count(*) from public.ventas v where v.turno_id = t.id),
    'ventas_total', (select coalesce(sum(v.total), 0) from public.ventas v where v.turno_id = t.id),
    'por_metodo', m.por_metodo,
    'gastos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'descripcion', g.descripcion, 'monto', g.monto, 'hora', g.creado_en,
        'monto_caja', g.monto_caja, 'monto_mayor', g.monto_mayor, 'parte_mayor', g.parte_mayor)
        order by g.creado_en)
      from public.gastos g where g.turno_id = t.id and g.anulado_en is null
    ), '[]'::jsonb),
    'gastos_total', gg.total,
    'gastos_caja', gg.caja,
    'gastos_mayor', gg.mayor,
    'esperado', p_esperado,
    'contado', p_contado,
    'diferencia', p_contado - p_esperado,
    'caja_mayor', jsonb_build_object(
      'efectivo', p_a_mayor,
      'transferencia', (m.por_metodo ->> 'transferencia')::bigint,
      'tarjeta', (m.por_metodo ->> 'tarjeta')::bigint,
      'total', p_a_mayor + (m.por_metodo ->> 'transferencia')::bigint + (m.por_metodo ->> 'tarjeta')::bigint
    ),
    'queda_en_caja', p_contado - p_a_mayor,
    'productos', coalesce((
      select jsonb_agg(jsonb_build_object('nombre', x.nombre, 'unidades', x.unidades, 'valor', x.valor)
                       order by x.unidades desc, x.nombre)
      from (
        select min(l.nombre) as nombre, sum(l.cantidad) as unidades, sum(l.cantidad * l.precio) as valor
        from public.lineas_venta l
        join public.ventas v on v.id = l.venta_id
        where v.turno_id = t.id
        group by l.producto_id
      ) x
    ), '[]'::jsonb)
  )
  from public.turnos t
  join public.sedes s on s.id = t.sede_id
  join public.perfiles c on c.id = t.cajero_id
  cross join lateral (
    select jsonb_build_object(
      'efectivo', coalesce(sum(v.total) filter (where v.metodo = 'efectivo'), 0),
      'transferencia', coalesce(sum(v.total) filter (where v.metodo = 'transferencia'), 0),
      'tarjeta', coalesce(sum(v.total) filter (where v.metodo = 'tarjeta'), 0)) as por_metodo
    from public.ventas v where v.turno_id = t.id
  ) m
  cross join lateral (
    select coalesce(sum(g.monto), 0) as total,
           coalesce(sum(g.monto_caja), 0) as caja,
           coalesce(sum(g.monto_mayor), 0) as mayor
    from public.gastos g where g.turno_id = t.id and g.anulado_en is null
  ) gg
  where t.id = p_turno;
$$;

-- Saldos de una sede como JSON
create function privado.saldo_caja_mayor(p_sede uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'efectivo', coalesce(sum(saldo) filter (where parte = 'efectivo'), 0),
    'transferencia', coalesce(sum(saldo) filter (where parte = 'transferencia'), 0),
    'tarjeta', coalesce(sum(saldo) filter (where parte = 'tarjeta'), 0),
    'total', coalesce(sum(saldo), 0))
  from public.caja_mayor_saldos where sede_id = p_sede;
$$;

revoke all on function
  privado.validar_gasto(), privado.al_crear_sede_caja_mayor(),
  privado.mover_caja_mayor(uuid, public.metodo_pago, bigint, public.tipo_movimiento_mayor, uuid, uuid, uuid, text),
  privado.efectivo_esperado(uuid),
  privado.armar_reporte(uuid, int, int, public.perfiles, int),
  privado.saldo_caja_mayor(uuid)
from public, anon, authenticated;

-- ───────────────────────── RPC del cajero ─────────────────────────

drop function public.registrar_gasto(int, text);

-- p_monto: total del gasto. p_monto_mayor: cuánto sale de la caja mayor (0 = todo de la caja).
create function public.registrar_gasto(
  p_monto int, p_descripcion text, p_monto_mayor int default 0, p_parte_mayor public.metodo_pago default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_cajero public.perfiles := privado.exigir_cajero();
  v_turno uuid;
  v_mayor int := coalesce(p_monto_mayor, 0);
  v_id uuid;
begin
  select id into v_turno from public.turnos
  where cajero_id = v_cajero.id and cerrado_en is null
  for update;
  if v_turno is null then
    raise exception 'TURNO_CERRADO';
  end if;

  if p_monto is null or p_monto < 1 or p_monto > 999999999 then
    raise exception 'MONTO_INVALIDO';
  end if;
  if length(trim(coalesce(p_descripcion, ''))) not between 1 and 120 then
    raise exception 'DESCRIPCION_INVALIDA';
  end if;
  if v_mayor < 0 or v_mayor > p_monto or (v_mayor > 0 and p_parte_mayor is null) then
    raise exception 'ORIGEN_INVALIDO';
  end if;
  -- No se informa el valor del esperado (arqueo ciego)
  if p_monto - v_mayor > privado.efectivo_esperado(v_turno) then
    raise exception 'EFECTIVO_INSUFICIENTE';
  end if;

  insert into public.gastos (turno_id, monto, descripcion, monto_mayor, parte_mayor)
  values (v_turno, p_monto, trim(p_descripcion), v_mayor, case when v_mayor > 0 then p_parte_mayor end)
  returning id into v_id;

  if v_mayor > 0 then
    perform privado.mover_caja_mayor(
      v_cajero.sede_id, p_parte_mayor, -v_mayor, 'gasto', v_turno, v_id, v_cajero.id, trim(p_descripcion));
  end if;
  return v_id;
end;
$$;

-- Anular devuelve a la caja mayor lo que salió de ella
create or replace function public.anular_gasto(p_gasto uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_cajero public.perfiles := privado.exigir_cajero();
  v_gasto public.gastos;
  v_turno public.turnos;
begin
  select * into v_gasto from public.gastos where id = p_gasto;
  if v_gasto.id is not null then
    select * into v_turno from public.turnos where id = v_gasto.turno_id for update;
  end if;
  if v_gasto.id is null or v_turno.cajero_id <> v_cajero.id or v_turno.cerrado_en is not null then
    raise exception 'GASTO_NO_ANULABLE';
  end if;

  update public.gastos set anulado_en = now()
  where id = p_gasto and anulado_en is null;
  if not found then
    raise exception 'GASTO_NO_ANULABLE';
  end if;

  if v_gasto.monto_mayor > 0 then
    perform privado.mover_caja_mayor(
      v_turno.sede_id, v_gasto.parte_mayor, v_gasto.monto_mayor, 'anulacion_gasto',
      v_turno.id, v_gasto.id, v_cajero.id, v_gasto.descripcion);
  end if;
end;
$$;

-- Saldo de la caja mayor de la sede del cajero (solo lectura)
create function public.caja_mayor_saldo() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_cajero public.perfiles := privado.exigir_cajero();
begin
  return privado.saldo_caja_mayor(v_cajero.sede_id);
end;
$$;

-- Lo que quedó en caja en el último cierre de la sede (null si no se sabe)
create function public.base_sugerida() returns int
language plpgsql stable security definer set search_path = '' as $$
declare
  v_cajero public.perfiles := privado.exigir_cajero();
begin
  return (
    select t.efectivo_contado - t.efectivo_a_mayor
    from public.turnos t
    where t.sede_id = v_cajero.sede_id and t.cerrado_en is not null
    order by t.cerrado_en desc
    limit 1
  );
end;
$$;

-- ───────────────────────── Cierre de turno ─────────────────────────

drop function public.cerrar_turno(uuid, int);
drop function privado.armar_reporte(uuid, int, int, public.perfiles);

-- Cierre con arqueo ciego. Lo hace el cajero (su turno) o un admin (cualquiera).
-- p_a_mayor: efectivo contado que va a la caja mayor. QR y tarjeta del turno pasan completos.
create function public.cerrar_turno(p_turno uuid, p_contado int, p_a_mayor int default 0) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_usuario public.perfiles;
  v_turno public.turnos;
  v_esperado int;
  v_a_mayor int := coalesce(p_a_mayor, 0);
  v_qr bigint;
  v_tarjeta bigint;
  v_reporte jsonb;
begin
  select * into v_usuario from public.perfiles where id = auth.uid() and activo;
  if v_usuario.id is null then
    raise exception 'SIN_PERMISO';
  end if;

  select * into v_turno from public.turnos where id = p_turno for update;
  if v_turno.id is null then
    raise exception 'TURNO_NO_EXISTE';
  end if;
  if v_usuario.rol = 'cajero' and v_turno.cajero_id <> v_usuario.id then
    raise exception 'SIN_PERMISO';
  end if;
  if v_turno.cerrado_en is not null then
    raise exception 'TURNO_CERRADO';
  end if;
  if p_contado is null or p_contado < 0 or p_contado > 999999999 then
    raise exception 'CONTADO_INVALIDO';
  end if;
  if v_a_mayor < 0 or v_a_mayor > p_contado then
    raise exception 'ENVIO_MAYOR_INVALIDO';
  end if;

  v_esperado := privado.efectivo_esperado(v_turno.id);
  v_reporte := privado.armar_reporte(v_turno.id, p_contado, v_esperado, v_usuario, v_a_mayor);

  update public.turnos set
    cerrado_en = now(),
    cerrado_por = v_usuario.id,
    efectivo_contado = p_contado,
    efectivo_esperado = v_esperado,
    diferencia = p_contado - v_esperado,
    efectivo_a_mayor = v_a_mayor,
    reporte = v_reporte
  where id = v_turno.id;

  select coalesce(sum(v.total) filter (where v.metodo = 'transferencia'), 0),
         coalesce(sum(v.total) filter (where v.metodo = 'tarjeta'), 0)
  into v_qr, v_tarjeta
  from public.ventas v where v.turno_id = v_turno.id;

  -- Siempre en el mismo orden de partes (evita bloqueos cruzados)
  perform privado.mover_caja_mayor(v_turno.sede_id, 'efectivo', v_a_mayor, 'cierre_turno', v_turno.id, null, v_usuario.id, null);
  perform privado.mover_caja_mayor(v_turno.sede_id, 'transferencia', v_qr, 'cierre_turno', v_turno.id, null, v_usuario.id, null);
  perform privado.mover_caja_mayor(v_turno.sede_id, 'tarjeta', v_tarjeta, 'cierre_turno', v_turno.id, null, v_usuario.id, null);

  return v_reporte;
end;
$$;

-- ───────────────────────── RPC del admin ─────────────────────────

-- Sumar (p_monto > 0) o quitar (p_monto < 0). Devuelve el saldo de la parte.
create function public.caja_mayor_ajustar(
  p_sede uuid, p_parte public.metodo_pago, p_monto int, p_descripcion text
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := privado.exigir_admin();
begin
  if not exists (select 1 from public.sedes where id = p_sede) or p_parte is null then
    raise exception 'SEDE_NO_EXISTE';
  end if;
  if p_monto is null or p_monto = 0 or abs(p_monto) > 999999999 then
    raise exception 'MONTO_INVALIDO';
  end if;
  if length(trim(coalesce(p_descripcion, ''))) not between 1 and 120 then
    raise exception 'DESCRIPCION_INVALIDA';
  end if;
  return privado.mover_caja_mayor(p_sede, p_parte, p_monto, 'admin', null, null, v_admin, p_descripcion);
end;
$$;

-- Deja la parte en p_saldo (0 = vaciar). Registra la diferencia. Devuelve el saldo.
create function public.caja_mayor_fijar(
  p_sede uuid, p_parte public.metodo_pago, p_saldo int, p_descripcion text
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := privado.exigir_admin();
  v_actual bigint;
begin
  if not exists (select 1 from public.sedes where id = p_sede) or p_parte is null then
    raise exception 'SEDE_NO_EXISTE';
  end if;
  if p_saldo is null or p_saldo < 0 or p_saldo > 999999999 then
    raise exception 'MONTO_INVALIDO';
  end if;
  if length(trim(coalesce(p_descripcion, ''))) not between 1 and 120 then
    raise exception 'DESCRIPCION_INVALIDA';
  end if;

  insert into public.caja_mayor_saldos (sede_id, parte) values (p_sede, p_parte) on conflict do nothing;
  select saldo into v_actual from public.caja_mayor_saldos
  where sede_id = p_sede and parte = p_parte
  for update;

  return privado.mover_caja_mayor(p_sede, p_parte, p_saldo - v_actual, 'admin', null, null, v_admin, p_descripcion);
end;
$$;

-- ───────────────────────── Reportes (reemplazos) ─────────────────────────

-- Cómo va la caja de un turno abierto: esperado con la regla nueva y gastos con origen
create or replace function public.rep_caja_turno(p_turno uuid) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_resultado jsonb;
begin
  if not privado.es_admin() then
    raise exception 'SOLO_ADMIN';
  end if;

  select jsonb_build_object(
    'turno_id', t.id,
    'cajero', c.nombre_completo,
    'sede', s.nombre,
    'abierto_en', t.abierto_en,
    'cerrado_en', t.cerrado_en,
    'base', t.base,
    'ventas_cantidad', x.cantidad,
    'ventas_total', x.total,
    'por_metodo', jsonb_build_object('efectivo', x.efectivo, 'transferencia', x.transferencia, 'tarjeta', x.tarjeta),
    'gastos_total', y.total,
    'gastos_caja', y.caja,
    'gastos_mayor', y.mayor,
    'esperado', t.base + x.efectivo - y.caja,
    'ultimas_ventas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', u.id, 'numero', u.numero, 'creado_en', u.creado_en, 'total', u.total, 'metodo', u.metodo)
        order by u.creado_en desc)
      from (
        select v.id, v.numero, v.creado_en, v.total, v.metodo from public.ventas v
        where v.turno_id = t.id order by v.creado_en desc limit 10
      ) u
    ), '[]'::jsonb),
    'gastos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'descripcion', g.descripcion, 'monto', g.monto, 'hora', g.creado_en,
        'monto_caja', g.monto_caja, 'monto_mayor', g.monto_mayor, 'parte_mayor', g.parte_mayor)
        order by g.creado_en)
      from public.gastos g where g.turno_id = t.id and g.anulado_en is null
    ), '[]'::jsonb)
  )
  into v_resultado
  from public.turnos t
  join public.sedes s on s.id = t.sede_id
  join public.perfiles c on c.id = t.cajero_id
  cross join lateral (
    select count(*)::bigint as cantidad,
      coalesce(sum(v.total), 0)::bigint as total,
      coalesce(sum(v.total) filter (where v.metodo = 'efectivo'), 0)::bigint as efectivo,
      coalesce(sum(v.total) filter (where v.metodo = 'transferencia'), 0)::bigint as transferencia,
      coalesce(sum(v.total) filter (where v.metodo = 'tarjeta'), 0)::bigint as tarjeta
    from public.ventas v where v.turno_id = t.id
  ) x
  cross join lateral (
    select coalesce(sum(g.monto), 0)::bigint as total,
           coalesce(sum(g.monto_caja), 0)::bigint as caja,
           coalesce(sum(g.monto_mayor), 0)::bigint as mayor
    from public.gastos g where g.turno_id = t.id and g.anulado_en is null
  ) y
  where t.id = p_turno;

  if v_resultado is null then
    raise exception 'TURNO_NO_EXISTE';
  end if;
  return v_resultado;
end;
$$;

-- Cuadre diario: "gastos" ahora son solo los de caja (así cada fila cuadra:
-- esperado = base + efectivo − gastos). Columnas nuevas: gastos_mayor y a_mayor.
drop function public.rep_cuadre_diario(uuid, date, date);
create function public.rep_cuadre_diario(p_sede uuid, p_desde date, p_hasta date)
returns table (
  fecha date, turnos int, base bigint, efectivo bigint, transferencia bigint, tarjeta bigint,
  gastos bigint, esperado bigint, contado bigint, diferencia bigint, gastos_mayor bigint, a_mayor bigint
)
language plpgsql stable security invoker set search_path = '' as $$
#variable_conflict use_column
declare
  r record;
begin
  if not privado.es_admin() then
    raise exception 'SOLO_ADMIN';
  end if;
  select * into r from privado.rango_bogota(p_desde, p_hasta);

  return query
  with t as (
    select t.id, (t.abierto_en at time zone 'America/Bogota')::date as fecha,
           t.base, t.efectivo_esperado, t.efectivo_contado, t.diferencia, t.efectivo_a_mayor
    from public.turnos t
    where t.cerrado_en is not null
      and t.abierto_en >= r.inicio and t.abierto_en < r.fin
      and (p_sede is null or t.sede_id = p_sede)
  ),
  v as (
    select v.turno_id,
      sum(v.total) filter (where v.metodo = 'efectivo') as efectivo,
      sum(v.total) filter (where v.metodo = 'transferencia') as transferencia,
      sum(v.total) filter (where v.metodo = 'tarjeta') as tarjeta
    from public.ventas v
    where v.turno_id in (select id from t)
    group by v.turno_id
  ),
  g as (
    select g.turno_id, sum(g.monto_caja) as caja, sum(g.monto_mayor) as mayor
    from public.gastos g
    where g.anulado_en is null and g.turno_id in (select id from t)
    group by g.turno_id
  )
  select t.fecha, count(*)::int,
    sum(t.base)::bigint,
    coalesce(sum(v.efectivo), 0)::bigint,
    coalesce(sum(v.transferencia), 0)::bigint,
    coalesce(sum(v.tarjeta), 0)::bigint,
    coalesce(sum(g.caja), 0)::bigint,
    sum(t.efectivo_esperado)::bigint,
    sum(t.efectivo_contado)::bigint,
    sum(t.diferencia)::bigint,
    coalesce(sum(g.mayor), 0)::bigint,
    coalesce(sum(t.efectivo_a_mayor), 0)::bigint
  from t
  left join v on v.turno_id = t.id
  left join g on g.turno_id = t.id
  group by t.fecha
  order by t.fecha;
end;
$$;

-- ───────────────────────── Permisos y RLS ─────────────────────────

revoke all on function
  public.registrar_gasto(int, text, int, public.metodo_pago),
  public.anular_gasto(uuid),
  public.caja_mayor_saldo(),
  public.base_sugerida(),
  public.cerrar_turno(uuid, int, int),
  public.caja_mayor_ajustar(uuid, public.metodo_pago, int, text),
  public.caja_mayor_fijar(uuid, public.metodo_pago, int, text),
  public.rep_caja_turno(uuid),
  public.rep_cuadre_diario(uuid, date, date)
from public, anon;

grant execute on function
  public.registrar_gasto(int, text, int, public.metodo_pago),
  public.anular_gasto(uuid),
  public.caja_mayor_saldo(),
  public.base_sugerida(),
  public.cerrar_turno(uuid, int, int),
  public.caja_mayor_ajustar(uuid, public.metodo_pago, int, text),
  public.caja_mayor_fijar(uuid, public.metodo_pago, int, text),
  public.rep_caja_turno(uuid),
  public.rep_cuadre_diario(uuid, date, date)
to authenticated;

alter table public.caja_mayor_saldos enable row level security;
alter table public.caja_mayor_movimientos enable row level security;

revoke all on public.caja_mayor_saldos, public.caja_mayor_movimientos from anon;
revoke insert, update, delete, truncate on public.caja_mayor_saldos, public.caja_mayor_movimientos from authenticated;

-- Solo el admin lee las tablas; el cajero ve su saldo con caja_mayor_saldo()
create policy caja_mayor_saldos_leer on public.caja_mayor_saldos for select to authenticated
  using (privado.es_admin());
create policy caja_mayor_mov_leer on public.caja_mayor_movimientos for select to authenticated
  using (privado.es_admin());
