# Requirements: 05 Inventario mensual

> Estado: **borrador**. Decisiones del usuario ya confirmadas, resumidas. Los detalles finos de uso de la pantalla quedan pendientes y se revisarán antes de implementar. Implementar después de las specs 01–04.

Depende de: specs 01 y 02 (costos por sede).

## Concepto

Conteo físico mensual de los productos de cada sede, valorizado con el costo de la sede. Solo para llevar cuentas: no se compara con ventas ni con el mes anterior y las ventas no lo afectan. Solo lo maneja el admin.

## R1. Un inventario por sede y mes

1. Existe como máximo un inventario por (sede, mes). Se puede trabajar el mes actual o meses anteriores, nunca futuros. La pantalla abre en el mes actual.
2. Siempre editable mientras la sede esté activa (sin cierre ni bloqueo).
3. Sede inactiva: sus inventarios son solo consulta; no se crean nuevos. Un mes sin inventario muestra "Sin inventario".

## R2. Propuesta y registro

1. Al abrir un mes sin inventario (sede activa) se muestra una **propuesta**: una línea por producto activo y habilitado en la sede, con la marca "Sin inventario", total $ 0 y sin última modificación.
2. Abrir o mirar el mes NO lo registra. Queda registrado con el primer cambio: escribir una cantidad, agregar o quitar un producto.
3. El admin puede agregar cualquier producto del catálogo de la sede que no esté en la lista (activo o no, habilitado o no).
4. Quitar una línea pide confirmación.
5. Líneas ordenadas alfabéticamente por nombre.

## R3. Líneas y valores

1. Cada línea guarda: producto, copia del nombre, cantidad contada (entero 0–999.999; vacía = 0) y copia del costo (puede estar vacía).
2. Valor de la línea = cantidad × costo. Sin costo → muestra "sin costo".
3. Total = suma de líneas con costo. Si hay alguna sin costo, el total lleva un aviso visual (ícono + color).
4. Se muestra quién y cuándo hizo la última modificación.

## R4. Guardado

1. La cantidad se guarda sola al salir del campo / Enter, con las mismas reglas de autoguardado de spec 02 R4 (sin cambio no guarda, inválido revierte, error → Reintentar).

## R5. Copias de costo y nombre

1. Al crear una línea, copia el costo y nombre vigentes.
2. Cambio de costo o de nombre de producto → actualiza solo el inventario del **mes actual** de las sedes **activas** y cuenta como última modificación. Meses anteriores y sedes inactivas no cambian.
3. Al reactivar una sede, su inventario del mes actual (si existe) toma costos y nombres vigentes y cuenta como última modificación.
4. Editar un producto sin cambiar el nombre no afecta el inventario.

## R6. Vista "Todas las sedes"

1. Resumen por sede del mes: total de cada sede ("Sin inventario" si no tiene), total general y avisos de "sin costo". Orden: activas primero, alfabético.
2. Detalle por producto separado en Panadería y Asadero: cantidad y valor sumados entre sedes, solo productos contados ese mes, con el nombre vigente del catálogo, orden alfabético.

## Pendientes (decidir antes de implementar)

- Detalles finos de uso de la pantalla (navegación entre meses, foco/teclado para contar rápido, cómo se muestra "agregar producto"). La sesión anterior los dejó abiertos sin registrarlos.
- Simplificación posible: ¿hace falta que el cambio de costo/nombre actualice el mes actual automáticamente, o basta con copiar el costo al crear la línea y un botón "Actualizar costos"? Lo segundo es mucho más simple.
