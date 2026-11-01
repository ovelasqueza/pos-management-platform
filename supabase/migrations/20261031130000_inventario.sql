-- Spec 05: inventario por fecha (.kiro/specs/05-inventario)
-- Conteo físico por sede en una fecha, valorizado con costos. Solo admin.
-- Incluye productos de venta y artículos de inventario (materias primas, empaques…) por sede.
-- Los artículos están en su propia tabla: nunca aparecen en la caja ni en ventas.
-- No modifica tablas ni funciones existentes.
-- Requiere: 20261028110000_catalogo.sql

-- ───────────────────────── Tipos ─────────────────────────

create type public.unidad_medida as enum
  ('unidad', 'kilo', 'gramo', 'libra', 'litro', 'bulto', 'arroba', 'paquete', 'caja');

create type public.estado_inventario as enum ('en_curso', 'finalizado');

-- ───────────────────────── Tablas ─────────────────────────

create table public.articulos_inventario (
  id uuid primary key default gen_random_uuid(),
  sede_id uuid not null references public.sedes,
  nombre text not null check (length(nombre) between 1 and 80),
  unidad public.unidad_medida not null default 'unidad',
  costo int check (costo between 1 and 999999999),        -- por unidad; null = sin costo
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create unique index articulos_inventario_nombre_unico
  on public.articulos_inventario (sede_id, lower(nombre));

create table public.inventarios (
  id uuid primary key default gen_random_uuid(),
  sede_id uuid not null references public.sedes,
  fecha date not null,                                     -- día del conteo (Bogotá)
  nota text check (nota is null or length(nota) between 1 and 120),
  estado public.estado_inventario not null default 'en_curso',
  creado_por uuid not null references public.perfiles,
  creado_en timestamptz not null default now(),
  modificado_por uuid not null references public.perfiles,
  modificado_en timestamptz not null default now(),
  finalizado_por uuid references public.perfiles,
  finalizado_en timestamptz,
  constraint inventarios_sede_fecha unique (sede_id, fecha),
  constraint inventarios_finalizado check ((estado = 'finalizado') = (finalizado_en is not null))
);
-- Un solo inventario en curso por sede
create unique index inventarios_uno_en_curso on public.inventarios (sede_id) where estado = 'en_curso';
create index inventarios_sede_fecha_idx on public.inventarios (sede_id, fecha desc);

create table public.lineas_inventario (
  id uuid primary key default gen_random_uuid(),
  inventario_id uuid not null references public.inventarios on delete cascade,
  producto_id uuid references public.productos,            -- uno de los dos
  articulo_id uuid references public.articulos_inventario,
  nombre text not null,                                    -- copia
  unidad public.unidad_medida not null,                    -- copia ('unidad' en productos)
  cantidad numeric(9, 3) not null default 0 check (cantidad between 0 and 999999),
  costo int check (costo between 1 and 999999999),         -- copia; null = sin costo
  valor bigint generated always as (round(cantidad * costo)::bigint) stored,
  constraint lineas_inventario_uno check (num_nonnulls(producto_id, articulo_id) = 1),
  constraint lineas_inventario_enteros check (producto_id is null or cantidad = trunc(cantidad)),
  constraint lineas_inventario_producto unique (inventario_id, producto_id),
  constraint lineas_inventario_articulo unique (inventario_id, articulo_id)
);
create index lineas_inventario_producto_idx on public.lineas_inventario (producto_id);
create index lineas_inventario_articulo_idx on public.lineas_inventario (articulo_id);

-- ───────────────────────── Triggers ─────────────────────────

-- Nombre del artículo en MAYÚSCULAS y sin espacios repetidos
create function privado.normalizar_articulo() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.nombre := upper(regexp_replace(trim(new.nombre), '\s+', ' ', 'g'));
  new.actualizado_en := now();
  return new;
end;
$$;
create trigger normalizar_articulo before insert or update on public.articulos_inventario
  for each row execute function privado.normalizar_articulo();

-- Las líneas de un inventario finalizado no cambian (primero se reabre)
create function privado.validar_linea_inventario() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_inventario uuid;
begin
  if tg_op = 'DELETE' then
    v_inventario := old.inventario_id;
  else
    v_inventario := new.inventario_id;
  end if;
  if exists (select 1 from public.inventarios i where i.id = v_inventario and i.estado = 'finalizado') then
    raise exception 'INVENTARIO_FINALIZADO';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
create trigger validar_linea_inventario before insert or update or delete on public.lineas_inventario
  for each row execute function privado.validar_linea_inventario();

-- ─────────────────────── Funciones internas ───────────────────────

create function privado.exigir_admin() returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  if not privado.es_admin() then
    raise exception 'SOLO_ADMIN';
  end if;
  return auth.uid();
end;
$$;

create function privado.hoy_bogota() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Bogota')::date;
$$;

-- Inventario bloqueado para modificar: existe, sede activa y en curso
create function privado.inventario_editable(p_inventario uuid) returns public.inventarios
language plpgsql security definer set search_path = '' as $$
declare
  v public.inventarios;
begin
  select * into v from public.inventarios where id = p_inventario for update;
  if v.id is null then
    raise exception 'INVENTARIO_NO_EXISTE';
  end if;
  if not exists (select 1 from public.sedes s where s.id = v.sede_id and s.activa) then
    raise exception 'INVENTARIO_SEDE_INACTIVA';
  end if;
  if v.estado = 'finalizado' then
    raise exception 'INVENTARIO_FINALIZADO';
  end if;
  return v;
end;
$$;

create function privado.tocar_inventario(p_inventario uuid) returns void
language sql security definer set search_path = '' as $$
  update public.inventarios set modificado_por = auth.uid(), modificado_en = now() where id = p_inventario;
$$;

-- Nota opcional: vacía = null; máx. 120
create function privado.nota_inventario(p_nota text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  v text := nullif(trim(coalesce(p_nota, '')), '');
begin
  if length(v) > 120 then
    raise exception 'NOTA_INVALIDA';
  end if;
  return v;
end;
$$;

create function privado.linea_json(l public.lineas_inventario) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'id', l.id, 'producto_id', l.producto_id, 'articulo_id', l.articulo_id, 'nombre', l.nombre,
    'unidad', l.unidad, 'cantidad', l.cantidad, 'costo', l.costo, 'valor', l.valor);
$$;

-- Solo las usan las RPC (security definer): nadie más las ejecuta
revoke all on function privado.exigir_admin(), privado.hoy_bogota(), privado.inventario_editable(uuid),
  privado.tocar_inventario(uuid), privado.nota_inventario(text), privado.linea_json(public.lineas_inventario)
  from public, anon, authenticated;

-- ───────────────────────── RPC ─────────────────────────

-- Crea el inventario de una sede con la lista inicial: productos activos y habilitados
-- en la sede + artículos activos de la sede, con nombre, unidad y costo copiados.
create function public.inv_crear(p_sede uuid, p_fecha date, p_nota text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := privado.exigir_admin();
  v_sede public.sedes;
  v_fecha date := coalesce(p_fecha, privado.hoy_bogota());
  v_id uuid;
begin
  select * into v_sede from public.sedes where id = p_sede;
  if v_sede.id is null or not v_sede.activa then
    raise exception 'INVENTARIO_SEDE_INACTIVA';
  end if;
  if v_fecha > privado.hoy_bogota() then
    raise exception 'FECHA_FUTURA';
  end if;

  perform pg_advisory_xact_lock(hashtext('inventario:' || p_sede::text));
  if exists (select 1 from public.inventarios where sede_id = p_sede and estado = 'en_curso') then
    raise exception 'INVENTARIO_EN_CURSO';
  end if;
  if exists (select 1 from public.inventarios where sede_id = p_sede and fecha = v_fecha) then
    raise exception 'INVENTARIO_FECHA_OCUPADA';
  end if;

  insert into public.inventarios (sede_id, fecha, nota, creado_por, modificado_por)
  values (p_sede, v_fecha, privado.nota_inventario(p_nota), v_admin, v_admin)
  returning id into v_id;

  insert into public.lineas_inventario (inventario_id, producto_id, nombre, unidad, costo)
  select v_id, p.id, p.nombre, 'unidad', c.costo
  from public.productos_sede ps
  join public.productos p on p.id = ps.producto_id
  left join public.costos_producto_sede c on c.sede_id = ps.sede_id and c.producto_id = ps.producto_id
  where ps.sede_id = p_sede and ps.habilitado and p.activo;

  insert into public.lineas_inventario (inventario_id, articulo_id, nombre, unidad, costo)
  select v_id, a.id, a.nombre, a.unidad, a.costo
  from public.articulos_inventario a
  where a.sede_id = p_sede and a.activo;

  return v_id;
end;
$$;

-- Guarda la cantidad contada de una línea. Devuelve la línea con su valor.
create function public.inv_cantidad(p_linea uuid, p_cantidad numeric) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_linea public.lineas_inventario;
  v_cantidad numeric := coalesce(p_cantidad, 0);
begin
  perform privado.exigir_admin();
  select * into v_linea from public.lineas_inventario where id = p_linea;
  if v_linea.id is null then
    raise exception 'LINEA_NO_EXISTE';
  end if;
  perform privado.inventario_editable(v_linea.inventario_id);

  if v_cantidad < 0 or v_cantidad > 999999 or v_cantidad <> round(v_cantidad, 3)
     or (v_linea.producto_id is not null and v_cantidad <> trunc(v_cantidad)) then
    raise exception 'CANTIDAD_INVALIDA';
  end if;

  update public.lineas_inventario set cantidad = v_cantidad where id = p_linea
  returning * into v_linea;
  perform privado.tocar_inventario(v_linea.inventario_id);
  return privado.linea_json(v_linea);
end;
$$;

-- Agrega un producto del catálogo de la sede o un artículo de la sede (uno de los dos)
create function public.inv_agregar(p_inventario uuid, p_producto uuid, p_articulo uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_inv public.inventarios;
  v_linea public.lineas_inventario;
begin
  perform privado.exigir_admin();
  if num_nonnulls(p_producto, p_articulo) <> 1 then
    raise exception 'LINEA_INVALIDA';
  end if;
  v_inv := privado.inventario_editable(p_inventario);

  if p_producto is not null then
    insert into public.lineas_inventario (inventario_id, producto_id, nombre, unidad, costo)
    select v_inv.id, p.id, p.nombre, 'unidad', c.costo
    from public.productos p
    join public.sedes s on s.id = v_inv.sede_id and s.tipo = p.tipo
    left join public.costos_producto_sede c on c.sede_id = s.id and c.producto_id = p.id
    where p.id = p_producto
    on conflict do nothing
    returning * into v_linea;
  else
    insert into public.lineas_inventario (inventario_id, articulo_id, nombre, unidad, costo)
    select v_inv.id, a.id, a.nombre, a.unidad, a.costo
    from public.articulos_inventario a
    where a.id = p_articulo and a.sede_id = v_inv.sede_id
    on conflict do nothing
    returning * into v_linea;
  end if;

  if v_linea.id is null then
    if exists (select 1 from public.lineas_inventario l where l.inventario_id = v_inv.id
               and (l.producto_id = p_producto or l.articulo_id = p_articulo)) then
      raise exception 'YA_EN_INVENTARIO';
    end if;
    raise exception 'LINEA_INVALIDA'; -- producto de otro catálogo o artículo de otra sede
  end if;

  perform privado.tocar_inventario(v_inv.id);
  return privado.linea_json(v_linea);
end;
$$;

create function public.inv_quitar(p_linea uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_inventario uuid;
begin
  perform privado.exigir_admin();
  select inventario_id into v_inventario from public.lineas_inventario where id = p_linea;
  if v_inventario is null then
    return; -- ya no existe: reintento seguro
  end if;
  perform privado.inventario_editable(v_inventario);
  delete from public.lineas_inventario where id = p_linea;
  perform privado.tocar_inventario(v_inventario);
end;
$$;

-- Vuelve a copiar los costos vigentes en todas las líneas
create function public.inv_actualizar_costos(p_inventario uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_inv public.inventarios;
begin
  perform privado.exigir_admin();
  v_inv := privado.inventario_editable(p_inventario);

  update public.lineas_inventario l
  set costo = (select c.costo from public.costos_producto_sede c
               where c.sede_id = v_inv.sede_id and c.producto_id = l.producto_id)
  where l.inventario_id = v_inv.id and l.producto_id is not null;

  update public.lineas_inventario l
  set costo = a.costo
  from public.articulos_inventario a
  where l.inventario_id = v_inv.id and a.id = l.articulo_id;

  perform privado.tocar_inventario(v_inv.id);
end;
$$;

create function public.inv_editar(p_inventario uuid, p_fecha date, p_nota text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_inv public.inventarios;
begin
  perform privado.exigir_admin();
  v_inv := privado.inventario_editable(p_inventario);
  if p_fecha is null or p_fecha > privado.hoy_bogota() then
    raise exception 'FECHA_FUTURA';
  end if;
  if exists (select 1 from public.inventarios
             where sede_id = v_inv.sede_id and fecha = p_fecha and id <> v_inv.id) then
    raise exception 'INVENTARIO_FECHA_OCUPADA';
  end if;
  update public.inventarios
  set fecha = p_fecha, nota = privado.nota_inventario(p_nota), modificado_por = auth.uid(), modificado_en = now()
  where id = v_inv.id;
end;
$$;

create function public.inv_finalizar(p_inventario uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_inv public.inventarios;
begin
  perform privado.exigir_admin();
  v_inv := privado.inventario_editable(p_inventario);
  update public.inventarios
  set estado = 'finalizado', finalizado_por = auth.uid(), finalizado_en = now(),
      modificado_por = auth.uid(), modificado_en = now()
  where id = v_inv.id;
end;
$$;

-- Vuelve a dejar En curso un inventario finalizado ("Editar")
create function public.inv_reabrir(p_inventario uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_inv public.inventarios;
begin
  perform privado.exigir_admin();
  select * into v_inv from public.inventarios where id = p_inventario for update;
  if v_inv.id is null then
    raise exception 'INVENTARIO_NO_EXISTE';
  end if;
  if not exists (select 1 from public.sedes s where s.id = v_inv.sede_id and s.activa) then
    raise exception 'INVENTARIO_SEDE_INACTIVA';
  end if;
  if v_inv.estado = 'en_curso' then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('inventario:' || v_inv.sede_id::text));
  if exists (select 1 from public.inventarios where sede_id = v_inv.sede_id and estado = 'en_curso') then
    raise exception 'INVENTARIO_EN_CURSO';
  end if;

  update public.inventarios
  set estado = 'en_curso', finalizado_por = null, finalizado_en = null,
      modificado_por = auth.uid(), modificado_en = now()
  where id = v_inv.id;
end;
$$;

-- Solo un inventario en curso se borra
create function public.inv_borrar(p_inventario uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.exigir_admin();
  perform privado.inventario_editable(p_inventario);
  delete from public.inventarios where id = p_inventario;
end;
$$;

revoke all on function
  public.inv_crear(uuid, date, text), public.inv_cantidad(uuid, numeric),
  public.inv_agregar(uuid, uuid, uuid), public.inv_quitar(uuid), public.inv_actualizar_costos(uuid),
  public.inv_editar(uuid, date, text), public.inv_finalizar(uuid), public.inv_reabrir(uuid),
  public.inv_borrar(uuid)
  from public, anon;
grant execute on function
  public.inv_crear(uuid, date, text), public.inv_cantidad(uuid, numeric),
  public.inv_agregar(uuid, uuid, uuid), public.inv_quitar(uuid), public.inv_actualizar_costos(uuid),
  public.inv_editar(uuid, date, text), public.inv_finalizar(uuid), public.inv_reabrir(uuid),
  public.inv_borrar(uuid)
  to authenticated;

-- ───────────────────────── Vista de totales ─────────────────────────

-- Un inventario con sus subtotales y total (líneas sin costo no suman)
create view public.inventarios_resumen with (security_invoker = true) as
select
  i.id,
  i.sede_id,
  i.fecha,
  i.nota,
  i.estado,
  i.modificado_en,
  pm.nombre_completo as modificado_por,
  i.finalizado_en,
  pf.nombre_completo as finalizado_por,
  coalesce(sum(l.valor) filter (where l.producto_id is not null), 0)::bigint as total_productos,
  coalesce(sum(l.valor) filter (where l.articulo_id is not null), 0)::bigint as total_articulos,
  coalesce(sum(l.valor), 0)::bigint as total,
  count(l.id)::int as lineas,
  (count(l.id) filter (where l.costo is null))::int as sin_costo
from public.inventarios i
left join public.lineas_inventario l on l.inventario_id = i.id
left join public.perfiles pm on pm.id = i.modificado_por
left join public.perfiles pf on pf.id = i.finalizado_por
group by i.id, pm.nombre_completo, pf.nombre_completo;

-- ───────────────────────── RLS ─────────────────────────

alter table public.articulos_inventario enable row level security;
alter table public.inventarios enable row level security;
alter table public.lineas_inventario enable row level security;

revoke all on public.articulos_inventario, public.inventarios, public.lineas_inventario,
  public.inventarios_resumen from anon;
-- Inventarios y líneas solo se escriben por RPC
revoke insert, update, delete on public.inventarios, public.lineas_inventario from authenticated;

create policy articulos_admin on public.articulos_inventario for all to authenticated
  using (privado.es_admin()) with check (privado.es_admin());
create policy inventarios_leer on public.inventarios for select to authenticated
  using (privado.es_admin());
create policy lineas_inventario_leer on public.lineas_inventario for select to authenticated
  using (privado.es_admin());
