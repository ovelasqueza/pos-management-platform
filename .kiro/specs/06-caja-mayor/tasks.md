# Tasks: 06 Caja mayor

> Código listo (2026-11-01); typecheck, lint, build y 40 tests Vitest OK. La migración `20261101100000_caja_mayor.sql` se probó con las 15 migraciones en un Postgres local (PGlite) con 58 comprobaciones; las 50 de la spec 05 siguen pasando. `supabase test db` no se pudo correr (sin Docker).
> **Pendiente: ejecutar el script 15 en Supabase (ver `docs/bd/README.md`) y publicar la app el mismo día.**

- [x] 1. Migración `20261101100000_caja_mayor.sql`
  - Tablas `caja_mayor_saldos` y `caja_mayor_movimientos`, tipo `tipo_movimiento_mayor`, filas en $ 0 para sedes existentes y trigger para sedes nuevas
  - `gastos.monto_mayor/parte_mayor` y `monto_caja` calculada (gastos anteriores = caja); `turnos.efectivo_a_mayor`; gastos solo cambian para anularse
  - `privado.mover_caja_mayor`; `efectivo_esperado` con `monto_caja`
  - RPC: `registrar_gasto` (4 arg.), `anular_gasto`, `cerrar_turno` (3 arg.), `armar_reporte`, `caja_mayor_saldo`, `base_sugerida`, `caja_mayor_ajustar`, `caja_mayor_fijar`, `rep_caja_turno`, `rep_cuadre_diario`
  - Argumentos nuevos con valor por defecto: la app anterior sigue funcionando
  - RLS solo admin; movimientos inmutables
  - _R: R1, R2, R4, R5, R7, R8_
- [x] 2. Pruebas pgTAP `supabase/tests/database/06_caja_mayor.test.sql`
- [x] 3. Lógica pura `lib/dominio/cajaMayor.ts` + tests Vitest
- [x] 4. Caja: panel de Gastos con saldo y "Sale de"
  - _R: R2, R3_
- [x] 5. Caja: cierre en dos pasos y resultado con caja mayor; base sugerida al abrir
  - _R: R4, R5_
- [x] 6. Reporte de turno 80 mm con origen de gastos y sección Caja mayor (compatible con reportes viejos)
  - _R: R6_
- [x] 7. Admin: pantalla Caja mayor (saldos, Sumar/Quitar/Fijar, movimientos, vista "Todas") y menú
  - _R: R7_
- [x] 8. Admin: cierre de turno con "A caja mayor"; Ver caja, cuadre diario y lista de gastos con origen
  - _R: R4.6, R8_
- [x] 9. Errores nuevos en `lib/dominio/errores.ts` (`CAJA_MAYOR_INSUFICIENTE`, `ENVIO_MAYOR_INVALIDO`, `ORIGEN_INVALIDO`)
- [x] 10. `steering/product.md`, `docs/bd/README.md` (script 15), `verificar-bd` y verificación
- [x] 12. Ajuste (2026-11-01): gasto de caja mayor en varias partes (migración `20261101110000_gastos_varias_partes.sql`), "Cajón" en recuadro aparte, descripción sin texto de ejemplo
- [ ] 11. Prueba manual: gasto de cada origen, anular, cerrar enviando efectivo, abrir con base sugerida, ajustes del admin
