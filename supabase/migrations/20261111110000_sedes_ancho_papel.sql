-- Ancho de papel de impresora térmica por sede (80 mm o 58 mm).
-- Configurable por el administrador en cada sede; la caja de esa sede toma este formato automáticamente.

alter table public.sedes
  add column if not exists ancho_papel int not null default 80
  check (ancho_papel in (80, 58));
