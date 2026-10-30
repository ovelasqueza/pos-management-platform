# Tasks: 02 Catálogo y precios

> Código listo. Pendiente: ejecutar `supabase/migrations/20261028110000_catalogo.sql` (ver `docs/bd/README.md`) y probar en local.
> Por indicación del usuario no se agregaron tests nuevos en esta spec.
>
> **Cambio (2026-10-28, pedido del usuario): Productos y Precios unificados en una sola pantalla.**
> - Con una sede escogida: tabla con foto, nombre y categoría, interruptor "Vende", precio de venta y costo (guardado automático) y lápiz para editar el producto. Botones "+ Producto" y "Categorías" arriba.
> - En "Todas las sedes": catálogos por tipo con precio de referencia.
> - "Activo" y "Eliminar" pasaron al modal de edición (menos controles por fila). `/precios` redirige a `/productos` y se quitó del menú.
> - Indicador de carga instantáneo (`loading.tsx`) en todas las secciones del admin.

- [x] 1. Migración del catálogo
  - Tablas `categorias`, `productos`, `productos_sede`, `costos_producto_sede`
  - Llaves compuestas `(id, tipo)`: una sede solo tiene productos de su catálogo y la categoría es del mismo catálogo
  - Triggers de alta automática; tipo de producto inmutable; RPC `aplicar_precio_referencia`
  - Vista `productos_vendibles`; RLS; bucket `productos` en Storage
  - _R: R1.2, R1.3, R2, R3.5_

- [x] 2. Pantalla Productos
  - Pestañas por tipo (por defecto, el tipo de la sede escogida), lista, modal crear/editar con imagen (JPG/PNG/WebP, 2 MB)
  - Activar/desactivar; eliminar con confirmación (si tiene ventas o inventarios, la BD lo impide y se sugiere desactivar)
  - _R: R1.1–R1.7_

- [x] 3. Gestión de categorías
  - Modal con lista, crear, renombrar, eliminar (bloqueado si tiene productos, indicando cuántos)
  - _R: R1.5_

- [x] 4. Lógica de autoguardado
  - `lib/dominio/autoguardado.ts` (función pura `decidir`) + componente `CampoAutoguardado`
  - _R: R4_

- [x] 5. Pantalla Precios
  - Tabla por sede con interruptor, precio y costo con guardado automático, ✓ al guardar, Reintentar si falla; buscador sin tildes
  - "Aplicar este precio a todas las sedes" al editar el precio de referencia (en Productos)
  - En "Todas las sedes" pide escoger una sede
  - _R: R3, R4_

- [ ] 6. Prueba en local con la BD
  - Ejecutar la migración 02, crear productos y categorías, cambiar precios y costos
  - Reflejo en la caja (R5) se implementa con la pantalla de venta en la spec 03
