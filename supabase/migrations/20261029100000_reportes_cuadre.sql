-- Reportes nuevos (pedido del usuario, 2026-10-29). Solo lectura, solo admin.
-- Requiere: 01 a 04 (usa privado.es_admin y privado.rango_bogota).
-- No modifica tablas ni funciones existentes.

-- Índice para agrupar turnos cerrados por fecha de apertura
create index if not exists turnos_apertura on public.turnos (abierto_en);

-- ── Cuadre diario ──
-- Una fila por día (fecha de APERTURA del turno, en Bogotá). Solo turnos cerrados:
-- son los que ya tienen efectivo contado. Cada fila cuadra sola:
-- esperado = base + efectivo − gastos;  diferencia = contado − esperado.
create function public.rep_cuadre_diario(p_sede uuid, p_desde date, p_hasta date)
returns table (
  fecha date, turnos int, base bigint, efectivo bigint, transferencia bigint, tarjeta bigint,
  gastos bigint, esperado bigint, contado bigint, diferencia bigint
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
           t.base, t.efectivo_esperado, t.efectivo_contado, t.diferencia
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
    select g.turno_id, sum(g.monto) as monto
    from public.gastos g
    where g.anulado_en is null and g.turno_id in (select id from t)
    group by g.turno_id
  )
  select t.fecha, count(*)::int,
    sum(t.base)::bigint,
    coalesce(sum(v.efectivo), 0)::bigint,
    coalesce(sum(v.transferencia), 0)::bigint,
    coalesce(sum(v.tarjeta), 0)::bigint,
    coalesce(sum(g.monto), 0)::bigint,
    sum(t.efectivo_esperado)::bigint,
    sum(t.efectivo_contado)::bigint,
    sum(t.diferencia)::bigint
  from t
  left join v on v.turno_id = t.id
  left join g on g.turno_id = t.id
  group by t.fecha
  order by t.fecha;
end;
$$;

-- ── Diferencias por cajero ──
-- Turnos cerrados con apertura en el rango. Faltantes y sobrantes por separado
-- (en el neto se compensarían y ocultarían el problema).
create function public.rep_diferencias_cajero(p_sede uuid, p_desde date, p_hasta date)
returns table (
  cajero_id uuid, cajero text, turnos int, cuadrados int,
  faltantes int, faltante bigint, sobrantes int, sobrante bigint, neto bigint
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
  select t.cajero_id, p.nombre_completo, count(*)::int,
    (count(*) filter (where t.diferencia = 0))::int,
    (count(*) filter (where t.diferencia < 0))::int,
    coalesce(sum(t.diferencia) filter (where t.diferencia < 0), 0)::bigint,
    (count(*) filter (where t.diferencia > 0))::int,
    coalesce(sum(t.diferencia) filter (where t.diferencia > 0), 0)::bigint,
    coalesce(sum(t.diferencia), 0)::bigint
  from public.turnos t
  join public.perfiles p on p.id = t.cajero_id
  where t.cerrado_en is not null
    and t.abierto_en >= r.inicio and t.abierto_en < r.fin
    and (p_sede is null or t.sede_id = p_sede)
  group by t.cajero_id, p.nombre_completo
  order by 6, 2; -- primero el mayor faltante
end;
$$;

-- ── Ventas por hora del día (Bogotá) ──
create function public.rep_ventas_por_hora(p_sede uuid, p_desde date, p_hasta date)
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
  where v.creado_en >= r.inicio and v.creado_en < r.fin
    and (p_sede is null or v.sede_id = p_sede)
  group by h
  order by h;
end;
$$;

-- ── Caja de un turno en vivo (para ver cómo va un turno abierto) ──
-- Mismo cálculo que privado.efectivo_esperado, sin depender de esa función.
create function public.rep_caja_turno(p_turno uuid) returns jsonb
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
    'esperado', t.base + x.efectivo - y.total,
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
      select jsonb_agg(jsonb_build_object('descripcion', g.descripcion, 'monto', g.monto, 'hora', g.creado_en)
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
    select coalesce(sum(g.monto), 0)::bigint as total
    from public.gastos g where g.turno_id = t.id and g.anulado_en is null
  ) y
  where t.id = p_turno;

  if v_resultado is null then
    raise exception 'TURNO_NO_EXISTE';
  end if;
  return v_resultado;
end;
$$;

revoke all on function
  public.rep_cuadre_diario(uuid, date, date),
  public.rep_diferencias_cajero(uuid, date, date),
  public.rep_ventas_por_hora(uuid, date, date),
  public.rep_caja_turno(uuid)
from public, anon;

grant execute on function
  public.rep_cuadre_diario(uuid, date, date),
  public.rep_diferencias_cajero(uuid, date, date),
  public.rep_ventas_por_hora(uuid, date, date),
  public.rep_caja_turno(uuid)
to authenticated;

