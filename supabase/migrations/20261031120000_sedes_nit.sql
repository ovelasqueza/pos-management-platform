-- NIT de la sede (pedido del usuario, 2026-10-31).
-- Opcional. Se imprime en la cabecera del ticket junto con "Régimen simplificado".
-- Formato: solo números, con dígito de verificación opcional (900123456-7).
-- Requiere: 20261031110000_cliente_venta.sql (redefine privado.ticket con el cliente).
-- Usa los mismos permisos y RLS de la tabla sedes.

alter table public.sedes
  add column if not exists nit text
  check (nit is null or nit ~ '^[0-9]{3,15}(-[0-9])?$');

-- Ticket con el NIT de la sede (el resto igual a la versión del script 11)
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
