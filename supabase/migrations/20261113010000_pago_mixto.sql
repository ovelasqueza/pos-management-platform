-- Pago combinado (Efectivo + QR) en ventas, arqueo, caja mayor y reportes

alter type public.metodo_pago add value if not exists 'mixto';

alter table public.ventas
  add column if not exists monto_efectivo int,
  add column if not exists monto_transferencia int;

alter table public.ventas drop constraint if exists ventas_efectivo;
alter table public.ventas add constraint ventas_efectivo check (
  (metodo::text = 'efectivo' and recibido >= total and cambio = recibido - total)
  or (metodo::text = 'mixto'
      and monto_efectivo > 0 and monto_transferencia > 0
      and monto_efectivo + monto_transferencia = total
      and (recibido is null or (recibido >= monto_efectivo and cambio = recibido - monto_efectivo)))
  or (metodo::text not in ('efectivo', 'mixto') and recibido is null and cambio is null)
);

-- Ticket con desglose opcional de pago mixto
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
    'monto_efectivo', v.monto_efectivo,
    'monto_transferencia', v.monto_transferencia,
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

-- Reemplaza registrar_venta para aceptar monto_efectivo y monto_transferencia cuando metodo = 'mixto'
drop function if exists public.registrar_venta(uuid, public.metodo_pago, jsonb, int);

create or replace function public.registrar_venta(
  p_clave uuid,
  p_metodo public.metodo_pago,
  p_lineas jsonb,
  p_recibido int default null,
  p_monto_efectivo int default null,
  p_monto_transferencia int default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_cajero public.perfiles := privado.exigir_cajero();
  v_existente public.ventas;
  v_turno uuid;
  v_total bigint;
  v_numero int;
  v_venta uuid;
  v_monto_efectivo int := 0;
  v_monto_qr int := 0;
  v_cambio int := null;
begin
  -- Revisión rápida antes de tomar bloqueos
  select * into v_existente from public.ventas where clave = p_clave;
  if v_existente.id is not null then
    if v_existente.cajero_id <> v_cajero.id then
      raise exception 'CLAVE_INVALIDA';
    end if;
    return privado.ticket(v_existente.id);
  end if;

  -- Bloquea el turno del cajero: serializa peticiones concurrentes de la misma caja
  select id into v_turno from public.turnos
  where cajero_id = v_cajero.id and cerrado_en is null
  for update;
  if v_turno is null then
    raise exception 'TURNO_CERRADO';
  end if;

  select * into v_existente from public.ventas where clave = p_clave;
  if v_existente.id is not null then
    if v_existente.cajero_id <> v_cajero.id then
      raise exception 'CLAVE_INVALIDA';
    end if;
    return privado.ticket(v_existente.id);
  end if;

  if p_clave is null or p_metodo is null or jsonb_typeof(p_lineas) is distinct from 'array' then
    raise exception 'LINEAS_INVALIDAS';
  end if;
  if jsonb_array_length(p_lineas) not between 1 and 200 then
    raise exception 'LINEAS_INVALIDAS';
  end if;

  if exists (
       select 1 from jsonb_to_recordset(p_lineas) x(producto_id uuid, cantidad int, precio int)
       where x.producto_id is null
          or x.cantidad is null or x.cantidad not between 1 and 999
          or (x.precio is not null and x.precio not between 1 and 999999999)
     )
     or (select count(*) from jsonb_to_recordset(p_lineas) x(producto_id uuid))
        <> (select count(distinct x.producto_id) from jsonb_to_recordset(p_lineas) x(producto_id uuid)) then
    raise exception 'LINEAS_INVALIDAS';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_lineas) x(producto_id uuid, cantidad int, precio int)
    left join public.productos p on p.id = x.producto_id
    left join public.productos_sede ps
      on ps.producto_id = x.producto_id and ps.sede_id = v_cajero.sede_id
    where p.id is null or coalesce(x.precio, ps.precio_venta) is null
  ) then
    raise exception 'LINEAS_INVALIDAS';
  end if;

  select sum(x.cantidad::bigint * coalesce(x.precio, ps.precio_venta)) into v_total
  from jsonb_to_recordset(p_lineas) x(producto_id uuid, cantidad int, precio int)
  left join public.productos_sede ps on ps.producto_id = x.producto_id and ps.sede_id = v_cajero.sede_id;

  if v_total is null or v_total > 2147483647 then
    raise exception 'TOTAL_EXCEDIDO';
  end if;

  if p_metodo::text = 'efectivo' then
    if p_recibido is null or p_recibido < v_total then
      raise exception 'RECIBIDO_INSUFICIENTE';
    end if;
    v_monto_efectivo := v_total::int;
    v_monto_qr := 0;
    v_cambio := p_recibido - v_total::int;
  elsif p_metodo::text = 'mixto' then
    if p_monto_efectivo is null or p_monto_transferencia is null
       or p_monto_efectivo <= 0 or p_monto_transferencia <= 0
       or (p_monto_efectivo::bigint + p_monto_transferencia::bigint) <> v_total then
      raise exception 'PAGO_MIXTO_INVALIDO';
    end if;
    v_monto_efectivo := p_monto_efectivo;
    v_monto_qr := p_monto_transferencia;
    if p_recibido is null then
      p_recibido := v_monto_efectivo;
    elsif p_recibido < v_monto_efectivo then
      raise exception 'RECIBIDO_INSUFICIENTE';
    end if;
    v_cambio := p_recibido - v_monto_efectivo;
  elsif p_metodo::text = 'transferencia' then
    p_recibido := null;
    v_monto_efectivo := 0;
    v_monto_qr := v_total::int;
  else
    p_recibido := null;
    v_monto_efectivo := 0;
    v_monto_qr := 0;
  end if;

  insert into public.contadores_venta (sede_id, ultimo)
  values (v_cajero.sede_id, 1)
  on conflict (sede_id) do update
    set ultimo = public.contadores_venta.ultimo + 1
  returning ultimo into v_numero;

  insert into public.ventas (
    clave, numero, sede_id, turno_id, cajero_id, total, metodo, recibido, cambio, monto_efectivo, monto_transferencia
  )
  values (
    p_clave, v_numero, v_cajero.sede_id, v_turno, v_cajero.id, v_total::int, p_metodo,
    p_recibido, v_cambio, v_monto_efectivo, v_monto_qr
  )
  returning id into v_venta;

  insert into public.lineas_venta (venta_id, producto_id, nombre, precio, cantidad)
  select v_venta, x.producto_id, p.nombre, coalesce(x.precio, ps.precio_venta), x.cantidad
  from jsonb_to_recordset(p_lineas) x(producto_id uuid, cantidad int, precio int)
  join public.productos p on p.id = x.producto_id
  left join public.productos_sede ps on ps.producto_id = x.producto_id and ps.sede_id = v_cajero.sede_id;

  return privado.ticket(v_venta);
