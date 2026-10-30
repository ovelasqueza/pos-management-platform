# Design: 05 Inventario mensual (borrador)

## Modelo de datos

```sql
create table inventarios (
  id uuid primary key default gen_random_uuid(),
  sede_id uuid not null references sedes,
  mes date not null check (extract(day from mes) = 1),   -- primer día del mes
  modificado_por uuid references perfiles,
  modificado_en timestamptz,
  unique (sede_id, mes)
);

create table lineas_inventario (
  inventario_id uuid references inventarios on delete cascade,
  producto_id uuid references productos,
  nombre text not null,
  cantidad int not null default 0 check (cantidad between 0 and 999999),
  costo int,                                   -- null = sin costo
  primary key (inventario_id, producto_id)
);
```

RLS: solo admin (lectura y escritura vía RPC). El cajero no tiene acceso.

## RPC

| Función | Qué hace |
|---|---|
| `inv_obtener(sede, mes)` | Devuelve el inventario registrado o la propuesta (sin crear nada) |
| `inv_cambiar(sede, mes, accion, producto, cantidad)` | `accion` = `cantidad` / `agregar` / `quitar`. Crea el inventario desde la propuesta si no existe, aplica el cambio y actualiza última modificación. Rechaza mes futuro y sede inactiva |

Mes actual calculado en BD: `date_trunc('month', now() at time zone 'America/Bogota')`.

Propagación de costo/nombre (R5): se hace dentro de las mismas funciones que guardan el costo (spec 02) y editan el producto/sede, solo para `mes = mes actual` y sedes activas. Ver pendiente de simplificación en requirements.

## Pantalla

`/admin/inventario?sede=…&mes=2026-10`
- Arriba: selector de mes (‹ octubre 2026 ›), total grande con aviso "sin costo" si aplica, "Últ. cambio: Nombre · fecha".
- Tabla: Producto | Cantidad (input mono) | Costo | Valor | 🗑. Botón "+ Producto" con buscador.
- "Todas": tabla resumen por sede + detalle por producto en dos pestañas.

## Pruebas

- pgTAP: abrir no registra; primer cambio registra; mes futuro rechazado; sede inactiva solo lectura; propagación al mes actual únicamente.
