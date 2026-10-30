# Tasks: 03 Caja

> Código listo; typecheck, lint, build y tests existentes OK. Pendiente: ejecutar `supabase/migrations/20261028120000_caja.sql` (ver `docs/bd/README.md`) y probar en local.
>
> **Ajustes de uso (2026-10-28, pedido del usuario):**
> - Pantalla de venta fija (sin scroll de página); solo la lista de productos se desplaza por dentro.
> - Categorías arriba en cuadros pequeños que se acomodan en filas (todas visibles). Buscar ignora la categoría.
> - Cobro sin ventanas emergentes: el área de productos se vuelve el panel de cobro con billetes ($2.000 a $100.000) y monedas ($50 a $1.000) de Colombia que se suman al tocarlos, "Exacto" que cobra de una vez, "Otro valor" con teclado. Al cobrar vuelve a la venta y muestra un aviso con el cambio hasta tocar el siguiente producto.
> - Carrito: nombre completo del producto arriba y controles debajo.
> - **Una caja por sede** (migración `20261028150000_un_turno_por_sede.sql`): si otro cajero tiene el turno abierto se muestra "Caja ocupada" con su nombre y hora; al cerrar, "Siguiente cajero" lleva al inicio de sesión con el aviso "Turno cerrado".

- [x] 1. Migración de turnos, ventas y gastos
  - Tablas, índice de un turno abierto por cajero, ventas/líneas inmutables, turno cerrado inmutable
  - Amplía `validar_sede` (no desactivar con turnos abiertos, indica qué cajeros) y `validar_perfil` (cajero con turno abierto)
  - RLS de solo lectura; escritura solo por RPC
  - _R: R1.3, R4.1, R7.7_

- [x] 2. RPC de dinero
  - `abrir_turno`, `registrar_venta` (idempotente por `clave`, total con precios de la BD, `PRECIOS_ACTUALIZADOS`), `ticket_venta`, `registrar_gasto` (≤ efectivo esperado sin revelarlo), `anular_gasto`, `cerrar_turno` (arqueo ciego + instantánea del reporte)
  - _R: R1, R4.1–R4.3, R6, R7.3, R9.2_

- [x] 3. Lógica pura
  - `lib/dominio/carrito.ts`, `cobro.ts`, `documentos.ts`, `fechas.ts`
  - _R: R2.3–R2.5, R3.2, R7.4_

- [x] 4. Pantalla Abrir turno (teclado numérico, reimprimir último reporte)
  - _R: R1_

- [x] 5. Pantalla de venta
  - Cuadrícula con búsqueda sin tildes y categorías; carrito persistido por turno; barra superior; indicador sin conexión; carrito fijo abajo en móvil
  - Refresco de productos y del estado del turno cada 30 s y al volver a la pestaña
  - _R: R2, spec 02 R5_

- [x] 6. Modal de cobro y registro
  - 3 métodos, teclado, billetes, Exacto, cambio/falta; misma clave al reintentar el mismo carrito; carrito ajustado si cambian precios
  - _R: R3, R4_

- [x] 7. Impresión 80 mm: ticket y reporte (marca COPIA en reimpresiones); lista de ventas del turno con Reimprimir
  - _R: R5, R8_

- [x] 8. Panel de gastos (registrar, anular con confirmación)
  - _R: R6_

- [x] 9. Cierre de turno y resultado (arqueo ciego, confirmación, color/ícono, impresión automática, Finalizar)
  - _R: R7_

- [x] 10. Turnos en el admin: abiertos, cerrados recientes (50), cerrar turno, ver/imprimir reporte
  - _R: R9_ (el filtro por rango de fechas llega con la spec 04)

- [ ] 11. Prueba manual en local con la BD
  - Abrir → vender con los 3 métodos → gasto → cerrar → imprimir
