# Design: 05 Inventario por fecha (v3)

## Modelo de datos

```sql
-- Artículos que existen solo para el inventario (materias primas, empaques…).
-- Tabla aparte de productos: así nunca pueden aparecer en la caja ni en ventas.
create type public.unidad_medida as enum
  ('unidad', 'kilo', 'gramo', 'libra', 'litro', 'bulto', 'arroba', 'paquete', 'caja');

create type public.estado_inventario as enum ('en_curso', 'finalizado');

create table articulos_inventario (
  id uuid primary key default gen_random_uuid(),
  sede_id uuid not null references sedes,
  nombre text not null check (length(trim(nombre)) between 1 and 80),
  unidad public.unidad_medida not null default 'unidad',
  costo int check (costo between 1 and 999999999),   -- por unidad; null = sin costo
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);
create unique index articulos_nombre_unico on articulos_inventario (sede_id, lower(trim(nombre)));

create table inventarios (
  id uuid primary key default gen_random_uuid(),
  sede_id uuid not null references sedes,
  fecha date not null,                                -- día del conteo (Bogotá); no futuro (RPC)
  nota text check (nota is null or length(nota) <= 120),
  estado public.estado_inventario not null default 'en_curso',
  finalizado_por uuid references perfiles,
  finalizado_en timestamptz,
  modificado_por uuid not null references perfiles,
  modificado_en timestamptz not null default now(),
  unique (sede_id, fecha)
);
-- Un solo inventario en curso por sede
create unique index inventarios_uno_en_curso on inventarios (sede_id) where estado = 'en_curso';

create table lineas_inventario (
  id uuid primary key default gen_random_uuid(),
  inventario_id uuid not null references inventarios on delete cascade,
  producto_id uuid references productos,
  articulo_id uuid references articulos_inventario,
  nombre text not null,                               -- copia
  unidad public.unidad_medida not null,               -- copia ('unidad' en productos)
  cantidad numeric(9,3) not null default 0 check (cantidad between 0 and 999999),
  costo int check (costo between 1 and 999999999),    -- copia; null = sin costo
  valor bigint generated always as (round(cantidad * costo)::bigint) stored,
  check (num_nonnulls(producto_id, articulo_id) = 1),
  check (producto_id is null or cantidad = trunc(cantidad)),   -- productos en enteros
  unique (inventario_id, producto_id),
  unique (inventario_id, articulo_id)
);
```

- `productos` y `articulos_inventario` con inventarios no se borran (FK restrict); se desactivan. Productos ya muestra "Tiene ventas o inventarios. Desactívalo".
- Que el producto sea del catálogo de la sede y el artículo de la misma sede lo valida la RPC.
- Trigger: líneas de un inventario `finalizado` no se modifican (solo vía `inv_reabrir`).

## Seguridad

- RLS en las tres tablas: solo admin lee. Inventarios y líneas se escriben solo por RPC `security definer` con `privado.exigir_admin()`. Artículos: `insert`/`update` directo del admin (RLS), como sedes.
- El cajero no accede a ninguna. `productos_vendibles` y la caja no cambian.

## RPC

| Función | Qué hace |
|---|---|
| `inv_crear(sede, fecha, nota)` | Sede activa, fecha ≤ hoy, sin otro en curso (`INVENTARIO_EN_CURSO`) y sin otro en esa fecha (`INVENTARIO_FECHA_OCUPADA`). Crea la lista inicial con copias |
| `inv_obtener(inventario)` | Inventario + líneas + subtotales + total + `hay_sin_costo` + última modificación + finalizado por |
| `inv_cantidad(linea, cantidad)` | Guarda la cantidad (enteros en productos) |
| `inv_agregar(inventario, producto \| articulo)` / `inv_quitar(linea)` | Agregar / quitar línea |
| `inv_actualizar_costos(inventario)` | Copia costos vigentes en todas las líneas |
| `inv_editar(inventario, fecha, nota)` | Cambiar fecha o nota |
| `inv_finalizar(inventario)` / `inv_reabrir(inventario)` | En curso ↔ Finalizado. Reabrir falla si la sede ya tiene otro en curso |
| `inv_borrar(inventario)` | Solo en curso |
| `inv_resumen()` | Para "Todas": último finalizado por sede + si hay uno en curso |

Todas las que modifican: rechazan sede inactiva (`INVENTARIO_SEDE_INACTIVA`) e inventario finalizado (`INVENTARIO_FINALIZADO`, salvo reabrir), y actualizan `modificado_por/en`.

## Cantidades con fracciones

`lib/dominio/inventario.ts`:
- `leerCantidad(texto, tipo)`: acepta `9,5`, `9.5`, `9 1/2`, `1/4`; enteros en productos; máx. 3 decimales; vacío = 0.
- `sumarFraccion(actual, 0.25 | 0.5 | 0.75)` para los atajos +¼ +½ +¾ (guardan como cualquier cambio).
- `cantidadEnPalabras(9.5, 'bulto')` → "9½ bultos" (¼, ½, ¾; si no, "9,125 bultos").
- Valor, subtotales, total, aviso sin costo, orden y agrupación.

## Pantallas

```
/admin/[sede]/inventario               lista (en "todas": resumen por sede)
/admin/[sede]/inventario/[id]          detalle para contar / ver
/admin/[sede]/inventario/articulos     artículos de la sede
```

**Detalle En curso**: cabecera con fecha, nota, insignia "En curso", total grande y subtotales. Buscador; "+ Agregar", "Actualizar costos". Grupos Productos y Artículos; fila Nombre | Cantidad (input mono + unidad, atajos +¼ +½ +¾ en artículos) | Costo | Valor | 🗑. Abajo: "Finalizar" (primario). Botón "Excel" en la cabecera.

**Detalle Finalizado**: misma tabla sin inputs. "Finalizado por X · fecha" y al lado un enlace pequeño gris "Editar" (con confirmación).

**Excel (CSV)**: generado en el navegador, sin librerías; UTF-8 con BOM y separador `;` (Excel en español lo abre bien con tildes y columnas). Cantidades con coma decimal; valores enteros sin separador de miles para que Excel los sume. Nombre: `inventario-<sede>-<fecha>.csv`. Función pura `armarCsvInventario` con tests (comillas, `;` y saltos de línea en nombres).

## Pruebas pgTAP

- Cajero sin acceso a artículos, inventarios y líneas.
- Fecha futura, sede inactiva, segundo en curso, misma fecha → rechazados.
- Producto con decimales rechazado; artículo con 9,5 aceptado.
- Finalizado no se modifica; reabrir lo permite; borrar finalizado rechazado.
- Cambiar un costo no altera inventarios hechos; "Actualizar costos" sí.
- Producto de otro catálogo o artículo de otra sede rechazados.
