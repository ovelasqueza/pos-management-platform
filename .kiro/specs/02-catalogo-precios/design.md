# Design: 02 Catálogo y precios

## Modelo de datos

```sql
create table categorias (
  id uuid primary key default gen_random_uuid(),
  tipo tipo_sede not null,
  nombre text not null,
  unique (tipo, nombre)
);

create table productos (
  id uuid primary key default gen_random_uuid(),
  tipo tipo_sede not null,
  nombre text not null,
  categoria_id uuid references categorias,
  precio_referencia int not null check (precio_referencia between 1 and 999999999),
  imagen_path text,            -- Storage bucket 'productos'
  activo boolean not null default true,
  actualizado_en timestamptz not null default now()
);
create unique index on productos (tipo, lower(nombre));

create table productos_sede (
  sede_id uuid references sedes,
  producto_id uuid references productos,
  habilitado boolean not null default true,
  precio_venta int not null check (precio_venta between 1 and 999999999),
  actualizado_en timestamptz not null default now(),
  primary key (sede_id, producto_id)
);

-- Separada para que el cajero no pueda leer el costo por ningún medio
create table costos_producto_sede (
  sede_id uuid,
  producto_id uuid,
  costo int not null check (costo between 1 and 999999999),
  actualizado_por uuid references perfiles,
  actualizado_en timestamptz not null default now(),
  primary key (sede_id, producto_id),
  foreign key (sede_id, producto_id) references productos_sede
);
```

- Triggers: `al_crear_sede` y `al_crear_producto` insertan `productos_sede` (R2.1, R2.2). Un trigger valida que `productos.tipo = sedes.tipo` (R2.3).
- Categoría en una categoría con el mismo `tipo` (check por trigger).
- RPC `aplicar_precio_referencia(producto_id)`: copia el precio a todas las sedes del tipo.
- Vista `productos_vendibles` (security invoker): producto activo + habilitado en la sede del cajero, con nombre, categoría, imagen y precio. Es lo que lee la caja.

## RLS

| Tabla | Admin | Cajero |
|---|---|---|
| categorias, productos | todo | leer su tipo |
| productos_sede | todo | leer su sede |
| costos_producto_sede | todo | nada |
| storage `productos` | escribir | leer |

## Guardado automático

Hook `useAutoguardado(valorInicial, guardar, validar)` en `lib/dominio/autoguardado.ts` con estados: `inicial → editando → guardando → guardado | error`.
- `blur`/`Enter`: si valor == inicial → nada; si inválido → revertir y marcar error; si válido → `guardar()`.
- Error de red → conserva valor, muestra "No se guardó · Reintentar".
- El navegador del admin llama directo a Supabase (`update productos_sede` / `upsert costos_producto_sede`); la RLS autoriza.

La lógica de decisión es una función pura testeable con Vitest.

## Reflejo en la caja

La caja consulta `productos_vendibles` al cargar y la refresca cada 30 s y al volver a la pestaña (`visibilitychange`). Simple y cumple los 60 s. (Realtime queda como mejora futura.)

## Pantallas

- `/admin/productos`: pestañas Panadería/Asadero, lista con foto, nombre, categoría, precio ref., estado. Botón "+ Producto" abre modal. Categorías se gestionan en un modal pequeño desde la misma pantalla.
- `/admin/precios?sede=…`: tabla `[interruptor] Nombre | Precio venta | Costo`, buscador arriba. Campos mono alineados a la derecha.

## Pruebas

- Vitest: lógica de autoguardado (sin cambio, inválido, error, reintento).
- pgTAP: cajero no lee `costos_producto_sede`; triggers de alta; producto de otro tipo rechazado.
