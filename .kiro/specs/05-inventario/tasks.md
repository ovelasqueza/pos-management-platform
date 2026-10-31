# Tasks: 05 Inventario por fecha (v3)

> Spec cerrada (2026-10-31). Descarga solo en CSV, sin PDF.

- [ ] 1. Migración: tipos, `articulos_inventario`, `inventarios`, `lineas_inventario`, índice de un en curso por sede, trigger de finalizado, RLS solo admin
  - _R: R1, R3, R4, R5_
- [ ] 2. RPC (`inv_crear`, `inv_obtener`, `inv_cantidad`, `inv_agregar`, `inv_quitar`, `inv_actualizar_costos`, `inv_editar`, `inv_finalizar`, `inv_reabrir`, `inv_borrar`, `inv_resumen`)
  - _R: R3–R6_
- [ ] 3. Pruebas pgTAP
- [ ] 4. Lógica pura `lib/dominio/inventario.ts` (fracciones, valores, totales) + tests Vitest
  - _R: R2, R5_
- [ ] 5. Pantalla Artículos de la sede
  - _R: R1_
- [ ] 6. Lista de inventarios y "+ Inventario" / "Continuar"
  - _R: R3, R4.2, R8.1_
- [ ] 7. Detalle para contar (autoguardado, Enter a la siguiente, atajos de fracción, agregar, quitar, actualizar costos, finalizar, editar finalizado)
  - _R: R2, R4–R6, R8.2_
- [ ] 8. Descargar Excel (CSV)
  - _R: R7_
- [ ] 9. Vista "Todas las sedes"
  - _R: R8.4_
- [ ] 10. Actualizar `docs/bd/README.md`; verificación `npm run build`, `npm test`, `npx supabase test db`
