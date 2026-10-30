-- Spec 04: reportes del admin
-- Requiere: 01, 02 y 03.
-- Fechas en America/Bogota. p_sede null = todas las sedes. Rango inclusivo [p_desde, p_hasta].

create index if not exists gastos_creado on public.gastos (creado_en);
create index if not exists ventas_creado on public.ventas (creado_en);

-- Valida el rango y lo convierte a instantes [inicio, fin)
create function privado.rango_bogota(p_desde date, p_hasta date, out inicio timestamptz, out fin timestamptz)
language plpgsql stable set search_path = '' as $$
begin
  if p_desde is null or p_hasta is null or p_desde > p_hasta then
    raise exception 'RANGO_INVALIDO';
  end if;
  if p_hasta - p_desde > 366 then
    raise exception 'RANGO_MUY_LARGO';
  end if;
  inicio := p_desde::timestamp at time zone 'America/Bogota';
  fin := (p_hasta + 1)::timestamp at time zone 'America/Bogota';
end;
$$;
grant execute on function privado.rango_bogota(date, date) to authenticated;

-- Totales del periodo y desglose por sede
create function public.rep_resumen(p_sede uuid, p_desde date, p_hasta date) returns jsonb
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
    where v.creado_en >= r.inicio and v.creado_en < r.fin
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
        where v.creado_en >= r.inicio and v.creado_en < r.fin
          and (p_sede is null or v.sede_id = p_sede)
      ),
      'por_sede', coalesce(v_por_sede, '[]'::jsonb)
    )
    from jsonb_array_elements(coalesce(v_por_sede, '[]'::jsonb)) x
  );
end;
$$;

-- Total vendido por día (incluye días sin ventas)
create function public.rep_ventas_por_dia(p_sede uuid, p_desde date, p_hasta date)
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
   and (p_sede is null or v.sede_id = p_sede)
  group by d
  order by d;
end;
$$;

-- Unidades y valor vendidos por producto (con desglose por sede)
create function public.rep_productos(p_sede uuid, p_desde date, p_hasta date)
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
    where v.creado_en >= r.inicio and v.creado_en < r.fin
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

revoke all on function
  public.rep_resumen(uuid, date, date),
  public.rep_ventas_por_dia(uuid, date, date),
  public.rep_productos(uuid, date, date)
from public, anon;

grant execute on function
  public.rep_resumen(uuid, date, date),
  public.rep_ventas_por_dia(uuid, date, date),
  public.rep_productos(uuid, date, date)
to authenticated;
