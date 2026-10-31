# Base de datos: registro de scripts

Los scripts están en `supabase/migrations/` y se ejecutan **en orden**, una sola vez, desde el panel de Supabase en **SQL Editor → New query**: pega el archivo completo y pulsa **Run**.

Después de ejecutar cada uno, marca la casilla y anota la fecha en la tabla.

| # | Archivo | Qué crea | Ejecutado |
|---|---|---|---|
| 01 | `supabase/migrations/20261028100000_base.sql` | Esquema `privado`; tipos `tipo_sede` y `rol_usuario`; tablas `sedes` y `perfiles`; funciones `privado.usuario_activo()`, `privado.es_admin()` y `privado.sede_actual()`; trigger que crea el perfil al crear el usuario en Auth; validaciones (tipo de sede inmutable, último admin, sede activa para cajero); RLS de sedes y perfiles | [x] 2026-10-28 |
| 02 | `supabase/migrations/20261028110000_catalogo.sql` | Tablas `categorias`, `productos`, `productos_sede` y `costos_producto_sede`; alta automática de productos en las sedes; función `aplicar_precio_referencia()`; vista `productos_vendibles`; función `privado.tipo_actual()`; RLS; bucket de Storage `productos` (imágenes públicas, máx. 2 MB) | [x] 2026-10-28 |
| 03 | `supabase/migrations/20261028120000_caja.sql` | Tipo `metodo_pago`; tablas `turnos`, `contadores_venta`, `ventas`, `lineas_venta` y `gastos`; ventas y turnos cerrados inmutables; amplía `validar_sede` (no desactivar con turnos abiertos) y `validar_perfil` (cajero con turno abierto); RPC `abrir_turno`, `registrar_venta` (idempotente, total con precios de la BD), `ticket_venta`, `registrar_gasto`, `anular_gasto` y `cerrar_turno` (arqueo ciego + instantánea del reporte); RLS de solo lectura | [x] 2026-10-28 |
| 04 | `supabase/migrations/20261028130000_reportes.sql` | Índices por fecha en ventas y gastos; función `privado.rango_bogota()`; RPC de solo lectura para el admin: `rep_resumen` (totales, por método y por sede), `rep_ventas_por_dia` (gráfico, incluye días en 0) y `rep_productos` (unidades y valor, con desglose por sede) | [x] 2026-10-28 |
| 05 | `supabase/migrations/20261028140000_corregir_perfil_auth.sql` | **Corrección**: el trigger que crea el perfil ahora también escucha el `UPDATE` de `raw_app_meta_data` (Supabase Auth escribe el rol después del `INSERT`). Sin esto, crear usuarios fallaba con "Database error creating new user" | [x] verificado 2026-10-29 (los 3 cajeros creados después tienen perfil) |
| 06 | `supabase/migrations/20261028150000_un_turno_por_sede.sql` | **Regla nueva**: un solo turno abierto por sede. `abrir_turno` rechaza con `CAJA_OCUPADA` si otro cajero tiene la caja abierta; nueva RPC `turno_abierto_en_mi_sede()` (nombre y hora del turno abierto, para mostrar "Caja ocupada"). Los turnos que ya estén abiertos a la vez no se cierran solos: ciérralos desde Admin → Turnos | [x] 2026-10-28 (verificado) |
| 07 | `supabase/migrations/20261029100000_reportes_cuadre.sql` | **Reportes nuevos (solo lectura, solo admin)**: índice por apertura de turnos; RPC `rep_cuadre_diario` (por día: base, efectivo, QR, tarjeta, gastos, esperado, contado, diferencia), `rep_diferencias_cajero` (faltantes y sobrantes por cajero), `rep_ventas_por_hora` y `rep_caja_turno` (cómo va la caja de un turno abierto). No modifica tablas ni funciones existentes | [x] 2026-10-29 (verificado) |
| 08 | `supabase/migrations/20261029110000_turno_por_equipo.sql` | **Regla nueva**: el turno queda amarrado al equipo donde se abrió. Columna `turnos.dispositivo`; el navegador envía su identificador (cookie `pos_dispositivo`) en el encabezado `x-pos-dispositivo`. Triggers bloquean ventas, gastos y cierre desde otro equipo (`TURNO_EN_OTRO_EQUIPO`); el admin queda exento. Los turnos abiertos antes del script no quedan restringidos | [x] verificado 2026-10-29 (columna `turnos.dispositivo` existe) |
| 09 | `supabase/migrations/20261029120000_productos_por_hora.sql` | **Solo lectura, solo admin**: `rep_vendido_entre` (comparación con el periodo anterior en el Resumen), `rep_productos_hora_pico` (top de productos y la hora en que más se venden) y `rep_top_por_hora` (los 3 productos más vendidos en cada hora). No modifica tablas ni funciones existentes | [x] 2026-10-29 (verificado) |
| 10 | `supabase/migrations/20261031100000_sedes_ciudad.sql` | Columna opcional `sedes.ciudad` (máx. 60). La sede se muestra como "Ciudad · Dirección / barrio". Usa la RLS existente de `sedes` | [x] verificado 2026-10-31 (columna `sedes.ciudad` existe) |




