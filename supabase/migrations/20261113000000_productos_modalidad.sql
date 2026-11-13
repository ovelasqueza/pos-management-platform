-- Modalidad de consumo/entrega opcional por producto (para separar en caja: Para la mesa vs Para llevar)
alter table public.productos
  add column if not exists modalidad text check (modalidad in ('mesa', 'llevar'));

create or replace view public.productos_vendibles with (security_invoker = true) as
select
  ps.sede_id,
  p.id,
  p.nombre,
  p.categoria_id,
  c.nombre as categoria,
  p.imagen_path,
  ps.precio_venta,
  p.modalidad
from public.productos_sede ps
join public.productos p on p.id = ps.producto_id
left join public.categorias c on c.id = p.categoria_id
where ps.habilitado and p.activo;
