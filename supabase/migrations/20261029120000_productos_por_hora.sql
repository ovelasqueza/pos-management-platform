-- Resumen y productos por hora (pedido del usuario, 2026-10-29). Solo lectura, solo admin.
-- Requiere: 01 a 07. No modifica tablas ni funciones existentes.

-- ── Vendido entre dos instantes ──
-- Para comparar con el periodo anterior "hasta la misma hora" (hoy a las 6 p. m. vs. ayer a las 6 p. m.).
create function public.rep_vendido_entre(p_sede uuid, p_inicio timestamptz, p_fin timestamptz) returns jsonb
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
    where v.creado_en >= p_inicio and v.creado_en < p_fin
      and (p_sede is null or v.sede_id = p_sede)
  );
end;
$$;

-- ── Productos que más venden y a qué hora se venden más ──
-- Top por valor vendido; hora_pico = hora del día (Bogotá) con más unidades de ese producto.
create function public.rep_productos_hora_pico(p_sede uuid, p_desde date, p_hasta date, p_limite int default 5)
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
    where v.creado_en >= r.inicio and v.creado_en < r.fin
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

-- ── Lo más vendido en cada hora ──
-- Para cada hora del día (Bogotá), los p_por_hora productos con más unidades.
create function public.rep_top_por_hora(p_sede uuid, p_desde date, p_hasta date, p_por_hora int default 3)
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
    where v.creado_en >= r.inicio and v.creado_en < r.fin
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

revoke all on function
  public.rep_vendido_entre(uuid, timestamptz, timestamptz),
  public.rep_productos_hora_pico(uuid, date, date, int),
  public.rep_top_por_hora(uuid, date, date, int)
from public, anon;

grant execute on function
  public.rep_vendido_entre(uuid, timestamptz, timestamptz),
  public.rep_productos_hora_pico(uuid, date, date, int),
  public.rep_top_por_hora(uuid, date, date, int)
to authenticated;
