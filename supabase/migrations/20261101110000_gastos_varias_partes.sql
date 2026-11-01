-- Spec 06 · ajuste (pedido del usuario, 2026-11-01): un gasto pagado con caja mayor
-- puede salir de varias partes a la vez (Efectivo, QR y Tarjeta), con un monto por parte.
-- Requiere: 15. Reemplaza gastos.parte_mayor por mayor_efectivo / mayor_transferencia / mayor_tarjeta.
-- Los gastos existentes conservan su parte. La versión de registrar_gasto de 4 argumentos
-- (app anterior) sigue funcionando: guarda todo en la parte indicada.

-- ───────────────────────── Columnas ─────────────────────────

alter table public.gastos
  add column mayor_efectivo int not null default 0,
  add column mayor_transferencia int not null default 0,
  add column mayor_tarjeta int not null default 0;

-- Pasar la parte de los gastos existentes (los triggers de inmutabilidad y de equipo
-- se suspenden solo para esta copia)
alter table public.gastos disable trigger gastos_inmutables;
alter table public.gastos disable trigger gastos_equipo;
update public.gastos set
  mayor_efectivo = case when parte_mayor = 'efectivo' then monto_mayor else 0 end,
  mayor_transferencia = case when parte_mayor = 'transferencia' then monto_mayor else 0 end,
  mayor_tarjeta = case when parte_mayor = 'tarjeta' then monto_mayor else 0 end
where monto_mayor > 0;
alter table public.gastos enable trigger gastos_inmutables;
alter table public.gastos enable trigger gastos_equipo;

alter table public.gastos drop constraint gastos_parte_mayor;
alter table public.gastos drop column parte_mayor;
alter table public.gastos add constraint gastos_partes_mayor check (
  mayor_efectivo >= 0 and mayor_transferencia >= 0 and mayor_tarjeta >= 0
  and monto_mayor = mayor_efectivo + mayor_transferencia + mayor_tarjeta
);

-- ─────────────────────── Funciones internas ───────────────────────

-- Un gasto solo cambia para anularse (una vez). No se borra.
create or replace function privado.validar_gasto() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'REGISTRO_INMUTABLE';
  end if;
  if old.anulado_en is not null or new.anulado_en is null
     or new.turno_id <> old.turno_id or new.monto <> old.monto or new.monto_mayor <> old.monto_mayor
     or new.mayor_efectivo <> old.mayor_efectivo or new.mayor_transferencia <> old.mayor_transferencia
     or new.mayor_tarjeta <> old.mayor_tarjeta
     or new.descripcion <> old.descripcion or new.creado_en <> old.creado_en then
    raise exception 'REGISTRO_INMUTABLE';
  end if;
  return new;
end;
$$;

