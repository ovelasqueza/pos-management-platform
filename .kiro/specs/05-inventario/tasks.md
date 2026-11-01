# Tasks: 05 Inventario por fecha (v3)

> Código listo (2026-10-31); typecheck, lint, build y 33 tests Vitest OK. Migración `20261031130000_inventario.sql` ejecutada y verificada (ver `docs/bd/README.md`). La migración se probó con 50 comprobaciones en un Postgres local (PGlite); `supabase test db` no se pudo correr (sin Docker).
> Descarga solo en CSV, sin PDF.

- [x] 1. Migración: tipos, `articulos_inventario`, `inventarios`, `lineas_inventario`, índice de un en curso por sede, trigger de finalizado, RLS solo admin
  - _R: R1, R3, R4, R5_
- [x] 2. RPC (`inv_crear`, `inv_cantidad`, `inv_agregar`, `inv_quitar`, `inv_actualizar_costos`, `inv_editar`, `inv_finalizar`, `inv_reabrir`, `inv_borrar`) + vista `inventarios_resumen` (reemplaza `inv_obtener` / `inv_resumen`)
  - _R: R3–R6_
- [x] 3. Pruebas pgTAP (`supabase/tests/database/05_inventario.test.sql`)
- [x] 4. Lógica pura `lib/dominio/inventario.ts` (fracciones, valores, totales, CSV) + tests Vitest
  - _R: R2, R5, R7_
- [x] 5. Pantalla Artículos de la sede (`/admin/[sede]/inventario/articulos`)
  - _R: R1_
- [x] 6. Lista de inventarios y "+ Inventario" / "Continuar inventario"
  - _R: R3, R4.2, R8.1_
- [x] 7. Detalle para contar (autoguardado, Enter a la siguiente, +¼ +½ +¾, agregar, quitar, actualizar costos, finalizar, "Editar" discreto, borrar en curso)
  - _R: R2, R4–R6, R8.2_
- [x] 8. Descargar Excel (CSV)
  - _R: R7_
- [x] 9. Vista "Todas las sedes" (último finalizado por sede + en curso)
  - _R: R8.4_
- [x] 10. `docs/bd/README.md` y verificación (`npm run build`, `npm test`)
- [ ] 11. Prueba manual en la app: crear artículos, inventario, contar con fracciones, finalizar, editar, descargar CSV
