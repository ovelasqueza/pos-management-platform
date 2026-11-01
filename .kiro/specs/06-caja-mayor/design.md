# Design: 06 Caja mayor

## Modelo de datos

```sql
-- Saldo actual por sede y parte. Se actualiza solo desde privado.mover_caja_mayor.
-- El check impide saldos negativos aunque dos operaciones choquen.
create table caja_mayor_saldos (
  sede_id uuid references sedes,
  parte metodo_pago,                 -- 'efectivo' | 'transferencia' (QR) | 'tarjeta'
  saldo bigint not null default 0 check (saldo >= 0),
  primary key (sede_id, parte)
);

create type tipo_movimiento_mayor as enum ('cierre_turno', 'gasto', 'anulacion_gasto', 'admin');

-- Historial inmutable (trigger privado.rechazar_cambio)
create table caja_mayor_movimientos (
  id uuid primary key default gen_random_uuid(),
  sede_id uuid not null references sedes,
  parte metodo_pago not null,
  tipo tipo_movimiento_mayor not null,
  monto int not null check (monto <> 0),     -- + entra, − sale
  saldo_despues bigint not null,             -- saldo de la parte tras el movimiento
  turno_id uuid references turnos,
  gasto_id uuid references gastos,
  usuario_id uuid not null references perfiles,
  descripcion text check (descripcion is null or length(trim(descripcion)) between 1 and 120),
  creado_en timestamptz not null default now(),
  check (tipo <> 'admin' or descripcion is not null)
);
create index on caja_mayor_movimientos (sede_id, creado_en desc);

-- Gastos: origen del dinero. monto sigue siendo el total del gasto.
alter table gastos
  add column monto_mayor int not null default 0,          -- gastos anteriores = caja (D8)
  add column parte_mayor metodo_pago,                     -- de qué parte de la caja mayor
  add column monto_caja int generated always as (monto - monto_mayor) stored;  -- resta del esperado
alter table gastos
  add check (monto_mayor between 0 and monto),
  add check ((monto_mayor = 0) = (parte_mayor is null));

-- Turnos: cuánto efectivo se envió a la caja mayor al cerrar (null en turnos anteriores)
alter table turnos add column efectivo_a_mayor int check (efectivo_a_mayor >= 0);
```

- Trigger `al_crear_sede` crea las 3 filas de `caja_mayor_saldos` en $ 0; el script las crea para las sedes existentes.
- `gastos` ya no se puede borrar ni cambiar de monto/origen (solo `anulado_en`), por trigger.

## Función central

`privado.mover_caja_mayor(sede, parte, monto, tipo, turno, gasto, usuario, descripcion)`:
`update caja_mayor_saldos set saldo = saldo + monto … returning saldo` (bloquea la fila) e inserta el movimiento con `saldo_despues`. Si el check de saldo falla → `CAJA_MAYOR_INSUFICIENTE`. Movimientos de $ 0 no se registran.

## RPC

| Función | Cambio |
|---|---|
| `privado.efectivo_esperado(turno)` | `create or replace`: resta `sum(monto_caja)` de gastos vigentes (antes `sum(monto)`). Mismo resultado para gastos anteriores |
| `registrar_gasto(p_monto, p_descripcion, p_monto_mayor int default 0, p_parte_mayor metodo_pago default null)` | Nueva versión (se borra la de 2 argumentos). Valida `monto_caja ≤ esperado` (`EFECTIVO_INSUFICIENTE`, sin revelar) y mueve `−monto_mayor` en la parte |
| `anular_gasto(p_gasto)` | `create or replace`: si `monto_mayor > 0`, mueve `+monto_mayor` (tipo `anulacion_gasto`) |
| `cerrar_turno(p_turno, p_contado, p_a_mayor int default 0)` | Nueva versión (se borra la de 2). Valida `0 ≤ p_a_mayor ≤ p_contado` (`ENVIO_MAYOR_INVALIDO`). Mueve efectivo enviado, QR y tarjeta del turno (tipo `cierre_turno`). Guarda `efectivo_a_mayor` y el reporte nuevo |
| `privado.armar_reporte(...)` | Agrega a cada gasto `monto_caja`, `monto_mayor`, `parte_mayor`; `gastos_caja`, `gastos_mayor`; bloque `caja_mayor: {efectivo, transferencia, tarjeta, total}` y `queda_en_caja`. `gastos_total` sigue siendo el total |
| `caja_mayor_saldo()` (cajero) | Saldo de la sede del cajero por parte + total. Solo lectura |
| `base_sugerida()` (cajero) | `contado − efectivo_a_mayor` del último turno cerrado de su sede (null si no hay o es anterior a la spec) |
| `caja_mayor_ajustar(p_sede, p_parte, p_monto, p_descripcion)` (admin) | Sumar (+) o quitar (−). Sede activa o inactiva |
| `caja_mayor_fijar(p_sede, p_parte, p_saldo, p_descripcion)` (admin) | Registra la diferencia contra el saldo actual (si es 0, no hace nada) |
| `rep_caja_turno` | `create or replace`: esperado con `monto_caja`; gastos con origen |
| `rep_cuadre_diario` | `drop` + `create`: columna `gastos` → `gastos_caja` y nueva `gastos_mayor`, `a_mayor` |

