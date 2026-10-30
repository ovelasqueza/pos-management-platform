-- Spec 01: sedes, perfiles, funciones auxiliares y RLS
-- Errores de negocio: raise exception '<CODIGO>' (errcode P0001). La app traduce el código.

create schema if not exists privado;
revoke all on schema privado from public, anon;
grant usage on schema privado to authenticated;

create type public.tipo_sede as enum ('panaderia', 'asadero');
create type public.rol_usuario as enum ('cajero', 'admin');

-- ───────────────────────── Tablas ─────────────────────────

create table public.sedes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) between 1 and 80),
  tipo public.tipo_sede not null,
  direccion text check (direccion is null or length(direccion) <= 150),
  telefono text check (telefono is null or length(telefono) <= 30),
  activa boolean not null default true,
  creado_en timestamptz not null default now()
);
create unique index sedes_nombre_unico on public.sedes (lower(trim(nombre)));

create table public.perfiles (
  id uuid primary key references auth.users on delete cascade,
  nombre_completo text not null check (length(trim(nombre_completo)) between 1 and 80),
  nombre_usuario text not null check (nombre_usuario ~ '^[a-z0-9._-]{3,30}$'),
  rol public.rol_usuario not null,
  sede_id uuid references public.sedes,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  constraint perfiles_rol_sede check (
    (rol = 'cajero' and sede_id is not null) or (rol = 'admin' and sede_id is null)
  )
);
create unique index perfiles_usuario_unico on public.perfiles (nombre_usuario);
create index perfiles_sede on public.perfiles (sede_id);

-- ───────────────────── Funciones auxiliares ─────────────────────

create function privado.usuario_activo() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfiles p where p.id = auth.uid() and p.activo
  );
$$;

create function privado.es_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = auth.uid() and p.activo and p.rol = 'admin'
  );
$$;

-- Sede del cajero activo que hace la consulta (null si no es cajero activo)
create function privado.sede_actual() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.sede_id from public.perfiles p
  where p.id = auth.uid() and p.activo and p.rol = 'cajero';
$$;

revoke all on function privado.usuario_activo(), privado.es_admin(), privado.sede_actual()
  from public, anon;
grant execute on function privado.usuario_activo(), privado.es_admin(), privado.sede_actual()
  to authenticated;

-- ───────────────────────── Triggers ─────────────────────────

-- Crea el perfil al crear el usuario en Auth (desde app_metadata, que solo
-- puede escribir el servidor con la clave secreta). Si falla, no se crea el usuario.
create function privado.crear_perfil_desde_auth() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_app_meta_data, '{}'::jsonb);
begin
  if meta ->> 'rol' is null then
    raise exception 'PERFIL_SIN_ROL';
  end if;

  insert into public.perfiles (id, nombre_completo, nombre_usuario, rol, sede_id)
  values (
    new.id,
    meta ->> 'nombre_completo',
    meta ->> 'nombre_usuario',
    (meta ->> 'rol')::public.rol_usuario,
    nullif(meta ->> 'sede_id', '')::uuid
  );
  return new;
end;
$$;

create trigger al_crear_usuario_auth
  after insert on auth.users
  for each row execute function privado.crear_perfil_desde_auth();

-- El tipo de sede no cambia. (Spec 03 agrega: no desactivar con turnos abiertos.)
create function privado.validar_sede() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.tipo is distinct from old.tipo then
    raise exception 'TIPO_SEDE_INMUTABLE';
  end if;
  return new;
end;
$$;

create trigger validar_sede
  before update on public.sedes
  for each row execute function privado.validar_sede();

-- Reglas de perfiles. (Spec 03 agrega: cajero con turno abierto.)
create function privado.validar_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.nombre_usuario is distinct from old.nombre_usuario then
    raise exception 'NOMBRE_USUARIO_INMUTABLE';
  end if;

  -- Un cajero solo puede asignarse a una sede activa
  if new.rol = 'cajero'
     and (tg_op = 'INSERT' or new.sede_id is distinct from old.sede_id or old.rol <> 'cajero')
     and not exists (select 1 from public.sedes s where s.id = new.sede_id and s.activa) then
    raise exception 'SEDE_NO_DISPONIBLE';
  end if;

  -- No dejar el sistema sin administradores activos
  if tg_op = 'UPDATE' and old.rol = 'admin' and old.activo
     and (new.rol <> 'admin' or not new.activo) then
    perform pg_advisory_xact_lock(hashtext('ultimo_admin'));
    if not exists (
      select 1 from public.perfiles p
      where p.rol = 'admin' and p.activo and p.id <> old.id
    ) then
      raise exception 'ULTIMO_ADMIN';
    end if;
  end if;

  return new;
end;
$$;

create trigger validar_perfil
  before insert or update on public.perfiles
  for each row execute function privado.validar_perfil();

-- ───────────────────────── RLS ─────────────────────────

alter table public.sedes enable row level security;
alter table public.perfiles enable row level security;

revoke all on public.sedes, public.perfiles from anon;
revoke delete on public.sedes, public.perfiles from authenticated;
revoke insert on public.perfiles from authenticated; -- solo el trigger de Auth

create policy sedes_leer on public.sedes for select to authenticated
  using (privado.es_admin() or id = privado.sede_actual());

create policy sedes_crear on public.sedes for insert to authenticated
  with check (privado.es_admin());

create policy sedes_editar on public.sedes for update to authenticated
  using (privado.es_admin()) with check (privado.es_admin());

-- Cada usuario lee su propio perfil (aunque esté inactivo, para mostrar el aviso)
create policy perfiles_leer on public.perfiles for select to authenticated
  using (privado.es_admin() or id = auth.uid());

create policy perfiles_editar on public.perfiles for update to authenticated
  using (privado.es_admin()) with check (privado.es_admin());
