-- Ciudad de la sede (pedido del usuario, 2026-10-31).
-- La sede se muestra como "Ciudad · Dirección / barrio".
-- Opcional, máx. 60 caracteres. Las sedes existentes quedan sin ciudad hasta que se edite.
-- Requiere: 20261028100000_base.sql. Usa los mismos permisos y RLS de la tabla sedes.

alter table public.sedes
  add column if not exists ciudad text
  check (ciudad is null or length(ciudad) <= 60);
