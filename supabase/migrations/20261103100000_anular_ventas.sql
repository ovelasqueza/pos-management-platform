-- Anulación de ventas (pedido del usuario, 2026-11-02).
-- El cajero anula una venta de SU turno ABIERTO, desde el equipo del turno, con motivo obligatorio.
-- La venta no se borra: queda registrada con la hora y el motivo, y deja de contar en el esperado,
-- en lo que pasa a caja mayor, en el reporte de turno y en todos los reportes de ventas.
-- Con el turno cerrado no se puede anular. Las líneas de la venta siguen inmutables.
--
-- Requiere: 01 a 17. Reemplaza (mismas firmas, la app anterior sigue funcionando):
--   privado.efectivo_esperado, privado.ticket, privado.armar_reporte, public.cerrar_turno,
--   public.rep_caja_turno, public.rep_cuadre_diario, public.rep_resumen, public.rep_ventas_por_dia,
--   public.rep_productos, public.rep_ventas_por_hora, public.rep_vendido_entre,
--   public.rep_productos_hora_pico, public.rep_top_por_hora.
-- Nuevas: public.anular_venta y public.rep_ventas_anuladas.
-- Los turnos ya cerrados no cambian (su reporte quedó guardado).

-- ───────────────────────── Columnas ─────────────────────────

alter table public.ventas
  add column anulada_en timestamptz,
  add column motivo_anulacion text,
  add constraint ventas_anulacion check (
    (anulada_en is null and motivo_anulacion is null)
    or (anulada_en is not null and length(trim(motivo_anulacion)) between 1 and 120)
  );

create index ventas_anuladas on public.ventas (anulada_en) where anulada_en is not null;

-- ─────────────────────── Inmutabilidad ───────────────────────

-- Una venta solo cambia para anularse (una vez, con el turno abierto). No se borra.
create function privado.validar_venta() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'REGISTRO_INMUTABLE';
  end if;
  if old.anulada_en is not null or new.anulada_en is null or new.motivo_anulacion is null
     or (to_jsonb(new) - 'anulada_en' - 'motivo_anulacion')
        is distinct from (to_jsonb(old) - 'anulada_en' - 'motivo_anulacion') then
    raise exception 'REGISTRO_INMUTABLE';
  end if;
  if not exists (select 1 from public.turnos t where t.id = new.turno_id and t.cerrado_en is null) then
    raise exception 'TURNO_CERRADO';
  end if;
  return new;
end;
$$;

drop trigger ventas_inmutables on public.ventas;
create trigger ventas_inmutables before update or delete on public.ventas
  for each row execute function privado.validar_venta();

revoke all on function privado.validar_venta() from public, anon, authenticated;

-- ─────────────────────── Funciones internas ───────────────────────

-- Base + ventas vigentes en efectivo − gastos vigentes que salieron de la caja
create or replace function privado.efectivo_esperado(p_turno uuid) returns int
language sql stable security definer set search_path = '' as $$
  select (
    t.base
    + coalesce((select sum(v.total) from public.ventas v
                where v.turno_id = t.id and v.metodo = 'efectivo' and v.anulada_en is null), 0)
    - coalesce((select sum(g.monto_caja) from public.gastos g
                where g.turno_id = t.id and g.anulado_en is null), 0)
  )::int
  from public.turnos t
  where t.id = p_turno;
$$;

-- Ticket con la anulación (igual al del script 12 más anulada_en y motivo_anulacion)
create or replace function privado.ticket(p_venta uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'venta_id', v.id,
    'numero', v.numero,
    'fecha', v.creado_en,
    'sede', jsonb_build_object('nombre', s.nombre, 'nit', s.nit, 'direccion', s.direccion, 'telefono', s.telefono),
    'cajero', p.nombre_completo,
    'metodo', v.metodo,
    'total', v.total,
    'recibido', v.recibido,
    'cambio', v.cambio,
    'cliente', jsonb_build_object('tipo', v.cliente_tipo, 'documento', v.cliente_documento, 'nombre', v.cliente_nombre),
    'anulada_en', v.anulada_en,
    'motivo_anulacion', v.motivo_anulacion,
    'lineas', (
      select jsonb_agg(jsonb_build_object(
        'nombre', l.nombre, 'cantidad', l.cantidad, 'precio', l.precio,
        'subtotal', l.cantidad * l.precio) order by l.nombre)
      from public.lineas_venta l where l.venta_id = v.id
    )
  )
  from public.ventas v
  join public.sedes s on s.id = v.sede_id
  join public.perfiles p on p.id = v.cajero_id
  where v.id = p_venta;
