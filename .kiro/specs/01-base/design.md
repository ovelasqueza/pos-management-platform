# Design: 01 Base

## Arquitectura

- Next.js 16 App Router. `src/proxy.ts` (en Next 16 reemplaza a `middleware.ts`) refresca la sesión de Supabase y hace redirecciones optimistas por rol (`/login`, `/caja`, `/admin`). La autorización real se verifica en los layouts de servidor y en la RLS.
- Lecturas del admin en Server Components; escrituras con Server Actions (con el JWT del usuario, así aplica RLS).
- Crear usuario / restablecer contraseña: Server Action con cliente de clave secreta (`server-only`) → `auth.admin.createUser`.
- Login por nombre de usuario: se convierte a `nombre_usuario@pos.local` y se usa `signInWithPassword`.

## Modelo de datos

```sql
create type tipo_sede as enum ('panaderia', 'asadero');
create type rol_usuario as enum ('cajero', 'admin');

create table sedes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo tipo_sede not null,
  direccion text,
  telefono text,
  activa boolean not null default true,
  creado_en timestamptz not null default now()
);
create unique index on sedes (lower(nombre));

create table perfiles (
  id uuid primary key references auth.users on delete cascade,
  nombre_completo text not null,
  nombre_usuario text not null,
  rol rol_usuario not null,
  sede_id uuid references sedes,
  activo boolean not null default true,
  constraint cajero_con_sede check (
    (rol = 'cajero' and sede_id is not null) or (rol = 'admin' and sede_id is null)
  )
);
create unique index on perfiles (lower(nombre_usuario));
```

- El perfil se crea con un trigger sobre `auth.users` leyendo `raw_app_meta_data` (rol, sede, nombre).
- Trigger `validar_sede`: bloquea cambiar `tipo` y desactivar con turnos abiertos (la tabla `turnos` llega en spec 03; el trigger se amplía allí).
- Trigger `validar_perfil`: último admin activo; cajero con turno abierto (se amplía en spec 03).

## Seguridad (RLS)

Funciones auxiliares `security definer` en esquema `privado`: `es_admin()`, `sede_actual()`, `usuario_activo()`.

| Tabla | Admin | Cajero |
|---|---|---|
| sedes | todo | leer su sede |
| perfiles | todo | leer su propio perfil |

Todas las políticas exigen `usuario_activo()`.

## Pantallas

- `/login`: logo, usuario, contraseña, botón Ingresar. Nada más.
- `/admin` (inicio): tarjetas de sedes + "Todas las sedes" + botón "Nueva sede".
- Layout admin: barra superior con selector de sede (desplegable), menú lateral con íconos: Resumen, Productos, Precios, Usuarios, Turnos, Reportes, Inventario, Sedes. Salir.
- La sede escogida va en la ruta: `/admin/<sede-id>/<sección>` o `/admin/todas/<sección>` (los layouts reciben `params`, no `searchParams`). Sobrevive recargas y se puede compartir.
- Salir: `POST /salir` (route handler) cierra la sesión. Usuarios inactivos o cajeros de sede inactiva pasan por `/salir?motivo=…` para evitar bucles con el proxy.
- Desactivar un usuario también lo bloquea en Auth (`ban_duration`), así no puede iniciar sesión ni refrescar el token.
- `/admin/sedes` y `/admin/usuarios`: tabla simple + modal para crear/editar.

## Errores

Las funciones de BD lanzan códigos (`SEDE_CON_TURNO_ABIERTO`, `ULTIMO_ADMIN`, `CAJERO_CON_TURNO_ABIERTO`, `TIPO_SEDE_INMUTABLE`); la interfaz los traduce a un mensaje corto en `lib/dominio/errores.ts`.

## Pruebas

- pgTAP: RLS de sedes y perfiles (cajero no ve otras sedes ni otros perfiles); último admin; tipo inmutable.
- Vitest: conversión usuario → correo interno, validaciones zod.
