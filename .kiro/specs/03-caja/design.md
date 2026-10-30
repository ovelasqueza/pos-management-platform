# Design: 03 Caja

## Modelo de datos

```sql
create type metodo_pago as enum ('efectivo', 'transferencia', 'tarjeta');

create table turnos (
  id uuid primary key default gen_random_uuid(),
  sede_id uuid not null references sedes,
  cajero_id uuid not null references perfiles,
  base int not null check (base >= 0),
  abierto_en timestamptz not null default now(),
  cerrado_en timestamptz,
  cerrado_por uuid references perfiles,
  efectivo_contado int,
  efectivo_esperado int,
  diferencia int,
  reporte jsonb               -- instantánea para imprimir/reimprimir
);
create unique index un_turno_abierto on turnos (cajero_id) where cerrado_en is null;

create table contadores_venta (sede_id uuid primary key references sedes, ultimo int not null default 0);

create table ventas (
  id uuid primary key default gen_random_uuid(),
  clave uuid not null unique,         -- idempotencia
  numero int not null,
  sede_id uuid not null references sedes,
  turno_id uuid not null references turnos,
  cajero_id uuid not null references perfiles,
  creado_en timestamptz not null default now(),
  total int not null,
  metodo metodo_pago not null,
  recibido int,
  cambio int,
  unique (sede_id, numero)
);

create table lineas_venta (
  venta_id uuid references ventas on delete cascade,
  producto_id uuid references productos,
  nombre text not null,
  precio int not null,
  cantidad int not null check (cantidad between 1 and 999),
  primary key (venta_id, producto_id)
);

create table gastos (
  id uuid primary key default gen_random_uuid(),
  turno_id uuid not null references turnos,
  monto int not null check (monto > 0),
  descripcion text not null,
  creado_en timestamptz not null default now(),
  anulado_en timestamptz
);
```

Ventas y líneas son inmutables (trigger que rechaza `update`/`delete`).

## RPC (todas `security definer`, una transacción)

| Función | Qué hace |
|---|---|
| `abrir_turno(base)` | Valida cajero activo y sede activa; crea turno |
| `registrar_venta(clave, metodo, lineas jsonb, recibido)` | Si `clave` existe devuelve la venta original. Lee precios vigentes; si difieren de los enviados o hay productos no vendibles → error `PRECIOS_ACTUALIZADOS` con los datos nuevos. Toma número con `update contadores_venta … returning`. Devuelve datos del ticket |
| `registrar_gasto(monto, descripcion)` | Bloquea el turno (`for update`) y valida monto ≤ esperado |
| `anular_gasto(id)` | Solo si el turno está abierto |
| `cerrar_turno(turno_id, contado)` | Cajero (su turno) o admin. Calcula esperado y diferencia, arma `reporte` jsonb, cierra |

`privado.efectivo_esperado(turno_id)` = base + Σ ventas efectivo − Σ gastos no anulados.

Se amplían los triggers de spec 01 (`validar_sede`, `validar_perfil`) para chequear turnos abiertos.

## RLS

Cajero: leer sus turnos, ventas/líneas/gastos de su turno abierto y el último cerrado (para reimprimir). Sin escritura directa: solo RPC. Admin: leer todo.

## Cliente (caja)

- `/caja` decide: sin turno → `AbrirTurno`; con turno → `Venta`; tras cerrar → `ResultadoCierre`.
- Carrito: `useReducer` puro en `lib/dominio/carrito.ts` (agregar, sumar, restar, fijar cantidad, quitar, vaciar, total) persistido en `localStorage` por `turno_id`.
- Cobro pendiente guarda su `clave` en `localStorage` hasta confirmar, para reintentos seguros.
- `navigator.onLine` + errores de red → indicador "Sin conexión" y Cobrar deshabilitado.
- Cálculo de cambio y billetes en `lib/dominio/cobro.ts`.

## Impresión

Componente `<Impresion80mm>` oculto en pantalla y visible solo en `@media print` (`@page { size: 80mm auto; margin: 0 }`). `Ticket` y `ReporteTurno` reciben datos y prop `copia`. Se dispara `window.print()` tras renderizar.

## Layout de la caja

```
┌──────────────────────────────────────────────┬──────────────────┐
│ Sede · Cajero      [Ventas][Gastos][Cerrar][Salir]               │
├──────────────────────────────────────────────┼──────────────────┤
│ 🔍 Buscar          [Todos][Panes][Bebidas]   │ Carrito          │
│ ┌────┐┌────┐┌────┐┌────┐                     │ Pan x3   $10.500 │
│ │foto││    ││    ││    │                     │ ...              │
│ │Pan ││    ││    ││    │                     │──────────────────│
│ │$3.5││    ││    ││    │                     │ TOTAL  $52.000   │
│ └────┘└────┘└────┘└────┘                     │ [   COBRAR    ]  │
└──────────────────────────────────────────────┴──────────────────┘
```

## Pruebas

- Vitest: carrito, cambio/billetes, clasificación de diferencia.
- pgTAP: venta idempotente, total con precio de BD, número consecutivo, gasto > esperado rechazado, cálculo de cierre, cajero no ve otras sedes.