## Verificación

`npm run verificar-bd` revisa (solo lectura) que tablas, RPC y bucket existan. Última verificación: 2026-10-29, todo OK (migraciones 01 a 09).

> `NEXT_PUBLIC_SUPABASE_URL` debe ser solo `https://<proyecto>.supabase.co`, sin `/rest/v1/`.

## Datos cargados

| Fecha | Qué | Cómo | Resultado |
|---|---|---|---|
| 2026-10-28 | Productos de panadería del software anterior (`6ae24b2924746_products.csv`) | `npm run importar-productos -- <csv> --aplicar` | 22 categorías y 346 productos en el catálogo Panadería, habilitados en "PANADERIA REPOSTERIA TRIGO, PAN Y CAFE DE ANTONIO NARIÑO" al precio del archivo. Sin costo (el CSV traía $1 de relleno). Inventario del CSV ignorado. 3 duplicados omitidos (CHORIZO SOLO, AVENA CASERA, POSTOBON 1.5). Categorías en mayúsculas; "Cerveza" + "cervezas" → CERVEZAS; "NIDO DE FRUTAS ?CHOCOLATE" → "NIDO DE FRUTAS Y CHOCOLATE" |
| 2026-10-30 | Productos de asadero del software anterior (`6ae130925dae4_products.csv`) | `npm run importar-productos -- <csv> --tipo=asadero --aplicar` | 6 categorías (ALMUERZOS Y BANDEJAS, BEBIDAS, POLLO APANADO, POLLO ASADO, PORCIONES, SERVICIO DOMICILIO) y 87 productos en el catálogo Asadero, habilitados en la sede "ASADERO" al precio del archivo. Sin costo (decisión del usuario). Nombres en mayúsculas; "¨Porciones" → PORCIONES; "GASEOSA 1.5/2.5 ml" → "LITROS"; ALMUERZO CON CHULETA DE POLLO y BANDEJA CON CHULETA DE CERDO → ALMUERZOS Y BANDEJAS; PORCION CHULETA CERDO y MADURO → PORCIONES. Nombres de cervezas, ensaladas y maduro sin cambios |

El importador sin `--aplicar` solo analiza. Es idempotente: no duplica categorías ni productos con el mismo nombre.

## Después de los scripts

1. Crear el primer administrador desde la terminal del proyecto:

   ```
   npm run crear-admin
   ```

2. Comprobaciones rápidas en el SQL Editor (solo lectura):

   ```sql
   -- Tablas creadas
   select table_name from information_schema.tables
   where table_schema = 'public' order by 1;

   -- RLS activo en todas
   select tablename, rowsecurity from pg_tables where schemaname = 'public';

   -- Perfil del admin creado por el trigger
   select nombre_usuario, rol, activo from public.perfiles;
   ```

## Pruebas automáticas (opcional, más adelante)

`supabase/tests/database/*.test.sql` usa pgTAP y está pensado para `npx supabase test db`. No se ejecuta en el SQL Editor.

## Notas

- Las tablas viven en `public` y el acceso lo controla la RLS. Las funciones auxiliares están en `privado`, que no se expone en la API.
- Los usuarios usan un correo interno `usuario@pos.local` en Supabase Auth. No hay registro público: solo el admin crea usuarios.
- No borrar ni editar a mano filas de `auth.users`. Para desactivar un usuario, usar la pantalla Usuarios del admin.
