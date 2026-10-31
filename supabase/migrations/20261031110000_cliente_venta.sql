-- Cliente de la venta (pedido del usuario, 2026-10-31).
-- Por defecto "Consumidor Final" con documento 222222222222 (el que usa la DIAN cuando
-- el cliente no da sus datos). Opcionalmente se registran tipo, número y nombre.
-- Las ventas existentes quedan como Consumidor Final.
-- No modifica public.registrar_venta: se agrega una versión con p_cliente que la llama.
-- Requiere: 20261028120000_caja.sql

-- Las ventas son inmutables (trigger ventas_inmutables); se apaga solo para agregar columnas
alter table public.ventas disable trigger ventas_inmutables;

alter table public.ventas
  add column cliente_tipo text not null default 'CC'
    check (cliente_tipo in ('CC', 'NIT', 'CE', 'PP', 'TI')),
  add column cliente_documento text not null default '222222222222'
    check (cliente_documento ~ '^[0-9]{3,15}(-[0-9])?$'),
  add column cliente_nombre text not null default 'Consumidor Final'
    check (length(trim(cliente_nombre)) between 1 and 100);

alter table public.ventas enable trigger ventas_inmutables;

-- Toma el cliente de la variable de la transacción (la fija registrar_venta con p_cliente)
create function privado.venta_cliente() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_texto text := current_setting('pos.cliente', true);
  v jsonb;
begin
  if v_texto is null or v_texto = '' then
    return new; -- Consumidor Final (valores por defecto)
  end if;
  v := v_texto::jsonb;
  new.cliente_tipo := coalesce(nullif(trim(v ->> 'tipo'), ''), 'CC');
  new.cliente_documento := coalesce(nullif(trim(v ->> 'documento'), ''), '222222222222');
  new.cliente_nombre := coalesce(nullif(trim(v ->> 'nombre'), ''), 'Consumidor Final');
  return new;
exception
  when invalid_text_representation then
    raise exception 'CLIENTE_INVALIDO';
end;
$$;

create trigger ventas_cliente before insert on public.ventas
  for each row execute function privado.venta_cliente();

-- Venta con cliente: misma lógica, mismas validaciones (llama a la función existente)
create function public.registrar_venta(
  p_clave uuid, p_metodo public.metodo_pago, p_lineas jsonb, p_recibido int, p_cliente jsonb
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
    perform set_config('pos.cliente', p_cliente::text, true); -- solo esta transacción
  end if;
  return public.registrar_venta(p_clave, p_metodo, p_lineas, p_recibido);
end;
$$;

revoke all on function public.registrar_venta(uuid, public.metodo_pago, jsonb, int, jsonb) from public, anon;
grant execute on function public.registrar_venta(uuid, public.metodo_pago, jsonb, int, jsonb) to authenticated;

-- Ticket con el cliente
create or replace function privado.ticket(p_venta uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'venta_id', v.id,
    'numero', v.numero,
    'fecha', v.creado_en,
    'sede', jsonb_build_object('nombre', s.nombre, 'direccion', s.direccion, 'telefono', s.telefono),
    'cajero', p.nombre_completo,
    'metodo', v.metodo,
    'total', v.total,
    'recibido', v.recibido,
    'cambio', v.cambio,
    'cliente', jsonb_build_object('tipo', v.cliente_tipo, 'documento', v.cliente_documento, 'nombre', v.cliente_nombre),
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
