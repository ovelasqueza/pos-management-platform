# Requirements: 06 Caja mayor

> Estado: **v1 (2026-11-01)**, aprobada por el usuario (definida con el contador) e implementada.

Depende de: specs 01, 03 y 04.

## Concepto

- **Caja menor**: el cajón del turno (lo que existe hoy). Arranca con la base en efectivo.
- **Caja mayor**: un saldo **por sede** que se va acumulando. Es un solo saldo discriminado en tres partes: **Efectivo**, **QR** y **Tarjeta**.
- Con la caja mayor se pagan gastos (por ejemplo, un pedido). El cajero decide de dónde sale cada gasto.

## Decisiones tomadas sin confirmación explícita

El usuario aprobó estas propuestas ("sí, procede"):

- D1. Al cerrar, el cajero primero cuenta todo el efectivo (arqueo ciego) y después dice cuánto va a la caja mayor. La diferencia se calcula sobre todo lo contado.
- D2. El efectivo que no va a la caja mayor **queda en caja** y aparece como base sugerida del siguiente turno de la sede (el cajero la puede cambiar).
- D3. Un gasto pagado con la caja mayor sale de una parte que escoge el cajero (Efectivo, QR o Tarjeta).
- D4. Si el gasto supera el saldo de esa parte, se rechaza. La caja mayor nunca queda en negativo.
- D5. Anular un gasto devuelve a la caja mayor lo que salió de ella.
- D6. Si el admin cierra un turno, él decide cuánto efectivo va a la caja mayor.
- D7. Los movimientos del admin llevan parte y descripción obligatoria.
- D8. Gastos y turnos anteriores quedan como caja menor. La caja mayor de cada sede arranca en $ 0 hasta que el admin fije el saldo.

## R1. Saldo de la caja mayor

1. Cada sede tiene una caja mayor con saldo en Efectivo, QR y Tarjeta, y un total (la suma).
2. Ninguna parte puede quedar en negativo (D4).
3. El saldo solo cambia por movimientos registrados: cierre de turno, gasto, anulación de gasto y movimiento del admin. Los movimientos no se modifican ni se borran.
4. Al crear una sede, su caja mayor queda en $ 0 (D8).

## R2. Gastos con origen

1. Al registrar un gasto, el cajero escoge **de dónde sale**: Caja, Caja mayor o Ambas.
2. Caja mayor: escribe cuánto sale de cada parte (Efectivo, QR, Tarjeta); puede usar varias a la vez y deben sumar el monto (ajuste 2026-11-01, reemplaza D3).
3. Ambas: escribe cuánto sale de cada parte de la caja mayor; el resto sale del **cajón** y se muestra en un recuadro aparte. Las dos cosas son mayores que $ 0.
4. Lo que sale de la caja no puede superar el efectivo esperado; el rechazo no revela el esperado (igual que hoy).
5. Lo que sale de la caja mayor no puede superar el saldo de esa parte: "No hay suficiente en caja mayor" (D4).
6. Lo que sale de la caja mayor **no** se resta del efectivo esperado del turno.
7. La lista de gastos del turno muestra el origen de cada uno.
8. Anular un gasto devuelve a la caja mayor su parte (D5). El anulado no cuenta en ningún saldo ni reporte.

## R3. El cajero ve el saldo

1. El cajero ve el saldo de la caja mayor de su sede (Efectivo, QR, Tarjeta y total) en el panel de Gastos y al cerrar. No lo puede modificar.

## R4. Cierre de turno

1. Efectivo esperado = base + ventas en efectivo − gastos que salieron de la caja.
2. El cajero cuenta el efectivo sin ver el esperado y confirma lo contado (como hoy).
3. Luego indica cuánto de lo contado va a la caja mayor (de $ 0 a lo contado). Se muestra "Queda en caja" = contado − enviado (D1).
4. Al confirmar, en una sola operación: se cierra el turno y entran a la caja mayor el efectivo enviado (a Efectivo), las ventas QR del turno (a QR) y las ventas con tarjeta (a Tarjeta).
5. La pantalla de resultado muestra, además de esperado, contado y diferencia: lo enviado a la caja mayor por parte y lo que queda en caja.
6. Si el admin cierra el turno, él indica cuánto efectivo va a la caja mayor (D6).

## R5. Apertura del turno siguiente

1. Al abrir turno, la base viene sugerida con lo que quedó en caja en el último cierre de la sede. El cajero la puede cambiar (D2).

## R6. Reporte de turno (80 mm)

1. Cada gasto muestra su origen (Caja / Caja mayor · parte / Ambas con los dos montos).
2. Totales separados: gastos de caja (los que se restan del esperado) y gastos de caja mayor.
3. Sección "Caja mayor": efectivo enviado, QR, tarjeta y total enviado, y "Queda en caja".
4. Los turnos cerrados antes de esta spec se reimprimen igual que antes.

## R7. Admin: pantalla Caja mayor

1. Con una sede escogida: saldo por parte y total; botones **Sumar**, **Quitar** y **Fijar saldo** (D7). Fijar en $ 0 deja la parte vacía.
2. Quitar no puede dejar la parte en negativo.
3. Lista de movimientos del rango de fechas (más reciente primero, 50 por página): fecha y hora, tipo (Cierre de turno, Gasto, Gasto anulado, Admin), parte, entrada o salida, saldo de la parte después del movimiento, cajero o admin y descripción. Tocar un movimiento de turno abre el reporte del turno.
4. En "Todas": tabla con el saldo de cada sede por parte y el total general.
5. Solo el admin hace movimientos manuales (R7.1).

## R8. Reportes existentes

1. Cuadre diario: los gastos se separan en caja y caja mayor para que cada fila cuadre (esperado = base + efectivo − gastos de caja).
2. Resumen y lista de gastos: el total de gastos incluye ambos orígenes; la lista muestra el origen.
3. "Ver caja" de un turno abierto (admin): esperado con la regla nueva y gastos con origen.

## Fuera de alcance

- Separar la caja mayor en cuentas bancarias (Nequi, Daviplata, banco).
- Transferir saldo entre sedes.
- Que el cajero haga movimientos manuales en la caja mayor.