exception
  when unique_violation then
    select * into v_existente from public.ventas where clave = p_clave;
    if v_existente.id is not null and v_existente.cajero_id = v_cajero.id then
      return privado.ticket(v_existente.id);
    end if;
    raise;
end;
$$;

revoke all on function public.registrar_venta(uuid, public.metodo_pago, jsonb, int, int, int) from public, anon;
grant execute on function public.registrar_venta(uuid, public.metodo_pago, jsonb, int, int, int) to authenticated;

drop function if exists public.registrar_venta(uuid, public.metodo_pago, jsonb, int, jsonb);

create or replace function public.registrar_venta(
  p_clave uuid,
  p_metodo public.metodo_pago,
  p_lineas jsonb,
  p_recibido int,
  p_cliente jsonb,
  p_monto_efectivo int default null,
  p_monto_transferencia int default null
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
begin
  if p_cliente is not null then
    if jsonb_typeof(p_cliente) <> 'object'
       or coalesce(trim(p_cliente ->> 'documento'), '') !~ '^[0-9]{3,15}(-[0-9])?$'
       or length(trim(coalesce(p_cliente ->> 'nombre', ''))) not between 1 and 100
       or coalesce(p_cliente ->> 'tipo', 'CC') not in ('CC', 'NIT', 'CE', 'PP', 'TI') then
      raise exception 'CLIENTE_INVALIDO';
    end if;
    perform set_config('pos.cliente', p_cliente::text, true);
  end if;
  return public.registrar_venta(p_clave, p_metodo, p_lineas, p_recibido, p_monto_efectivo, p_monto_transferencia);
end;
$$;

revoke all on function public.registrar_venta(uuid, public.metodo_pago, jsonb, int, jsonb, int, int) from public, anon;
grant execute on function public.registrar_venta(uuid, public.metodo_pago, jsonb, int, jsonb, int, int) to authenticated;

-- Efectivo esperado: ventas en efectivo (incluyendo la parte en efectivo de ventas mixtas) menos gastos de caja
create or replace function privado.efectivo_esperado(p_turno uuid) returns int
language sql stable security definer set search_path = '' as $$
  select (
    coalesce((
      select sum(
        case
          when v.metodo::text = 'efectivo' then v.total
          when v.metodo::text = 'mixto' then coalesce(v.monto_efectivo, 0)
          else 0
        end
      )
      from public.ventas v
      where v.turno_id = t.id and v.anulada_en is null
    ), 0)
    - coalesce((select sum(g.monto_caja) from public.gastos g
                where g.turno_id = t.id and g.anulado_en is null), 0)
  )::int
  from public.turnos t
  where t.id = p_turno;
$$;

-- Reporte de turno con desglose de efectivo + QR de ventas mixtas
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
      'efectivo', coalesce(sum(case when v.metodo::text = 'efectivo' then v.total when v.metodo::text = 'mixto' then coalesce(v.monto_efectivo, 0) else 0 end), 0),
      'transferencia', coalesce(sum(case when v.metodo::text = 'transferencia' then v.total when v.metodo::text = 'mixto' then coalesce(v.monto_transferencia, 0) else 0 end), 0),
      'tarjeta', coalesce(sum(v.total) filter (where v.metodo::text = 'tarjeta'), 0)
    ) as por_metodo
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