$$;

-- Reporte de turno (igual al del script 17): sin ventas anuladas en los totales,
-- y con la lista de anuladas (número, hora, método, total, motivo)
create or replace function privado.armar_reporte(
  p_turno uuid, p_contado int, p_esperado int, p_cerrador public.perfiles, p_a_mayor int
) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'turno_id', t.id,
    'sede', jsonb_build_object('nombre', s.nombre, 'nit', s.nit, 'direccion', s.direccion, 'telefono', s.telefono),
    'cajero', c.nombre_completo,
    'abierto_en', t.abierto_en,
    'cerrado_en', now(),
    'cerrado_por_admin', case when (p_cerrador).rol = 'admin' then (p_cerrador).nombre_completo end,
    'base', t.base,
    'ventas_cantidad', (select count(*) from public.ventas v where v.turno_id = t.id and v.anulada_en is null),
    'ventas_total', (select coalesce(sum(v.total), 0) from public.ventas v where v.turno_id = t.id and v.anulada_en is null),
    'por_metodo', m.por_metodo,
    'anuladas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'numero', v.numero, 'hora', v.creado_en, 'anulada_en', v.anulada_en,
        'metodo', v.metodo, 'total', v.total, 'motivo', v.motivo_anulacion)
        order by v.numero)
      from public.ventas v where v.turno_id = t.id and v.anulada_en is not null
    ), '[]'::jsonb),
    'anuladas_total', (
      select coalesce(sum(v.total), 0) from public.ventas v
      where v.turno_id = t.id and v.anulada_en is not null
    ),
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
        where v.turno_id = t.id and v.anulada_en is null
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
    from public.ventas v where v.turno_id = t.id and v.anulada_en is null
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

-- Anula una venta del turno abierto del cajero. Devuelve el ticket (con la marca de anulada).
-- Si la venta ya estaba anulada (reintento por red) devuelve el ticket sin cambiar nada.
create function public.anular_venta(p_venta uuid, p_motivo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_cajero public.perfiles := privado.exigir_cajero();
  v_venta public.ventas;
  v_turno public.turnos;
begin
  select * into v_venta from public.ventas where id = p_venta;
  if v_venta.id is null or v_venta.cajero_id <> v_cajero.id then
    raise exception 'VENTA_NO_ANULABLE';
  end if;

  -- Bloquea el turno: serializa con ventas, gastos y cierre
  select * into v_turno from public.turnos where id = v_venta.turno_id for update;
  if v_turno.cerrado_en is not null then
    raise exception 'TURNO_CERRADO';
  end if;
  perform privado.exigir_equipo_del_turno(v_turno.id);

  if v_venta.anulada_en is not null then
    return privado.ticket(v_venta.id);
  end if;

  if length(trim(coalesce(p_motivo, ''))) not between 1 and 120 then
    raise exception 'MOTIVO_INVALIDO';
  end if;
  -- El esperado no puede quedar negativo (no se informa el valor: arqueo ciego)
  if v_venta.metodo = 'efectivo' and privado.efectivo_esperado(v_turno.id) - v_venta.total < 0 then
    raise exception 'EFECTIVO_INSUFICIENTE';
  end if;

  update public.ventas set anulada_en = now(), motivo_anulacion = trim(p_motivo)
  where id = v_venta.id;

  return privado.ticket(v_venta.id);
end;
$$;

revoke all on function public.anular_venta(uuid, text) from public, anon;
grant execute on function public.anular_venta(uuid, text) to authenticated;

-- ───────────────────────── Cierre de turno ─────────────────────────

-- Igual al del script 15: QR y tarjeta que pasan a caja mayor sin ventas anuladas
create or replace function public.cerrar_turno(p_turno uuid, p_contado int, p_a_mayor int default 0) returns jsonb
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
  from public.ventas v where v.turno_id = v_turno.id and v.anulada_en is null;

  -- Siempre en el mismo orden de partes (evita bloqueos cruzados)
  perform privado.mover_caja_mayor(v_turno.sede_id, 'efectivo', v_a_mayor, 'cierre_turno', v_turno.id, null, v_usuario.id, null);
  perform privado.mover_caja_mayor(v_turno.sede_id, 'transferencia', v_qr, 'cierre_turno', v_turno.id, null, v_usuario.id, null);
  perform privado.mover_caja_mayor(v_turno.sede_id, 'tarjeta', v_tarjeta, 'cierre_turno', v_turno.id, null, v_usuario.id, null);

  return v_reporte;
end;
$$;

-- ───────────────────────── Reportes (reemplazos) ─────────────────────────

-- Caja de un turno (igual al del script 16): sin anuladas en los totales;
-- las últimas ventas traen la marca "anulada" y se agregan anuladas_cantidad / anuladas_total
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
    'anuladas_cantidad', z.cantidad,
    'anuladas_total', z.total,
    'gastos_total', y.total,
    'gastos_caja', y.caja,
    'gastos_mayor', y.mayor,
    'esperado', t.base + x.efectivo - y.caja,
    'ultimas_ventas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', u.id, 'numero', u.numero, 'creado_en', u.creado_en, 'total', u.total, 'metodo', u.metodo,
        'anulada', u.anulada_en is not null, 'motivo', u.motivo_anulacion)
        order by u.creado_en desc)
      from (
        select v.id, v.numero, v.creado_en, v.total, v.metodo, v.anulada_en, v.motivo_anulacion
        from public.ventas v
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
    from public.ventas v where v.turno_id = t.id and v.anulada_en is null
  ) x
  cross join lateral (
    select count(*)::bigint as cantidad, coalesce(sum(v.total), 0)::bigint as total
    from public.ventas v where v.turno_id = t.id and v.anulada_en is not null
  ) z
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