Orden de bloqueo para evitar abrazos mortales: turno (`for update`) → fila de `caja_mayor_saldos`.

Las RPC del cajero siguen pasando por el trigger de equipo (`gastos_equipo`, `turnos_equipo`).

Los argumentos nuevos tienen valor por defecto: la app anterior sigue funcionando (gastos solo de caja, cierre sin enviar efectivo; QR y tarjeta pasan igual a la caja mayor). Conviene publicar la app el mismo día.

## RLS

| Tabla | Admin | Cajero |
|---|---|---|
| caja_mayor_saldos | leer | nada (usa `caja_mayor_saldo()`) |
| caja_mayor_movimientos | leer | nada |

Escritura solo por RPC.

## Lógica pura (`lib/dominio/cajaMayor.ts`)

- `repartirGasto(monto, origen, montoMayor)` → `{ montoCaja, montoMayor }` con validación (Ambas: las dos > 0).
- `quedaEnCaja(contado, aMayor)`, validación de `aMayor`.
- Etiquetas de parte (`transferencia` → "QR") y de tipo de movimiento.
- Tests Vitest.

## Pantallas

**Caja · Gastos**: arriba el saldo de la caja mayor (Efectivo · QR · Tarjeta). Formulario: Monto, Descripción y "Sale de" con 3 botones `[Caja] [Caja mayor] [Ambas]`. Caja mayor y Ambas muestran la parte `[Efectivo] [QR] [Tarjeta]`; Ambas agrega "De caja mayor" (el resto se muestra como "De caja"). La lista muestra el origen con un ícono pequeño.

**Caja · Cerrar turno**: paso 1 igual que hoy (contado ciego + confirmación). Paso 2 "A caja mayor" con teclado numérico, botones "Todo" y "Nada", y "Queda en caja $ X". Luego cierra.

**Caja · Resultado del cierre**: agrega "A caja mayor" (efectivo, QR, tarjeta) y "Queda en caja".

**Caja · Abrir turno**: base con el valor sugerido ya escrito.

**Admin · Caja mayor** (`/admin/[sede]/caja-mayor`, nuevo ítem del menú): tarjetas Efectivo, QR, Tarjeta y Total; botones Sumar, Quitar, Fijar (modal: parte, monto, descripción). Debajo `FiltroFechas` y la lista de movimientos (50 por página). En "Todas": tabla de saldos por sede.

**Admin · Turnos (cerrar)**: el modal de cierre agrega "A caja mayor".

**Reporte de turno (80 mm)**: gastos con origen, totales de caja y de caja mayor, sección Caja mayor y "Queda en caja". Si el reporte guardado no trae `caja_mayor` (turnos anteriores), se imprime como antes.

## Pruebas pgTAP (`06_caja_mayor.test.sql`)

- Gasto de caja mayor no cambia el esperado; gasto de caja sí.
- Gasto mayor al saldo de la parte → rechazado; Ambas reparte bien.
- Anular devuelve a la caja mayor.
- Cierre: QR y tarjeta entran completos; efectivo enviado ≤ contado; `queda_en_caja` correcto.
- Fijar y quitar no dejan saldo negativo; cajero no lee tablas ni hace ajustes.
- Movimientos inmutables; `saldo_despues` coincide con el saldo.
