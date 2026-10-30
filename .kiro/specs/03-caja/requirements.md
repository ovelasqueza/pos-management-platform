# Requirements: 03 Caja (turno, venta, cobro, ticket, gastos, cierre)

Depende de: specs 01 y 02.

## R1. Abrir turno

1. SI el cajero no tiene turno abierto, la caja DEBE mostrar solo la pantalla "Abrir turno" con el campo Base (teclado numérico) y el botón Abrir.
2. La base es entero ≥ 0. Al abrir se registra cajero, sede, base y hora, y se pasa a la pantalla de venta.
3. Un cajero NO DEBE tener dos turnos abiertos.
4. En esta pantalla hay un botón "Reimprimir último reporte".

## R2. Venta

1. La pantalla de venta muestra la cuadrícula de productos vendibles (orden alfabético, foto o iniciales, nombre, precio) y el carrito al lado.
2. Arriba: buscador (ignora mayúsculas y tildes) y filtros por categoría ("Todos" + categorías con productos).
3. Tocar un producto lo agrega con cantidad 1; tocarlo otra vez suma 1.
4. Cada línea del carrito tiene − / cantidad / + y quitar. Tocar la cantidad abre teclado numérico (1 a 999). Con cantidad 1, "−" quita la línea.
5. El carrito muestra nombre, cantidad, precio unitario, subtotal y el Total grande. Botón "Vaciar" con confirmación.
6. El botón Cobrar está deshabilitado con el carrito vacío o sin conexión.
7. El carrito se conserva al recargar la página.
8. Barra superior mínima: sede, nombre del cajero, y botones Ventas, Gastos, Cerrar turno, Salir.
9. Al tocar Salir con turno abierto, avisar que el turno sigue abierto.

## R3. Cobro

1. Cobrar abre un modal con el Total y tres botones grandes: Efectivo, Transferencia, Tarjeta.
2. Efectivo: teclado numérico + atajos "Exacto", $2.000, $5.000, $10.000, $20.000, $50.000, $100.000 (los billetes se suman). Muestra el Cambio. Si falta dinero, muestra cuánto falta y no deja confirmar.
3. Transferencia / Tarjeta: se confirma directo por el Total.
4. Cancelar vuelve al carrito sin cambios.
5. SI un precio cambió o un producto dejó de venderse antes de confirmar, el sistema DEBE actualizar el carrito, mostrar el aviso y pedir confirmar otra vez.

## R4. Registro de venta

1. Al confirmar, se registra la venta con número consecutivo por sede, fecha/hora, cajero, sede, turno, líneas (nombre y precio copiados), total, método y, en efectivo, recibido y cambio.
2. El total se calcula en la base de datos con los precios vigentes. Todo o nada.
3. Un mismo cobro reenviado NO DEBE crear dos ventas.
4. SI falla la conexión, se conserva el carrito y aparece "Reintentar".
5. Tras registrar: carrito vacío, confirmación con el Cambio grande (si es efectivo) y se imprime el ticket.
6. Sin turno abierto (p. ej. cerrado por el admin) no se puede vender: aviso y vuelta a "Abrir turno".

## R5. Ticket (80 mm)

1. Contiene: sede (y dirección/teléfono si existen), número de venta, fecha y hora, cajero, líneas (nombre, cant., unitario, subtotal), total, método; en efectivo, recibido y cambio.
2. La venta queda registrada aunque la impresión falle.
3. "Ventas" muestra las ventas del turno (número, hora, total, método) con botón Reimprimir que imprime con la marca COPIA.

## R6. Gastos

1. "Gastos" abre un panel con la lista del turno (hora, descripción, monto) y formulario monto + descripción.
2. Monto entero > 0 y descripción obligatoria.
3. SI el monto supera el efectivo esperado, se rechaza con "No hay suficiente efectivo en caja" sin mostrar el esperado.
4. Un gasto se puede anular con confirmación mientras el turno está abierto; queda marcado como anulado y no cuenta.

## R7. Cierre de turno (arqueo ciego)

1. SI el carrito tiene productos, no se puede cerrar: aviso "Vacía el carrito primero".
2. Se pide el Efectivo contado (entero ≥ 0) sin mostrar el esperado, y una confirmación que muestra solo lo contado.
3. Al confirmar, la BD cierra el turno y guarda contado, esperado (base + ventas en efectivo − gastos vigentes) y diferencia (contado − esperado).
4. Pantalla de resultado: esperado, contado y diferencia con color e ícono: Cuadrada (verde), Sobrante (ámbar), Faltante (rojo). Se imprime el reporte automáticamente.
5. Botones: "Reimprimir reporte" y "Finalizar" (cierra la sesión para el siguiente cajero).
6. SI falla la conexión al cerrar, conservar lo contado y ofrecer Reintentar.
7. Un turno cerrado no se puede modificar.

## R8. Reporte de turno (80 mm)

1. Contiene: sede, cajero, apertura y cierre, base, cantidad y total de ventas, total por método (transferencia y tarjeta aparte del efectivo), gastos vigentes con total, esperado, contado, diferencia con su clasificación, unidades y valor vendidos por producto, y líneas de firma Cajero y Encargado.
2. Reimprimir usa exactamente los mismos datos del cierre y lleva la marca COPIA.
3. SI el turno lo cerró el admin, el reporte lo indica.

## R9. Turnos desde el admin

1. La pantalla Turnos del admin lista turnos abiertos (cajero, sede, apertura) de la selección actual y los cerrados del rango de fechas.
2. El admin puede cerrar un turno abierto ingresando el efectivo contado; mismos cálculos, queda registrado quién cerró.
3. El admin puede ver y reimprimir el reporte de cualquier turno cerrado.
