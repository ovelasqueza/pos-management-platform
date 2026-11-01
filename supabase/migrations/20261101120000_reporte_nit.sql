-- El reporte de turno guarda el NIT de la sede (pedido del usuario, 2026-11-01).
-- Requiere: 12 (sedes.nit) y 16. Solo cambia privado.armar_reporte; aplica a los turnos que se cierren después.

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