-- Cuadre diario (igual al del script 15) sin ventas anuladas
create or replace function public.rep_cuadre_diario(p_sede uuid, p_desde date, p_hasta date)
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
    where v.turno_id in (select id from t) and v.anulada_en is null
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

-- Resumen (igual al del script 04) sin ventas anuladas
create or replace function public.rep_resumen(p_sede uuid, p_desde date, p_hasta date) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  r record;
  v_por_sede jsonb;
begin
  if not privado.es_admin() then
    raise exception 'SOLO_ADMIN';
  end if;
  select * into r from privado.rango_bogota(p_desde, p_hasta);

  with ventas as (
    select v.sede_id, v.total, v.metodo from public.ventas v
    where v.creado_en >= r.inicio and v.creado_en < r.fin and v.anulada_en is null
      and (p_sede is null or v.sede_id = p_sede)
  ),
  gastos as (
    select t.sede_id, g.monto from public.gastos g
    join public.turnos t on t.id = g.turno_id
    where g.anulado_en is null and g.creado_en >= r.inicio and g.creado_en < r.fin
      and (p_sede is null or t.sede_id = p_sede)
  ),
  por_sede as (
    select s.id, s.nombre, s.activa,
      coalesce((select sum(v.total) from ventas v where v.sede_id = s.id), 0) as total,
      (select count(*) from ventas v where v.sede_id = s.id) as cantidad,
      coalesce((select sum(g.monto) from gastos g where g.sede_id = s.id), 0) as gastos
    from public.sedes s
    where p_sede is null or s.id = p_sede
  )
  select jsonb_agg(jsonb_build_object(
      'sede_id', id, 'nombre', nombre, 'total', total, 'cantidad', cantidad, 'gastos', gastos)
      order by activa desc, nombre)
  into v_por_sede
  from por_sede;

  return (
    select jsonb_build_object(
      'total', coalesce(sum((x->>'total')::bigint), 0),
      'cantidad', coalesce(sum((x->>'cantidad')::bigint), 0),
      'gastos', coalesce(sum((x->>'gastos')::bigint), 0),
      'por_metodo', (
        select jsonb_build_object(
          'efectivo', coalesce(sum(v.total) filter (where v.metodo = 'efectivo'), 0),
          'transferencia', coalesce(sum(v.total) filter (where v.metodo = 'transferencia'), 0),
          'tarjeta', coalesce(sum(v.total) filter (where v.metodo = 'tarjeta'), 0))
        from public.ventas v
        where v.creado_en >= r.inicio and v.creado_en < r.fin and v.anulada_en is null
          and (p_sede is null or v.sede_id = p_sede)
      ),
      'por_sede', coalesce(v_por_sede, '[]'::jsonb)
    )
    from jsonb_array_elements(coalesce(v_por_sede, '[]'::jsonb)) x
  );
