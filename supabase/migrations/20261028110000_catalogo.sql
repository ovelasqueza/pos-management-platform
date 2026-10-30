-- Spec 02: catálogo por tipo de sede, productos por sede, precios y costos
-- Requiere: 20261028100000_base.sql

-- Permite llaves compuestas (id, tipo) para garantizar que una sede solo
-- tenga productos de su propio catálogo.
alter table public.sedes add constraint sedes_id_tipo unique (id, tipo);

-- ───────────────────────── Tablas ─────────────────────────

create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  tipo public.tipo_sede not null,
  nombre text not null check (length(trim(nombre)) between 1 and 40),
  constraint categorias_id_tipo unique (id, tipo)
);
create unique index categorias_nombre_unico on public.categorias (tipo, lower(trim(nombre)));

create table public.productos (
  id uuid primary key default gen_random_uuid(),
  tipo public.tipo_sede not null,
  nombre text not null check (length(trim(nombre)) between 1 and 80),
  categoria_id uuid,
  precio_referencia int not null check (precio_referencia between 1 and 999999999),
  imagen_path text,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint productos_id_tipo unique (id, tipo),
  -- La categoría debe ser del mismo catálogo (si categoria_id es null no se valida)
  constraint productos_categoria foreign key (categoria_id, tipo)
    references public.categorias (id, tipo) on delete restrict
);
create unique index productos_nombre_unico on public.productos (tipo, lower(trim(nombre)));
create index productos_categoria_idx on public.productos (categoria_id);

create table public.productos_sede (
  sede_id uuid not null,
  producto_id uuid not null,
  tipo public.tipo_sede not null,
  habilitado boolean not null default true,
  precio_venta int not null check (precio_venta between 1 and 999999999),
  actualizado_en timestamptz not null default now(),
  primary key (sede_id, producto_id),
  constraint productos_sede_sede foreign key (sede_id, tipo)
    references public.sedes (id, tipo) on delete cascade,
  constraint productos_sede_producto foreign key (producto_id, tipo)
    references public.productos (id, tipo) on delete cascade
);
create index productos_sede_producto_idx on public.productos_sede (producto_id);

-- Tabla aparte para que el cajero no pueda leer el costo por ningún medio.
-- Sin fila = "sin costo".
create table public.costos_producto_sede (
  sede_id uuid not null,
  producto_id uuid not null,
  costo int not null check (costo between 1 and 999999999),
  actualizado_por uuid references public.perfiles,
  actualizado_en timestamptz not null default now(),
  primary key (sede_id, producto_id),
  foreign key (sede_id, producto_id)
    references public.productos_sede (sede_id, producto_id) on delete cascade
);

-- ─────────────────────── Funciones auxiliares ───────────────────────

-- Tipo de la sede del cajero activo (null si no es cajero activo)
create function privado.tipo_actual() returns public.tipo_sede
language sql stable security definer set search_path = '' as $$
  select s.tipo from public.perfiles p
  join public.sedes s on s.id = p.sede_id
  where p.id = auth.uid() and p.activo and p.rol = 'cajero';
$$;
revoke all on function privado.tipo_actual() from public, anon;
grant execute on function privado.tipo_actual() to authenticated;

-- ───────────────────────── Triggers ─────────────────────────

create function privado.tocar_actualizado() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

create trigger productos_actualizado before update on public.productos
  for each row execute function privado.tocar_actualizado();
create trigger productos_sede_actualizado before update on public.productos_sede
  for each row execute function privado.tocar_actualizado();

-- Quién y cuándo cambió el costo
create function privado.marcar_costo() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.actualizado_por := auth.uid();
  new.actualizado_en := now();
  return new;
end;
$$;

create trigger costos_marcar before insert or update on public.costos_producto_sede
  for each row execute function privado.marcar_costo();

-- Sede nueva: habilita todos los productos de su catálogo al precio de referencia
create function privado.al_crear_sede() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.productos_sede (sede_id, producto_id, tipo, precio_venta)
  select new.id, p.id, p.tipo, p.precio_referencia
  from public.productos p
  where p.tipo = new.tipo;
  return new;
