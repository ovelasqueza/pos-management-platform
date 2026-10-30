# Tasks: 04 Reportes

> Código listo; typecheck, lint, build y tests existentes OK. Pendiente: ejecutar `supabase/migrations/20261028130000_reportes.sql` (ver `docs/bd/README.md`) y probar en local.
> Cambio respecto al diseño: no se usan columnas `fecha` generadas; se filtra por `creado_en`/`abierto_en` con los límites del día en Bogotá (UTC−5) y se agregaron índices por fecha.

- [x] 1. Migración de reportes
  - `privado.rango_bogota` (valida rango ≤ 1 año); `rep_resumen`, `rep_ventas_por_dia`, `rep_productos` (solo admin)
  - _R: R1.3, R2, R6, R7_

- [x] 2. Filtro de fechas
  - Atajos Hoy / Ayer / 7 días / Este mes + fechas manuales; rango en la URL; error si la inicial es posterior a la final
  - _R: R1_

- [x] 3. Resumen (pantalla inicial de cada sede)
  - Tarjetas: vendido, # ventas, por método, gastos; gráfico de barras CSS; tabla por sede con total en "Todas"
  - _R: R2_

- [x] 4. Reportes de ventas y gastos
  - Listas paginadas (50); detalle de venta con reimprimir; gastos anulados tachados y fuera del total
  - _R: R3, R4_

- [x] 5. Reporte de turnos
  - Turnos con apertura en el rango, diferencia con color/ícono, marca "Admin", ver/imprimir reporte
  - _R: R5_

- [x] 6. Ventas por producto
  - Orden por unidades / valor / nombre, buscador sin tildes, desglose por sede e ícono del tipo en "Todas"
  - _R: R6_

- [ ] 7. Prueba en local con la BD