end;
$$;

-- Ventas por día (igual al del script 04) sin ventas anuladas
create or replace function public.rep_ventas_por_dia(p_sede uuid, p_desde date, p_hasta date)
returns table (fecha date, total bigint)
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
  select d::date, coalesce(sum(v.total), 0)::bigint
  from generate_series(p_desde::timestamp, p_hasta::timestamp, interval '1 day') d
  left join public.ventas v
    on (v.creado_en at time zone 'America/Bogota')::date = d::date
   and v.creado_en >= r.inicio and v.creado_en < r.fin
   and v.anulada_en is null
   and (p_sede is null or v.sede_id = p_sede)
  group by d
  order by d;
end;
$$;

-- Ventas por producto (igual al del script 04) sin ventas anuladas
create or replace function public.rep_productos(p_sede uuid, p_desde date, p_hasta date)
returns table (producto_id uuid, nombre text, tipo public.tipo_sede, unidades bigint, valor bigint, por_sede jsonb)
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
  with lineas as (
    select l.producto_id, v.sede_id, sum(l.cantidad)::bigint as unidades,
           sum(l.cantidad::bigint * l.precio)::bigint as valor
    from public.lineas_venta l
    join public.ventas v on v.id = l.venta_id
    where v.creado_en >= r.inicio and v.creado_en < r.fin and v.anulada_en is null
      and (p_sede is null or v.sede_id = p_sede)
    group by l.producto_id, v.sede_id
  )
  select p.id, p.nombre, p.tipo, sum(x.unidades)::bigint, sum(x.valor)::bigint,
    jsonb_agg(jsonb_build_object('sede', s.nombre, 'unidades', x.unidades) order by s.nombre)
  from lineas x
  join public.productos p on p.id = x.producto_id
  join public.sedes s on s.id = x.sede_id
  group by p.id, p.nombre, p.tipo;
end;
$$;

-- Ventas por hora (igual al del script 07) sin ventas anuladas
create or replace function public.rep_ventas_por_hora(p_sede uuid, p_desde date, p_hasta date)
returns table (hora int, ventas bigint, total bigint)
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
  select extract(hour from v.creado_en at time zone 'America/Bogota')::int as h,
         count(*)::bigint, sum(v.total)::bigint
  from public.ventas v
  where v.creado_en >= r.inicio and v.creado_en < r.fin and v.anulada_en is null
    and (p_sede is null or v.sede_id = p_sede)
  group by h
  order by h;
end;
$$;

-- Vendido entre dos instantes (igual al del script 09) sin ventas anuladas
create or replace function public.rep_vendido_entre(p_sede uuid, p_inicio timestamptz, p_fin timestamptz) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
begin
  if not privado.es_admin() then
    raise exception 'SOLO_ADMIN';
  end if;
  if p_inicio is null or p_fin is null or p_inicio > p_fin then
    raise exception 'RANGO_INVALIDO';
  end if;
  if p_fin - p_inicio > interval '367 days' then
    raise exception 'RANGO_MUY_LARGO';
  end if;

  return (
    select jsonb_build_object('total', coalesce(sum(v.total), 0), 'cantidad', count(*))
    from public.ventas v
    where v.creado_en >= p_inicio and v.creado_en < p_fin and v.anulada_en is null
      and (p_sede is null or v.sede_id = p_sede)
  );
end;
$$;

-- Productos y hora pico (igual al del script 09) sin ventas anuladas
create or replace function public.rep_productos_hora_pico(p_sede uuid, p_desde date, p_hasta date, p_limite int default 5)
returns table (producto_id uuid, nombre text, unidades bigint, valor bigint, hora_pico int, unidades_pico bigint)
language plpgsql stable security invoker set search_path = '' as $$
#variable_conflict use_column
declare
  r record;