-- Igual que en el 15, pero el error dice qué parte no alcanza (CAJA_MAYOR_INSUFICIENTE: QR)
create or replace function privado.mover_caja_mayor(
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
      raise exception 'CAJA_MAYOR_INSUFICIENTE: %',
        case p_parte when 'efectivo' then 'Efectivo' when 'transferencia' then 'QR' else 'Tarjeta' end;
  end;

  insert into public.caja_mayor_movimientos
    (sede_id, parte, tipo, monto, saldo_despues, turno_id, gasto_id, usuario_id, descripcion)
  values
    (p_sede, p_parte, p_tipo, p_monto, v_saldo, p_turno, p_gasto, p_usuario, nullif(trim(p_descripcion), ''));
  return v_saldo;
end;
$$;

-- Reporte de turno: cada gasto trae lo que salió de cada parte de la caja mayor
create or replace function privado.armar_reporte(
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
        'monto_caja', g.monto_caja, 'monto_mayor', g.monto_mayor,
        'mayor', jsonb_build_object(
          'efectivo', g.mayor_efectivo, 'transferencia', g.mayor_transferencia, 'tarjeta', g.mayor_tarjeta))
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

-- ───────────────────────── RPC del cajero ─────────────────────────

-- p_monto: total del gasto. p_mayor_*: cuánto sale de cada parte de la caja mayor.
-- Lo que no sale de la caja mayor sale del cajón.
create function public.registrar_gasto(
  p_monto int, p_descripcion text, p_mayor_efectivo int, p_mayor_transferencia int, p_mayor_tarjeta int
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_cajero public.perfiles := privado.exigir_cajero();
  v_turno uuid;
  v_e int := coalesce(p_mayor_efectivo, 0);
  v_q int := coalesce(p_mayor_transferencia, 0);
  v_t int := coalesce(p_mayor_tarjeta, 0);
  v_mayor bigint;
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
  v_mayor := v_e::bigint + v_q + v_t;
  if v_e < 0 or v_q < 0 or v_t < 0 or v_mayor > p_monto then
    raise exception 'ORIGEN_INVALIDO';
  end if;
  -- No se informa el valor del esperado (arqueo ciego)
  if p_monto - v_mayor > privado.efectivo_esperado(v_turno) then
    raise exception 'EFECTIVO_INSUFICIENTE';
  end if;

  insert into public.gastos
    (turno_id, monto, descripcion, monto_mayor, mayor_efectivo, mayor_transferencia, mayor_tarjeta)
  values (v_turno, p_monto, trim(p_descripcion), v_mayor, v_e, v_q, v_t)
  returning id into v_id;

  -- Siempre en el mismo orden de partes (evita bloqueos cruzados)
  perform privado.mover_caja_mayor(v_cajero.sede_id, 'efectivo', -v_e, 'gasto', v_turno, v_id, v_cajero.id, trim(p_descripcion));
  perform privado.mover_caja_mayor(v_cajero.sede_id, 'transferencia', -v_q, 'gasto', v_turno, v_id, v_cajero.id, trim(p_descripcion));
  perform privado.mover_caja_mayor(v_cajero.sede_id, 'tarjeta', -v_t, 'gasto', v_turno, v_id, v_cajero.id, trim(p_descripcion));
  return v_id;
end;
$$;

-- Versión de la app anterior (una sola parte): pasa a la nueva
create or replace function public.registrar_gasto(
  p_monto int, p_descripcion text, p_monto_mayor int default 0, p_parte_mayor public.metodo_pago default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_mayor int := coalesce(p_monto_mayor, 0);
begin
  if v_mayor > 0 and p_parte_mayor is null then
    raise exception 'ORIGEN_INVALIDO';
  end if;
  return public.registrar_gasto(
    p_monto, p_descripcion,
    case when p_parte_mayor = 'efectivo' then v_mayor else 0 end,
    case when p_parte_mayor = 'transferencia' then v_mayor else 0 end,
    case when p_parte_mayor = 'tarjeta' then v_mayor else 0 end);
end;
$$;

-- Anular devuelve a cada parte de la caja mayor lo que salió de ella
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

  perform privado.mover_caja_mayor(v_turno.sede_id, 'efectivo', v_gasto.mayor_efectivo, 'anulacion_gasto',
    v_turno.id, v_gasto.id, v_cajero.id, v_gasto.descripcion);
  perform privado.mover_caja_mayor(v_turno.sede_id, 'transferencia', v_gasto.mayor_transferencia, 'anulacion_gasto',
    v_turno.id, v_gasto.id, v_cajero.id, v_gasto.descripcion);
  perform privado.mover_caja_mayor(v_turno.sede_id, 'tarjeta', v_gasto.mayor_tarjeta, 'anulacion_gasto',
    v_turno.id, v_gasto.id, v_cajero.id, v_gasto.descripcion);
end;
$$;

-- ───────────────────────── Reporte en vivo ─────────────────────────

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
        'monto_caja', g.monto_caja, 'monto_mayor', g.monto_mayor,
        'mayor', jsonb_build_object(
          'efectivo', g.mayor_efectivo, 'transferencia', g.mayor_transferencia, 'tarjeta', g.mayor_tarjeta))
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

-- ───────────────────────── Permisos ─────────────────────────

revoke all on function public.registrar_gasto(int, text, int, int, int) from public, anon;
grant execute on function public.registrar_gasto(int, text, int, int, int) to authenticated;
