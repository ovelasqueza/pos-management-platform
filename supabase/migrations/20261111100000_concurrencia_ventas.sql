-- Blindaje de concurrencia en ventas simultáneas (2026-11-11).
-- Garantiza que:
-- 1. Varias cajas de distintas sedes vendan en simultáneo sin bloqueos entre sí
--    (cada sede tiene su propia fila en contadores_venta y cada cajero su propio turno).
-- 2. Si llegan dos peticiones al mismo tiempo desde la misma caja con la misma clave
--    (doble toque, doble Enter o reintento de red mientras la primera sigue en vuelo),
--    la segunda espera el bloqueo FOR UPDATE del turno y luego vuelve a consultar
--    ventas por clave, devolviendo el ticket existente sin lanzar error 23505 ni duplicar.

create or replace function public.registrar_venta(
  p_clave uuid, p_metodo public.metodo_pago, p_lineas jsonb, p_recibido int default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_cajero public.perfiles := privado.exigir_cajero();
  v_existente public.ventas;
  v_turno uuid;
  v_total bigint;
  v_numero int;
  v_venta uuid;
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

  -- Segunda revisión tras adquirir el bloqueo del turno: si otra petición idéntica
  -- terminó mientras esta esperaba el FOR UPDATE, devuelve su ticket sin duplicar
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
       where x.producto_id is null or x.cantidad is null or x.cantidad not between 1 and 999
     )
     or (select count(*) from jsonb_to_recordset(p_lineas) x(producto_id uuid))
        <> (select count(distinct x.producto_id) from jsonb_to_recordset(p_lineas) x(producto_id uuid)) then
    raise exception 'LINEAS_INVALIDAS';
  end if;

  -- Cada producto debe seguir a la venta y con el mismo precio que vio el cajero
  if exists (
    select 1
    from jsonb_to_recordset(p_lineas) x(producto_id uuid, cantidad int, precio int)
    left join public.productos_sede ps
      on ps.producto_id = x.producto_id and ps.sede_id = v_cajero.sede_id and ps.habilitado
    left join public.productos p on p.id = ps.producto_id and p.activo
    where p.id is null or ps.precio_venta is distinct from x.precio
  ) then
    raise exception 'PRECIOS_ACTUALIZADOS';
  end if;

  -- Total con los precios de la BD
  select sum(x.cantidad::bigint * ps.precio_venta) into v_total
  from jsonb_to_recordset(p_lineas) x(producto_id uuid, cantidad int)
  join public.productos_sede ps on ps.producto_id = x.producto_id and ps.sede_id = v_cajero.sede_id;

  if v_total > 2147483647 then
    raise exception 'TOTAL_EXCEDIDO';
  end if;

  if p_metodo = 'efectivo' then
    if p_recibido is null or p_recibido < v_total then
      raise exception 'RECIBIDO_INSUFICIENTE';
    end if;
  else
    p_recibido := null;
  end if;

  update public.contadores_venta set ultimo = ultimo + 1
  where sede_id = v_cajero.sede_id
  returning ultimo into v_numero;

  insert into public.ventas (clave, numero, sede_id, turno_id, cajero_id, total, metodo, recibido, cambio)
  values (
    p_clave, v_numero, v_cajero.sede_id, v_turno, v_cajero.id, v_total::int, p_metodo,
    p_recibido, case when p_recibido is null then null else p_recibido - v_total::int end
  )
  returning id into v_venta;

  insert into public.lineas_venta (venta_id, producto_id, nombre, precio, cantidad)
  select v_venta, x.producto_id, p.nombre, ps.precio_venta, x.cantidad
  from jsonb_to_recordset(p_lineas) x(producto_id uuid, cantidad int)
  join public.productos_sede ps on ps.producto_id = x.producto_id and ps.sede_id = v_cajero.sede_id
  join public.productos p on p.id = x.producto_id;

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
