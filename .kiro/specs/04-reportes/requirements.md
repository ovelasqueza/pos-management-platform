# Requirements: 04 Reportes del admin

Depende de: specs 01–03. Todos los reportes respetan la sede escogida (o "Todas") y un rango de fechas.

## R1. Rango de fechas

1. Por defecto: hoy (America/Bogota). Atajos: Hoy, Ayer, 7 días, Este mes, y fechas manuales.
2. SI la fecha inicial es posterior a la final, se marcan las fechas y no se consulta.
3. Ventas y gastos se asignan al día según su hora en America/Bogota. Turnos, según su hora de apertura.
4. El rango se guarda en la URL junto con la sede.

## R2. Resumen (pantalla inicial al escoger sede)

1. Cuatro tarjetas: Total vendido, # de ventas, total por método (efectivo / transferencia / tarjeta) y total de gastos.
2. Gráfico de barras simple con el total vendido por día del rango.
3. En "Todas", debajo: tabla con el total por sede. La suma de las sedes debe ser igual al consolidado.

## R3. Ventas

1. Lista: número, fecha y hora, sede (solo en "Todas"), cajero, total, método.
2. Tocar una venta muestra sus líneas.

## R4. Gastos

1. Lista: fecha y hora, sede (en "Todas"), cajero, descripción, monto, estado. Anulados tachados y fuera del total.
2. Total de gastos vigentes arriba.

## R5. Turnos

1. Lista de turnos del rango: cajero, sede, apertura, cierre, estado, ventas, gastos, esperado, contado, diferencia con color e ícono (Cuadrada/Sobrante/Faltante). Marca si lo cerró el admin.
2. Detalle muestra el reporte del turno con botón Imprimir (80 mm). (Cerrar turnos abiertos: spec 03 R9.)

## R6. Ventas por producto

1. Lista: producto, unidades y valor vendido; orden por unidades (desc) con opción de ordenar por valor o nombre.
2. Buscador (sin mayúsculas ni tildes).
3. En "Todas": ícono del tipo de sede y las unidades por sede de cada producto.

## R7. Rendimiento

1. Cada reporte debe cargar en menos de 2 s con un mes de datos de todas las sedes.