end;
$$;

create trigger al_crear_sede after insert on public.sedes
  for each row execute function privado.al_crear_sede();

-- Producto nuevo: se habilita en todas las sedes de su tipo
create function privado.al_crear_producto() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.productos_sede (sede_id, producto_id, tipo, precio_venta)
  select s.id, new.id, new.tipo, new.precio_referencia
  from public.sedes s
  where s.tipo = new.tipo;
  return new;
end;
$$;

create trigger al_crear_producto after insert on public.productos
  for each row execute function privado.al_crear_producto();

-- El catálogo de un producto no cambia
create function privado.validar_producto() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.tipo is distinct from old.tipo then
    raise exception 'TIPO_PRODUCTO_INMUTABLE';
  end if;
  return new;
end;
$$;

create trigger validar_producto before update on public.productos
  for each row execute function privado.validar_producto();

-- ───────────────────────── RPC ─────────────────────────

-- Copia el precio de referencia a todas las sedes del tipo del producto
create function public.aplicar_precio_referencia(p_producto uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not privado.es_admin() then
    raise exception 'SOLO_ADMIN';
  end if;

  update public.productos_sede ps
  set precio_venta = p.precio_referencia
  from public.productos p
  where p.id = p_producto and ps.producto_id = p.id;
end;
$$;
revoke all on function public.aplicar_precio_referencia(uuid) from public, anon;
grant execute on function public.aplicar_precio_referencia(uuid) to authenticated;

-- ───────────────────────── Vista para la caja ─────────────────────────

-- Productos que el cajero puede vender (la RLS de las tablas filtra por su sede)
create view public.productos_vendibles with (security_invoker = true) as
select
  ps.sede_id,
  p.id,
  p.nombre,
  p.categoria_id,
  c.nombre as categoria,
  p.imagen_path,
  ps.precio_venta
from public.productos_sede ps
join public.productos p on p.id = ps.producto_id
left join public.categorias c on c.id = p.categoria_id
where ps.habilitado and p.activo;

-- ───────────────────────── RLS ─────────────────────────

alter table public.categorias enable row level security;
alter table public.productos enable row level security;
alter table public.productos_sede enable row level security;
alter table public.costos_producto_sede enable row level security;

revoke all on public.categorias, public.productos, public.productos_sede,
  public.costos_producto_sede, public.productos_vendibles from anon;
revoke insert, delete on public.productos_sede from authenticated; -- solo triggers

create policy categorias_leer on public.categorias for select to authenticated
  using (privado.es_admin() or tipo = privado.tipo_actual());
create policy categorias_admin on public.categorias for all to authenticated
  using (privado.es_admin()) with check (privado.es_admin());

create policy productos_leer on public.productos for select to authenticated
  using (privado.es_admin() or tipo = privado.tipo_actual());
create policy productos_admin on public.productos for all to authenticated
  using (privado.es_admin()) with check (privado.es_admin());

create policy productos_sede_leer on public.productos_sede for select to authenticated
  using (privado.es_admin() or sede_id = privado.sede_actual());
create policy productos_sede_editar on public.productos_sede for update to authenticated
  using (privado.es_admin()) with check (privado.es_admin());

-- Costos: solo admin
create policy costos_admin on public.costos_producto_sede for all to authenticated
  using (privado.es_admin()) with check (privado.es_admin());

-- ───────────────────────── Storage ─────────────────────────

-- Imágenes de productos: lectura pública por URL; solo el admin sube o borra.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('productos', 'productos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy productos_img_leer on storage.objects for select to authenticated
  using (bucket_id = 'productos');
create policy productos_img_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'productos' and privado.es_admin());
create policy productos_img_editar on storage.objects for update to authenticated
  using (bucket_id = 'productos' and privado.es_admin());
create policy productos_img_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'productos' and privado.es_admin());