-- Cierre de turno: incluye la parte QR de ventas mixtas en la caja mayor
create or replace function public.cerrar_turno(p_turno uuid, p_contado int, p_a_mayor int default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_usuario public.perfiles;
  v_turno public.turnos;
  v_esperado int;
  v_a_mayor int := coalesce(p_a_mayor, p_contado, 0);
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
    base = 0,
    cerrado_en = now(),
    cerrado_por = v_usuario.id,
    efectivo_contado = p_contado,
    efectivo_esperado = v_esperado,
    diferencia = p_contado - v_esperado,
    efectivo_a_mayor = v_a_mayor,
    reporte = v_reporte
  where id = v_turno.id;

  select coalesce(sum(case when v.metodo::text = 'transferencia' then v.total when v.metodo::text = 'mixto' then coalesce(v.monto_transferencia, 0) else 0 end), 0),
         coalesce(sum(v.total) filter (where v.metodo::text = 'tarjeta'), 0)
  into v_qr, v_tarjeta
  from public.ventas v where v.turno_id = v_turno.id and v.anulada_en is null;

  perform privado.mover_caja_mayor(v_turno.sede_id, 'efectivo', v_a_mayor, 'cierre_turno', v_turno.id, null, v_usuario.id, null);
  perform privado.mover_caja_mayor(v_turno.sede_id, 'transferencia', v_qr, 'cierre_turno', v_turno.id, null, v_usuario.id, null);
  perform privado.mover_caja_mayor(v_turno.sede_id, 'tarjeta', v_tarjeta, 'cierre_turno', v_turno.id, null, v_usuario.id, null);

  return v_reporte;
end;
$$;

-- Caja de turno para admin (con desglose mixto)
create or replace function public.rep_caja_turno(p_turno uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_resultado jsonb;
begin
  if not privado.es_admin() then
    raise exception 'SOLO_ADMIN';
  end if;

  select jsonb_build_object(
    'turno_id', t.id,
    'sede', s.nombre,
    'cajero', c.nombre_completo,
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
        'monto_efectivo', u.monto_efectivo, 'monto_transferencia', u.monto_transferencia,
        'anulada', u.anulada_en is not null, 'motivo', u.motivo_anulacion)
        order by u.creado_en desc)
      from (
        select v.id, v.numero, v.creado_en, v.total, v.metodo, v.monto_efectivo, v.monto_transferencia, v.anulada_en, v.motivo_anulacion
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
      coalesce(sum(case when v.metodo::text = 'efectivo' then v.total when v.metodo::text = 'mixto' then coalesce(v.monto_efectivo, 0) else 0 end), 0)::bigint as efectivo,
      coalesce(sum(case when v.metodo::text = 'transferencia' then v.total when v.metodo::text = 'mixto' then coalesce(v.monto_transferencia, 0) else 0 end), 0)::bigint as transferencia,
      coalesce(sum(v.total) filter (where v.metodo::text = 'tarjeta'), 0)::bigint as tarjeta
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

-- Cuadre diario con desglose mixto
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
      sum(case when v.metodo::text = 'efectivo' then v.total when v.metodo::text = 'mixto' then coalesce(v.monto_efectivo, 0) else 0 end) as efectivo,
      sum(case when v.metodo::text = 'transferencia' then v.total when v.metodo::text = 'mixto' then coalesce(v.monto_transferencia, 0) else 0 end) as transferencia,
      sum(v.total) filter (where v.metodo::text = 'tarjeta') as tarjeta
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

-- Resumen de reportes con desglose mixto
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
          'efectivo', coalesce(sum(case when v.metodo::text = 'efectivo' then v.total when v.metodo::text = 'mixto' then coalesce(v.monto_efectivo, 0) else 0 end), 0),
          'transferencia', coalesce(sum(case when v.metodo::text = 'transferencia' then v.total when v.metodo::text = 'mixto' then coalesce(v.monto_transferencia, 0) else 0 end), 0),
          'tarjeta', coalesce(sum(v.total) filter (where v.metodo::text = 'tarjeta'), 0)
        )
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