begin
  if not privado.es_admin() then
    raise exception 'SOLO_ADMIN';
  end if;
  if p_limite is null or p_limite not between 1 and 50 then
    raise exception 'LIMITE_INVALIDO';
  end if;
  select * into r from privado.rango_bogota(p_desde, p_hasta);

  return query
  with x as (
    select l.producto_id as pid,
           extract(hour from v.creado_en at time zone 'America/Bogota')::int as h,
           sum(l.cantidad)::bigint as u,
           sum(l.cantidad::bigint * l.precio)::bigint as val
    from public.lineas_venta l
    join public.ventas v on v.id = l.venta_id
    where v.creado_en >= r.inicio and v.creado_en < r.fin and v.anulada_en is null
      and (p_sede is null or v.sede_id = p_sede)
    group by 1, 2
  ),
  tot as (
    select pid, sum(u)::bigint as u, sum(val)::bigint as val
    from x group by pid
    order by val desc, u desc
    limit p_limite
  ),
  pico as (
    select distinct on (x.pid) x.pid, x.h, x.u
    from x
    where x.pid in (select pid from tot)
    order by x.pid, x.u desc, x.h
  )
  select p.id, p.nombre, tot.u, tot.val, pico.h, pico.u
  from tot
  join pico on pico.pid = tot.pid
  join public.productos p on p.id = tot.pid
  order by tot.val desc, tot.u desc;
end;
$$;

-- Lo más vendido en cada hora (igual al del script 09) sin ventas anuladas
create or replace function public.rep_top_por_hora(p_sede uuid, p_desde date, p_hasta date, p_por_hora int default 3)
returns table (hora int, puesto int, producto_id uuid, nombre text, unidades bigint, valor bigint)
language plpgsql stable security invoker set search_path = '' as $$
#variable_conflict use_column
declare
  r record;
begin
  if not privado.es_admin() then
    raise exception 'SOLO_ADMIN';
  end if;
  if p_por_hora is null or p_por_hora not between 1 and 10 then
    raise exception 'LIMITE_INVALIDO';
  end if;
  select * into r from privado.rango_bogota(p_desde, p_hasta);

  return query
  with x as (
    select extract(hour from v.creado_en at time zone 'America/Bogota')::int as h,
           l.producto_id as pid,
           sum(l.cantidad)::bigint as u,
           sum(l.cantidad::bigint * l.precio)::bigint as val
    from public.lineas_venta l
    join public.ventas v on v.id = l.venta_id
    where v.creado_en >= r.inicio and v.creado_en < r.fin and v.anulada_en is null
      and (p_sede is null or v.sede_id = p_sede)
    group by 1, 2
  ),
  ranked as (
    select x.*, row_number() over (partition by x.h order by x.u desc, x.val desc) as rn
    from x
  )
  select ranked.h, ranked.rn::int, p.id, p.nombre, ranked.u, ranked.val
  from ranked
  join public.productos p on p.id = ranked.pid
  where ranked.rn <= p_por_hora
  order by ranked.h, ranked.rn;
end;
$$;

-- ───────────────────────── Reporte nuevo ─────────────────────────

-- Ventas anuladas con hora de anulación en el rango (Bogotá). Solo admin.
create function public.rep_ventas_anuladas(p_sede uuid, p_desde date, p_hasta date)
returns table (
  venta_id uuid, numero int, creado_en timestamptz, anulada_en timestamptz,
  sede text, cajero text, metodo public.metodo_pago, total int, motivo text
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
  select v.id, v.numero, v.creado_en, v.anulada_en, s.nombre, p.nombre_completo, v.metodo, v.total, v.motivo_anulacion
  from public.ventas v
  join public.sedes s on s.id = v.sede_id
  join public.perfiles p on p.id = v.cajero_id
  where v.anulada_en is not null
    and v.anulada_en >= r.inicio and v.anulada_en < r.fin
    and (p_sede is null or v.sede_id = p_sede)
  order by v.anulada_en desc;
end;
$$;

revoke all on function public.rep_ventas_anuladas(uuid, date, date) from public, anon;
grant execute on function public.rep_ventas_anuladas(uuid, date, date) to authenticated;
