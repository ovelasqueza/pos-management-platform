# Implementation Plan: pos-multisede

## Overview

Plan incremental en TypeScript sobre Next.js 16 (App Router), React 19 y Supabase. Primero se crean el proyecto y la Base_de_Datos como autoridad final (tablas, disparadores, RLS y RPC transaccionales); luego los módulos puros de `src/dominio` con sus pruebas de propiedades, la autenticación por Nombre_de_Usuario y el enrutamiento por Rol, el Entorno_Cajero, el Panel_Admin, la impresión en Formato_80mm, la extracción de tokens visuales y las pruebas de extremo a extremo. Cada paso queda integrado con los anteriores. La aplicación de los Diseños_Stitch va al final porque depende de que el usuario copie las exportaciones en `docs/diseno/`; mientras tanto rige la paleta neutra de respaldo.

## Tasks

- [ ] 1. Crear la estructura del proyecto y las herramientas base
  - [ ] 1.1 Inicializar el proyecto Next.js 16 con TypeScript estricto y dependencias fijadas
    - Crear la aplicación con App Router en `src/`, React 19, ESLint y Tailwind CSS 4; `tsconfig.json` con `strict`, `noUncheckedIndexedAccess` y alias `@/*`
    - Instalar con versión exacta (`.npmrc` con `save-exact=true`, última estable de cada paquete): `@supabase/supabase-js` 2, `@supabase/ssr`, `@tanstack/react-query` 5, `zod` 4, `recharts`, `lucide-react` y `server-only`; de desarrollo: `vitest`, `@vitejs/plugin-react`, `jsdom`, `fast-check`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `@playwright/test`, `@axe-core/playwright`, `pg`, `@types/pg`, `tsx`, `culori`, `node-html-parser`, `json5` y `supabase` (CLI)
    - Crear las carpetas del diseño: `docs/diseno/`, `scripts/`, `src/{app,dominio,datos,servidor,componentes/{ui,caja,admin},impresion,estilos}` y `tests/{propiedades,bd,e2e}`
    - Crear `.env.example` con `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_DOMINIO_CORREO_INTERNO` y `SUPABASE_SECRET_KEY` (sin prefijo `NEXT_PUBLIC_`); ignorar `.env*.local` en git
    - Scripts de `package.json`: `dev`, `build`, `start`, `lint`, `typecheck` (`tsc --noEmit`), `test` (`vitest --run` sin el proyecto `bd`), `test:bd`, `test:e2e`, `db:reset` y `db:test`
    - _Requirements: 22.10_

  - [ ] 1.2 Configurar Tailwind CSS 4 con tokens semánticos y la paleta neutra de respaldo
    - `src/estilos/tokens.base.css` con los roles `fondo`, `superficie`, `borde`, `texto`, `texto-suave`, `primario`, `sobre-primario`, `exito`, `peligro`, `advertencia` e `info`, y los alias `cuadrada`, `faltante`, `sobrante` y `stock-bajo`, con los valores de la tabla del diseño
    - `src/estilos/tokens.generados.css` solo con un comentario; se importa después de la base para que el script de Stitch la sobrescriba
    - `src/estilos/globals.css`: `@import "tailwindcss"`, ambos archivos de tokens, `@theme inline` con las utilidades (`bg-primario`, `text-sobre-primario`, …), `--objetivo-min` de 48 px en `[data-entorno="caja"]` y de 44 px en `[data-entorno="admin"]`, y fuente raíz de 16 px
    - `src/app/layout.tsx` con `<html lang="es-CO">`, metadatos en español e importación de `globals.css`
    - _Requirements: 23.4, 23.8, 23.9, 23.16_

  - [ ] 1.3 Configurar Vitest y Playwright
    - `vitest.config.ts` con los proyectos `dominio` (Node: `tests/propiedades/**` y `src/**/*.test.ts`), `componentes` (jsdom con `@testing-library/jest-dom`: `src/**/*.test.tsx`) y `bd` (Node, secuencial y con tiempos de espera amplios: `tests/bd/**`)
    - `playwright.config.ts` con `webServer` (`next build && next start`), Chromium y `baseURL` local
    - _Requirements: 11.8, 23.13_

  - [ ] 1.4 Inicializar Supabase local
    - Ejecutar `supabase init`; en `supabase/config.toml`: registro público deshabilitado, contraseña mínima de 8 caracteres, proveedor de correo sin confirmación, JWT de 1 hora, y Realtime y Storage habilitados
    - _Requirements: 6.1, 6.8, 22.6_

  - [ ]* 1.5 Crear los generadores compartidos de fast-check
    - `tests/generadores.ts` con datos planos: nombres con tildes, eñes, mayúsculas y espacios; precios enteros positivos; cantidades con bordes (0, 1, 999, 1000); textos inválidos (decimales, negativos, letras, vacío); instantes alrededor de la medianoche de Bogotá; Sedes de ambos tipos, activas e inactivas; historiales de Turno con Ventas de los tres métodos y Gastos vigentes y anulados
    - _Requirements: 8.5, 14.6, 19.4_

- [ ] 2. Crear el esquema de la Base_de_Datos y sus invariantes
  - [ ] 2.1 Crear la migración de tipos enumerados y tablas
    - `supabase/migrations/20250101000100_tipos_y_tablas.sql`: esquema `privado` y enumerados `tipo_sede`, `rol_usuario`, `estado_turno`, `metodo_pago`, `estado_gasto` y `tipo_movimiento`
    - Tablas `sedes`, `perfiles`, `categorias`, `productos`, `productos_sede`, `contadores_venta`, `turnos`, `ventas`, `lineas_venta`, `gastos`, `entradas_inventario` y `movimientos_inventario` como en el diseño: llaves compuestas por Tipo_de_Sede, índices únicos sobre `lower(nombre)` y `lower(nombre_usuario)`, índice único parcial de un Turno abierto por Cajero, restricciones `perfiles_rol_sede`, `turnos_cierre_coherente` (con `diferencia = efectivo_contado − efectivo_esperado`), `ventas_efectivo`, `gastos_anulacion` y `movimientos_coherencia`
    - Columnas generadas `fecha_operativa` y `fecha_apertura` en America/Bogota, `cerrado_por_admin` y `subtotal`; índices de reportes
    - _Requirements: 3.3, 4.1, 4.4, 4.5, 5.3, 6.3, 6.6, 6.7, 7.4, 11.4, 11.5, 11.12, 14.7, 17.1, 19.4, 22.9_

  - [ ] 2.2 Crear la migración de funciones auxiliares del esquema `privado`
    - `supabase/migrations/20250101000200_auxiliares.sql`: `privado.lanzar` (`errcode = 'P0001'`, código en `message` y JSON en `detail`), `es_admin`, `sede_cajero`, `exigir_usuario_activo`, `exigir_cajero_activo`, `exigir_admin` y `efectivo_esperado`
    - Todas `security definer`, con `search_path = ''` y nombres calificados; conceder a `authenticated` solo `usage` del esquema y `execute` de estas funciones; revocar a `public` y `anon`
    - _Requirements: 1.7, 14.6, 22.6, 22.7_

  - [ ] 2.3 Crear la migración de disparadores
    - `supabase/migrations/20250101000300_disparadores.sql`
    - Altas: `crear_perfil_desde_auth` (perfil desde `raw_app_meta_data`; si falla, no se crea el Usuario de Auth), `al_crear_sede` (Productos_de_Sede al Precio_de_Referencia, Stock 0 y habilitados según el estado del Producto, más su fila en `contadores_venta`) y `al_crear_producto` (en todas las Sedes del tipo, activas o inactivas)
    - Validaciones: `validar_sede` (`TIPO_SEDE_INMUTABLE`; `SEDE_CON_TURNO_ABIERTO` con los nombres de los Cajeros) y `validar_perfil` (Administrador sin Sede, `SEDE_NO_DISPONIBLE`, `CAJERO_CON_TURNO_ABIERTO` y `ULTIMO_ADMINISTRADOR` con `pg_advisory_xact_lock`)
    - Invariantes: `aplicar_movimiento` (Stock = Stock + cantidad), `rechazar_modificacion` en `ventas`, `lineas_venta`, `movimientos_inventario` y `entradas_inventario`, `validar_turno`, `validar_gasto` (solo vigente → anulado con el Turno abierto) y `verificar_total_venta` como constraint trigger diferido
    - Propagación: `tocar_productos_sede` ante cambios de nombre, Categoría, imagen o estado de un Producto y de nombre de una Categoría; mantenimiento de `actualizado_en`
    - _Requirements: 3.5, 3.7, 4.10, 4.11, 5.1, 5.2, 6.4, 6.5, 6.10, 6.11, 8.16, 11.3, 13.5, 13.6, 14.11, 17.9, 17.10, 22.8_

  - [ ]* 2.4 Crear las utilidades de pruebas de Base_de_Datos
    - `tests/bd/utilidades.ts`: conexión `pg` como `postgres` a la base local; una transacción con `rollback` por corrida; creación de Usuarios en `auth.users` (el disparador crea el perfil); suplantación con `set local role authenticated` y `set_config('request.jwt.claims', …)`; captura de errores `P0001` como código y detalle
    - Modo con datos confirmados, nombres únicos y limpieza al terminar, para las pruebas concurrentes
    - _Requirements: 22.6, 22.9_

  - [ ]* 2.5 Escribir la prueba de propiedad de completitud de Productos_de_Sede
    - **Property 23: Completitud de Productos_de_Sede**
    - **Validates: Requirements 5.1, 5.2, 5.3**
    - Archivo `tests/bd/catalogo.prop.test.ts`

  - [ ]* 2.6 Escribir la prueba de propiedad de unicidad de nombres
    - **Property 26: Unicidad de nombres sin distinguir mayúsculas**
    - **Validates: Requirements 3.3, 4.5, 6.6**
    - Archivo `tests/bd/catalogo.prop.test.ts`

  - [ ]* 2.7 Escribir la prueba de propiedad de reglas de Usuarios y Sedes con Turno abierto
    - **Property 37: Reglas de Usuarios y Sedes con Turno abierto**
    - **Validates: Requirements 3.7, 6.4, 6.5, 6.10, 6.11**
    - Archivo `tests/bd/administracion.prop.test.ts`; los Turnos abiertos se insertan como `postgres` y la parte concurrente usa varias conexiones con datos confirmados

- [ ] 3. Aplicar las Políticas_de_Acceso, los privilegios, las vistas, Storage y Realtime
  - [ ] 3.1 Crear la migración de RLS y privilegios por columna
    - `supabase/migrations/20250101000400_rls_y_privilegios.sql`: RLS en todas las tablas de `public` y políticas solo para `authenticated` según la tabla del diseño, con `(select privado.es_admin())`, `(select privado.sede_cajero())` y `(select auth.uid())`
    - Revocar todo a `anon` y `authenticated`; conceder `select` (salvo en `contadores_venta`) e `insert`/`update` solo en las columnas indicadas; `alter default privileges` para revocar `execute` de funciones a `public` y `anon`
    - _Requirements: 6.1, 22.1, 22.2, 22.4, 22.5, 22.6, 22.7_

  - [ ] 3.2 Crear la migración de vistas
    - `supabase/migrations/20250101000500_vistas.sql`: `v_productos_vendibles` con `security_invoker`
    - Vistas del Panel_Admin `v_ventas_admin`, `v_gastos_admin`, `v_turnos_admin` (Efectivo_Esperado guardado o calculado, Diferencia y clasificación), `v_stock_admin` y `v_movimientos_admin`, con `security_invoker` y filtro `privado.es_admin()`, sin filtrar por `sedes.activa`
    - _Requirements: 3.8, 4.10, 4.11, 5.9, 5.10, 8.1, 16.1, 17.11, 17.12, 17.13, 19.9, 20.1, 20.3_

  - [ ] 3.3 Crear la migración de Storage y Realtime
    - `supabase/migrations/20250101000600_storage_y_realtime.sql`: bucket privado `productos` (2 MB; JPG, PNG y WebP), política de Administrador para todas las operaciones y de Cajero para leer las imágenes de sus Productos_Vendibles
    - Agregar `productos_sede` a la publicación `supabase_realtime`
    - _Requirements: 4.6, 4.7, 5.11, 22.1_

  - [ ]* 3.4 Escribir la prueba de propiedad de Productos_Vendibles de la Sede
    - **Property 24: Productos_Vendibles de la Sede**
    - **Validates: Requirements 4.10, 4.11, 5.9, 5.10, 8.1**
    - Archivo `tests/bd/catalogo.prop.test.ts`

- [ ] 4. Implementar las funciones RPC de caja
  - [ ] 4.1 Crear las RPC de acceso y apertura de Turno
    - `supabase/migrations/20250101000700_rpc_acceso_y_apertura.sql`: `mi_estado_acceso()` (responde también a Usuarios inactivos: `existe`, `activo` y, solo si está activo, Rol, nombre, Sede y Turno abierto)
    - `abrir_turno(p_base_caja)`: bloquea perfil y Sede `for share`, valida la base, toma la Sede del perfil y convierte el índice único en `TURNO_YA_ABIERTO` con el Turno existente en el detalle
    - Convención de todas las RPC: `set search_path = ''`, `execute` solo para `authenticated` e inicio con `privado.exigir_usuario_activo()` o `privado.exigir_cajero_activo()`
    - _Requirements: 1.3, 1.7, 2.1, 2.2, 2.6, 7.2, 7.4, 22.3, 22.9_

  - [ ] 4.2 Crear las RPC de Ventas
    - `supabase/migrations/20250101000800_rpc_ventas.sql`: `registrar_venta` con el algoritmo del diseño: bloqueo consultivo por clave, Venta repetida con `repetida: true`, Turno `for share` y `TURNO_CERRADO` con `cerrado_por_admin`, `CARRITO_INVALIDO`, `PRODUCTO_NO_VENDIBLE`, `PRECIOS_ACTUALIZADOS` con los precios vigentes y `MONTO_INSUFICIENTE`
    - Contador por Sede, Líneas_de_Venta con nombre y precio vigentes y Movimientos de tipo Venta en orden de `producto_id`, todo en una transacción
    - `venta_por_clave`, `datos_ticket` (lee la Sede vigente) y `privado.datos_ticket_json`
    - _Requirements: 3.4, 10.7, 10.8, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.12, 16.4, 17.7, 17.8, 22.3_

  - [ ] 4.3 Crear las RPC de Gastos
    - `supabase/migrations/20250101000900_rpc_gastos.sql`: `registrar_gasto` (clave de idempotencia, Turno `for update`, validación y `GASTO_SUPERA_EFECTIVO` sin montos en el detalle)
    - `anular_gasto`: vigente → anulado con fecha y Usuario, idempotente, y `TURNO_CERRADO` si el Turno está cerrado
    - _Requirements: 13.1, 13.3, 13.5, 13.6, 16.4, 22.3, 22.9_

  - [ ] 4.4 Crear la RPC de cierre de Turno
    - `supabase/migrations/20250101001000_rpc_cierre.sql`: `cerrar_turno(p_turno_id, p_efectivo_contado)` para el Cajero dueño o un Administrador; bloquea el Turno `for update` y calcula Efectivo_Esperado y Diferencia
    - Guarda la instantánea `reporte_cierre` (`ReporteTurno` versión 1: totales por método, Gastos vigentes, unidades y valor por Producto y cierre por Administrador) y `cerrado_por`
    - Un reintento del mismo Usuario con el mismo valor contado devuelve la instantánea; cualquier otro intento sobre un Turno cerrado responde `TURNO_CERRADO`
    - _Requirements: 14.5, 14.6, 14.7, 14.10, 14.11, 15.1, 15.2, 15.3, 15.4, 15.5, 16.2, 16.3_

  - [ ]* 4.5 Escribir la prueba de propiedad de un único Turno abierto
    - **Property 32: Un único Turno abierto por Cajero**
    - **Validates: Requirements 7.4**
    - Archivo `tests/bd/ventas.prop.test.ts`; incluye aperturas simultáneas

  - [ ]* 4.6 Escribir la prueba de propiedad del registro de Venta
    - **Property 27: Registro de Venta con precios de la Base_de_Datos**
    - **Validates: Requirements 5.5, 8.16, 11.1, 11.2, 11.3, 11.4, 17.7, 17.8**
    - Archivo `tests/bd/ventas.prop.test.ts`

  - [ ]* 4.7 Escribir la prueba de propiedad del rechazo atómico de Ventas inválidas
    - **Property 28: Rechazo atómico de Ventas inválidas**
    - **Validates: Requirements 10.7, 10.8, 11.6**
    - Archivo `tests/bd/ventas.prop.test.ts`

  - [ ]* 4.8 Escribir la prueba de propiedad de la numeración por Sede
    - **Property 29: Numeración consecutiva por Sede**
    - **Validates: Requirements 11.5**
    - Archivo `tests/bd/ventas.prop.test.ts`; incluye Ventas concurrentes e intentos rechazados

  - [ ]* 4.9 Escribir la prueba de propiedad de idempotencia de reintentos
    - **Property 30: Idempotencia de reintentos**
    - **Validates: Requirements 11.12, 14.10**
    - Archivo `tests/bd/ventas.prop.test.ts`; envíos en serie y en paralelo con la misma clave

  - [ ]* 4.10 Escribir la prueba de propiedad de operaciones con Turno abierto propio
    - **Property 31: Operaciones de caja con Turno abierto propio**
    - **Validates: Requirements 7.2, 11.7, 13.6, 16.4, 22.3, 22.9**
    - Archivo `tests/bd/ventas.prop.test.ts`

- [ ] 5. Implementar las RPC de administración, inventario y reportes
  - [ ] 5.1 Crear las RPC de catálogo
    - `supabase/migrations/20250101001100_rpc_catalogo.sql`: `actualizar_precio_referencia` (cambia los Precios_de_Venta solo con `p_aplicar_a_sedes`), `eliminar_categoria` (`CATEGORIA_CON_PRODUCTOS` con la cantidad) y `eliminar_producto` (`PRODUCTO_CON_HISTORIAL`; si elimina, devuelve la ruta de la imagen)
    - Todas exigen `privado.exigir_admin()`
    - _Requirements: 4.9, 4.12, 5.7, 5.8, 22.5_

  - [ ] 5.2 Crear las RPC de inventario
    - `supabase/migrations/20250101001200_rpc_inventario.sql`: `registrar_entrada_inventario` (clave de idempotencia, validación de todas las líneas, `ENTRADA_LINEA_INVALIDA` con el índice, cabecera y un Movimiento de tipo Entrada por línea en orden de `producto_id`)
    - `registrar_ajuste_inventario`: bloquea el Producto_de_Sede, responde `STOCK_CAMBIADO` con el Stock actual si difiere del visto y registra el Ajuste por `contada − stock` con `stock_anterior`, `cantidad_contada` y motivo
    - _Requirements: 17.2, 17.3, 17.5, 17.6, 22.5, 22.9_

  - [ ] 5.3 Crear las funciones de reporte
    - `supabase/migrations/20250101001300_reportes.sql`: `reporte_resumen(p_sede_id, p_desde, p_hasta)` agrupa una vez por Sede y método y deriva consolidado, suma por método, Gastos vigentes y serie diaria con `generate_series` (ceros en días sin Ventas); `p_sede_id = null` es Todas_las_Sedes
    - `reporte_productos`: unidades, valor y desglose por Sede, con el nombre vigente del Producto; ambas `security invoker` y con `privado.exigir_admin()`, sin filtrar por `sedes.activa`
    - _Requirements: 3.8, 19.5, 19.6, 19.7, 19.8, 21.1, 21.2, 21.3, 21.6_

  - [ ] 5.4 Crear los datos de desarrollo
    - `supabase/seed.sql`: Sedes de ambos tipos (una inactiva), Categorías y Productos con tildes y eñes; sin Usuarios, porque el primer Administrador se crea con el script de configuración inicial
    - _Requirements: 4.1, 5.1, 5.2_

  - [ ] 5.5 Generar los tipos TypeScript de la Base_de_Datos
    - Script `db:tipos` en `package.json` (`supabase gen types typescript --local > src/datos/tipos-bd.ts`) y archivo generado `src/datos/tipos-bd.ts`
    - _Requirements: 22.1, 22.3_

  - [ ]* 5.6 Escribir las pruebas de humo de estructura con pgTAP
    - `supabase/tests/estructura.test.sql`: RLS habilitada en todas las tablas de `public`; ninguna política para `anon`; `contadores_venta` sin privilegios para `authenticated`; toda función `security definer` con `search_path` fijado; `execute` de las RPC solo para `authenticated`; `tipo_sede` con exactamente dos valores
    - _Requirements: 4.1, 22.5, 22.6_

  - [ ]* 5.7 Escribir la prueba de propiedad de precios por Sede y Precio_de_Referencia
    - **Property 25: Precios por Sede y Precio_de_Referencia**
    - **Validates: Requirements 5.5, 5.6, 5.7, 5.8**
    - Archivo `tests/bd/catalogo.prop.test.ts`

  - [ ]* 5.8 Escribir la prueba de propiedad de eliminación protegida
    - **Property 38: Eliminación protegida de Categorías y Productos**
    - **Validates: Requirements 4.9, 4.12**
    - Archivo `tests/bd/administracion.prop.test.ts`

  - [ ]* 5.9 Escribir la prueba de propiedad de inmutabilidad de registros
    - **Property 35: Inmutabilidad de registros**
    - **Validates: Requirements 3.5, 13.6, 14.11, 17.10, 22.8**
    - Archivo `tests/bd/inventario.prop.test.ts`; se prueba con Cajero, Administrador y `service_role`

  - [ ]* 5.10 Escribir la prueba de propiedad de Stock igual a la suma de Movimientos
    - **Property 36: Stock igual a la suma de Movimientos**
    - **Validates: Requirements 17.1, 17.2, 17.3, 17.5, 17.7, 17.8, 17.9**
    - Archivo `tests/bd/inventario.prop.test.ts`

  - [ ]* 5.11 Escribir la prueba de propiedad de aislamiento de datos
    - **Property 39: Aislamiento de datos por Rol y Sede**
    - **Validates: Requirements 1.7, 6.1, 22.1, 22.2, 22.4, 22.5, 22.6, 22.7**
    - Archivo `tests/bd/rls.prop.test.ts`; recorre todas las tablas y vistas de `public` y todas las RPC con Cajeros de distintas Sedes, inactivos, `anon` y Administradores

  - [ ]* 5.12 Escribir la prueba de propiedad de consistencia de totales
    - **Property 40: Consistencia de totales en reportes**
    - **Validates: Requirements 3.8, 19.5, 19.6, 19.7, 19.8, 20.1, 20.2**
    - Archivo `tests/bd/reportes.prop.test.ts`; el modelo de referencia agrega en TypeScript los mismos datos generados

  - [ ]* 5.13 Escribir la prueba de propiedad del alcance del Selector_de_Sede y del Rango_de_Fechas
    - **Property 42: Alcance del Selector_de_Sede y del Rango_de_Fechas**
    - **Validates: Requirements 6.13, 6.14, 16.1, 17.11, 17.12, 17.13, 18.3, 18.6, 19.9, 20.3**
    - Archivo `tests/bd/reportes.prop.test.ts`; aplica a las vistas los mismos filtros que usa el Panel_Admin

- [ ] 6. Punto de control: Base_de_Datos
  - Asegurar que todas las pruebas pasen (`npm run db:reset`, `npm run db:test` y `npm run test:bd` con `supabase start`); consultar al usuario si surgen dudas.

- [ ] 7. Implementar los módulos de dominio base
  - [ ] 7.1 Definir tipos, constantes, modelos de intercambio y códigos de error
    - `src/dominio/tipos.ts`: `TipoSede`, `Rol`, `MetodoPago`, `Clasificacion`, `CANTIDAD_MAXIMA`, `MONTO_MAXIMO`, `MAX_LINEAS_VENTA`, `DatosTicket`, `ReporteTurno`, `ResumenVentas` y `FilaReporteProducto`
    - `src/dominio/codigos-error.ts`: `CodigoError`, `ErrorDominio { codigo, detalle?, campo? }` y el mensaje en pantalla de cada código del catálogo del diseño
    - _Requirements: 1.2, 12.2, 13.3, 15.1, 19.5, 21.1, 23.16_

  - [ ] 7.2 Implementar la normalización y la búsqueda de texto
    - `src/dominio/texto.ts`: `normalizarTexto` (NFD, sin marcas diacríticas, minúsculas), `coincideBusqueda` y `compararNombres` con `Intl.Collator('es', { sensitivity: 'base' })`
    - _Requirements: 8.1, 8.5, 21.5_

  - [ ]* 7.3 Escribir la prueba de propiedad de la búsqueda
    - **Property 4: Búsqueda sin distinguir mayúsculas, minúsculas ni tildes**
    - **Validates: Requirements 8.5, 21.5**
    - Archivo `tests/propiedades/catalogo.prop.test.ts`

  - [ ] 7.4 Implementar el formato de pesos colombianos
    - `src/dominio/dinero.ts`: `formatearCOP` (`12500` → `$ 12.500`; `-2500` → `-$ 2.500`) y `parsearCOP`
    - _Requirements: 23.15_

  - [ ]* 7.5 Escribir la prueba de propiedad del formato de pesos
    - **Property 9: Formato de pesos colombianos (ida y vuelta)**
    - **Validates: Requirements 23.15**
    - Archivo `tests/propiedades/dinero-fechas.prop.test.ts`

  - [ ] 7.6 Implementar las fechas en la Zona_Horaria_Operativa
    - `src/dominio/fechas.ts`: `fechaOperativa`, `hoyOperativo`, `rangoRapido` (Hoy, Ayer, Últimos 7 días y Mes actual), `validarRango` y `formatearFechaHora`, todos en America/Bogota
    - _Requirements: 19.1, 19.2, 19.3, 19.4_

  - [ ]* 7.7 Escribir la prueba de propiedad de rangos de fechas
    - **Property 11: Rangos de fechas**
    - **Validates: Requirements 19.1, 19.2, 19.3**
    - Archivo `tests/propiedades/dinero-fechas.prop.test.ts`

  - [ ]* 7.8 Escribir la prueba de propiedad de la fecha operativa
    - **Property 10: Fecha operativa en America/Bogota**
    - **Validates: Requirements 19.4**
    - Archivo `tests/bd/fechas.prop.test.ts`; compara `fechaOperativa` con UTC−5 y con la columna generada `fecha_operativa`

  - [ ] 7.9 Implementar los esquemas de validación
    - `src/dominio/validacion.ts` con Zod: `esquemaMontoNoNegativo`, `esquemaMontoPositivo`, `esquemaCantidadLinea`, `esquemaNombreUsuario`, `esquemaContrasena` (puntos de código), `esquemaUsuario` (unión por Rol), `esquemaSede`, `esquemaProducto`, `esquemaCategoria`, `esquemaGasto`, `esquemaEntrada` y `esquemaAjuste`, con recorte de espacios y campo señalado en cada error
    - `validarImagen` (JPG, PNG o WebP y máximo 2 MB)
    - _Requirements: 3.2, 4.4, 4.7, 5.6, 6.3, 6.5, 6.7, 6.8, 7.3, 8.12, 13.2, 14.3, 17.3, 17.6_

  - [ ]* 7.10 Escribir la prueba de propiedad de montos y cantidades
    - **Property 12: Validación de montos y cantidades**
    - **Validates: Requirements 4.4, 5.6, 7.3, 13.2, 14.3, 17.3, 17.6**
    - Archivo `tests/propiedades/validacion.prop.test.ts`

  - [ ]* 7.11 Escribir la prueba de propiedad de datos de Usuario
    - **Property 13: Validación de datos de Usuario**
    - **Validates: Requirements 6.3, 6.5, 6.7, 6.8**
    - Archivo `tests/propiedades/validacion.prop.test.ts`; bordes de 2/3/30/31 y 7/8 caracteres

  - [ ]* 7.12 Escribir la prueba de propiedad de campos obligatorios e imagen
    - **Property 14: Campos obligatorios e imagen de Producto**
    - **Validates: Requirements 3.2, 4.4, 4.7, 13.2, 17.6**
    - Archivo `tests/propiedades/validacion.prop.test.ts`; bordes de 2 MB exactos y 2 MB + 1 byte

  - [ ] 7.13 Implementar el correo interno sintético
    - `src/dominio/correo-interno.ts`: `correoInterno(nombreUsuario, dominio)` (minúsculas, bytes UTF-8 en hexadecimal, `u<hex>@<dominio>`) y su inversa `nombreDesdeCorreo`
    - _Requirements: 1.1, 6.6_

  - [ ]* 7.14 Escribir la prueba de propiedad del correo interno
    - **Property 15: Correo interno derivado del Nombre_de_Usuario**
    - **Validates: Requirements 1.1, 6.6**
    - Archivo `tests/propiedades/acceso.prop.test.ts`

  - [ ] 7.15 Implementar el enrutamiento por Rol y el orden del Selector_de_Sede
    - `src/dominio/enrutamiento.ts`: `EstadoAcceso`, `destinoInicial` y `resolverAcceso` (avisos `acceso_denegado`, `inactivo` y `sede_inactiva`)
    - `src/dominio/selector.ts`: `opcionesSelector` (Todas_las_Sedes, Sedes activas y al final las inactivas con marca)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 7.1, 18.1_

  - [ ]* 7.16 Escribir la prueba de propiedad del enrutamiento
    - **Property 17: Enrutamiento por Rol y estado**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 7.1**
    - Archivo `tests/propiedades/acceso.prop.test.ts`

  - [ ]* 7.17 Escribir la prueba de propiedad del orden del Selector_de_Sede
    - **Property 18: Orden del Selector_de_Sede**
    - **Validates: Requirements 18.1**
    - Archivo `tests/propiedades/acceso.prop.test.ts`

- [ ] 8. Implementar los módulos de dominio de caja, documentos y reportes
  - [ ] 8.1 Implementar el Carrito
    - `src/dominio/carrito.ts`: `ProductoVendible`, `LineaCarrito`, `Carrito`, `AccionCarrito`, `reducirCarrito` (tocar Producto, aumentar, disminuir, fijar cantidad entre 1 y 999, quitar y vaciar), `subtotal`, `totalCarrito`, `reconciliarCarrito` (precios vigentes y Productos retirados con sus nombres), `serializarCarrito`, `deserializarCarrito` (vacío ante contenido inválido) y `claveCarrito`
    - _Requirements: 8.6, 8.7, 8.8, 8.9, 8.10, 8.11, 8.12, 8.13, 8.14, 8.16, 8.18, 10.7, 10.8_

  - [ ]* 8.2 Escribir la prueba de propiedad de las operaciones del Carrito
    - **Property 1: Operaciones del Carrito según el modelo de referencia**
    - **Validates: Requirements 8.6, 8.7, 8.8, 8.9, 8.10, 8.11, 8.12, 8.13, 8.14, 8.16**
    - Archivo `tests/propiedades/carrito.prop.test.ts`; prueba basada en modelo con secuencias de acciones

  - [ ]* 8.3 Escribir la prueba de propiedad de la persistencia del Carrito
    - **Property 2: Persistencia del Carrito (ida y vuelta)**
    - **Validates: Requirements 8.18**
    - Archivo `tests/propiedades/carrito.prop.test.ts`

  - [ ]* 8.4 Escribir la prueba de propiedad de la reconciliación del Carrito
    - **Property 8: Reconciliación del Carrito con el catálogo vigente**
    - **Validates: Requirements 10.7, 10.8**
    - Archivo `tests/propiedades/carrito.prop.test.ts`

  - [ ] 8.5 Implementar los filtros de la Cuadrícula_de_Productos
    - `src/dominio/catalogo.ts`: `productosVisibles` (Categoría o Todos, búsqueda y orden alfabético en español), `categoriasConProductos`, `advertenciaTarjeta` (Stock ≤ 0), `advertenciaLinea` (cantidad > Stock) e `iniciales`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 9.1, 9.2_

  - [ ]* 8.6 Escribir la prueba de propiedad de filtros y orden de la Cuadrícula
    - **Property 3: Filtros y orden de la Cuadrícula_de_Productos**
    - **Validates: Requirements 8.1, 8.3, 8.4**
    - Archivo `tests/propiedades/catalogo.prop.test.ts`

  - [ ] 8.7 Implementar el cálculo del cobro y el teclado numérico
    - `src/dominio/cobro.ts`: `calcularCobro` (Cambio o valor pendiente en Efectivo; confirmación directa en Transferencia y Tarjeta), `puedeCobrar` (Carrito no vacío y `en_linea`, sin depender del Stock) y `teclaTeclado` (dígitos, borrar, limpiar, billetes que suman al monto y Exacto, sin ceros a la izquierda y con máximo de dígitos)
    - _Requirements: 8.17, 9.3, 10.2, 10.3, 10.4, 10.5, 11.13, 23.14_

  - [ ]* 8.8 Escribir la prueba de propiedad de Advertencia_de_Stock y Cobrar
    - **Property 5: Advertencia_de_Stock y disponibilidad de Cobrar**
    - **Validates: Requirements 9.1, 9.2, 9.3, 8.17, 11.13**
    - Archivo `tests/propiedades/catalogo.prop.test.ts`

  - [ ]* 8.9 Escribir la prueba de propiedad del cálculo del cobro
    - **Property 6: Cálculo del cobro**
    - **Validates: Requirements 10.3, 10.4, 10.5**
    - Archivo `tests/propiedades/cobro.prop.test.ts`

  - [ ]* 8.10 Escribir la prueba de propiedad del teclado y los billetes
    - **Property 7: Teclado numérico y accesos rápidos de billetes**
    - **Validates: Requirements 10.2, 23.14**
    - Archivo `tests/propiedades/cobro.prop.test.ts`

  - [ ] 8.11 Implementar los cálculos de caja
    - `src/dominio/caja.ts`: `efectivoEsperado` (Base_de_Caja + Ventas en Efectivo − Gastos vigentes), `diferencia` y `clasificar` (Sobrante, Faltante o Caja_Cuadrada)
    - _Requirements: 13.5, 14.6, 14.7, 14.8, 20.4_

  - [ ]* 8.12 Escribir la prueba de propiedad de Efectivo_Esperado y Diferencia
    - **Property 16: Efectivo_Esperado, Diferencia y clasificación**
    - **Validates: Requirements 13.5, 14.6, 14.7, 14.8, 20.4**
    - Archivo `tests/propiedades/caja.prop.test.ts`

  - [ ]* 8.13 Escribir la prueba de propiedad de Gastos frente al Efectivo_Esperado
    - **Property 33: Registro y anulación de Gastos frente al Efectivo_Esperado**
    - **Validates: Requirements 13.1, 13.3, 13.5**
    - Archivo `tests/bd/turnos.prop.test.ts`; usa `efectivoEsperado` de `src/dominio/caja.ts` como modelo

  - [ ]* 8.14 Escribir la prueba de propiedad del cierre de Turno
    - **Property 34: Cierre de Turno frente al modelo**
    - **Validates: Requirements 14.5, 14.6, 14.7, 15.1, 15.2, 15.3, 15.4, 15.5, 16.2, 16.3**
    - Archivo `tests/bd/turnos.prop.test.ts`; cierre por el Cajero y por un Administrador comparado con el modelo de la Propiedad 16

  - [ ] 8.15 Implementar los modelos de impresión
    - `src/dominio/documentos.ts`: `SeccionImpresion`, `modeloTicket` (Sede con dirección y teléfono solo si existen, Número_de_Venta, fecha y hora, Cajero, líneas, Total, Método_de_Pago, y Monto_Recibido y Cambio solo en Efectivo) y `modeloReporteTurno` (sección de efectivo, “Otros medios” aparte, Gastos vigentes, Diferencia clasificada, Productos, cierre por Administrador y firmas); marca COPIA al inicio y al final con `copia: true`
    - _Requirements: 12.2, 12.3, 12.4, 12.7, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.9, 16.3_

  - [ ]* 8.16 Escribir la prueba de propiedad del contenido del Ticket
    - **Property 19: Contenido del Ticket**
    - **Validates: Requirements 12.2, 12.3, 12.4, 12.7**
    - Archivo `tests/propiedades/documentos.prop.test.ts`

  - [ ]* 8.17 Escribir la prueba de propiedad del contenido del Reporte_de_Turno
    - **Property 20: Contenido del Reporte_de_Turno**
    - **Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.9, 16.3**
    - Archivo `tests/propiedades/documentos.prop.test.ts`

  - [ ] 8.18 Implementar el orden y la búsqueda del reporte de Productos
    - `src/dominio/reportes.ts`: `ordenarReporteProductos` (unidades por defecto, valor o nombre; empates por nombre) y `filtrarReporteProductos` con `coincideBusqueda`
    - _Requirements: 21.1, 21.4, 21.5_

  - [ ]* 8.19 Escribir la prueba de propiedad del reporte de Ventas por Producto
    - **Property 41: Reporte de Ventas por Producto**
    - **Validates: Requirements 21.1, 21.2, 21.3, 21.4, 21.6**
    - Archivo `tests/bd/reportes.prop.test.ts`; combina `reporte_productos` con `ordenarReporteProductos`

- [ ] 9. Implementar los módulos de dominio de contraste y tokens
  - [ ] 9.1 Implementar el contraste y la variante accesible
    - `src/dominio/contraste.ts` con `culori`: `relacionContraste` (fórmula WCAG 2.x) y `varianteAccesible` (busca en el eje de luminosidad OKLCH, con el mismo tono y croma ajustados a sRGB, la luminosidad más cercana que alcance 4,5:1; devuelve el mismo color si ya cumple)
    - _Requirements: 23.4, 23.5_

  - [ ] 9.2 Implementar los roles semánticos y la extracción de la paleta
    - `src/dominio/tokens.ts`: roles semánticos, alias, `PARES_DE_CONTRASTE` y `extraerPaleta(html)`: lee el HTML como texto sin ejecutar scripts, interpreta `tailwind.config = {…}` con `json5` y, si falla, recurre a expresiones regulares sobre hexadecimales, `rgb()` y clases arbitrarias; también toma variables CSS, familias tipográficas y radios
    - _Requirements: 23.1, 23.4_

  - [ ]* 9.3 Escribir la prueba de propiedad de la variante accesible
    - **Property 21: Variante accesible de color**
    - **Validates: Requirements 23.4, 23.5**
    - Archivo `tests/propiedades/visual.prop.test.ts`; recorre también los pares de `tokens.base.css` y `tokens.generados.css`

  - [ ]* 9.4 Escribir la prueba de propiedad de la extracción de la paleta
    - **Property 22: Extracción de la Paleta_de_Colores de Stitch (ida y vuelta)**
    - **Validates: Requirements 23.1**
    - Archivo `tests/propiedades/visual.prop.test.ts`

- [ ] 10. Punto de control: módulos de dominio
  - Asegurar que todas las pruebas pasen (`npm test`, `npm run typecheck` y `npm run lint`); consultar al usuario si surgen dudas.

- [ ] 11. Construir los componentes de interfaz compartidos
  - [ ] 11.1 Crear las acciones, los botones y los indicadores de estado
    - `src/componentes/ui/acciones.ts`: diccionario tipado `ACCIONES` con ícono de lucide-react y etiqueta de máximo dos palabras (Cobrar, Vaciar, Quitar, Reimprimir, Abrir turno, Cerrar turno, Finalizar, Exacto, Anular, Salir, Reintentar, Volver, Cambiar, Imprimir, …)
    - `Boton` y `BotonIcono` (variantes por rol semántico y tamaño mínimo `--objetivo-min`), `Dinero` (con `formatearCOP`), `Estado` (color e ícono obligatorios para `stock-bajo`, `sobrante`, `faltante`, `cuadrada`, `error` y `sin-conexion`), `IconoTipoSede` (`Croissant`, `Drumstick`) e íconos de Método_de_Pago (`Banknote`, `Smartphone`, `CreditCard`)
    - _Requirements: 23.8, 23.9, 23.10, 23.11, 23.15, 23.16_

  - [ ] 11.2 Crear el teclado numérico en pantalla
    - `src/componentes/ui/TecladoNumerico.tsx`: dígitos 0–9, 000, borrar y C, controlado por `teclaTeclado`; admite accesos rápidos de billetes y Exacto
    - _Requirements: 10.2, 23.14_

  - [ ] 11.3 Crear diálogos, confirmaciones y campos de formulario
    - `Dialogo` y `Confirmacion` accesibles con foco atrapado, `CampoFormulario` (etiqueta, valor y error con ícono, color y mensaje corto) y `Aviso` para mensajes breves
    - _Requirements: 8.14, 23.11_

  - [ ]* 11.4 Escribir pruebas unitarias de los componentes compartidos
    - `ACCIONES` con ícono y etiquetas de máximo dos palabras; `Estado` siempre con color e ícono; `TecladoNumerico` y `Confirmacion` con Testing Library
    - _Requirements: 23.10, 23.11, 23.14_

- [ ] 12. Implementar la autenticación, la sesión y el enrutamiento por Rol
  - [ ] 12.1 Crear los clientes de Supabase y la interpretación de errores
    - `src/datos/cliente-navegador.ts` (`createBrowserClient` con la clave publicable) y `src/datos/cliente-servidor.ts` (`createServerClient` con las cookies), tipados con `tipos-bd.ts`
    - `src/servidor/supabase-secreto.ts` con `import 'server-only'` y `SUPABASE_SECRET_KEY`, usado solo para `auth.admin`
    - `src/datos/errores.ts`: `interpretarError` (`P0001`, `23505` con el campo deducido del índice, `23514`, `23503`, errores de Auth, 401 y fallas de red o tiempo agotado → `ERROR_CONEXION`)
    - `src/datos/rpc.ts`: llamada base con `AbortSignal.timeout(8000)` e `interpretarError`, y el envoltorio `miEstadoAcceso`
    - _Requirements: 1.2, 1.7, 11.11, 22.10_

  - [ ]* 12.2 Escribir pruebas unitarias de `interpretarError`
    - Cada origen de error del catálogo produce el código y el campo esperados
    - _Requirements: 1.2, 11.11_

  - [ ] 12.3 Implementar `src/proxy.ts`
    - Refresca la sesión con `getClaims()` según el patrón de `@supabase/ssr`; redirige a `/login` las rutas `/caja/*` y `/admin/*` sin sesión y `/login` a `/` con sesión; no consulta tablas
    - _Requirements: 1.4, 22.6_

  - [ ] 12.4 Implementar las guardas de servidor y las redirecciones por Rol
    - `src/servidor/autorizacion.ts`: `obtenerEstadoAcceso()` memorizada con `cache()`, `requerirCajero()` y `requerirAdmin()`
    - `src/app/caja/layout.tsx` y `src/app/admin/layout.tsx` aplican `resolverAcceso`; `src/app/salir/route.ts` cierra la sesión y redirige a `/login?motivo=…`; `src/app/page.tsx` y `src/app/caja/page.tsx` redirigen con `destinoInicial`
    - _Requirements: 1.3, 1.7, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 7.1_

  - [ ] 12.5 Construir la pantalla de inicio de sesión
    - `src/app/login/page.tsx`: Nombre_de_Usuario y contraseña; formato inválido o rechazo de Auth → “Usuario o contraseña incorrectos” sin indicar el dato; `signInWithPassword` con `correoInterno`; después `miEstadoAcceso`: Usuario inactivo o Sede inactiva → `signOut` y mensaje; si no, `destinoInicial`
    - Muestra los mensajes de `motivo` que envía `/salir`
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.6_

  - [ ] 12.6 Implementar el cierre de sesión en el cliente y el manejador global de errores
    - `src/datos/sesion-cliente.ts`: `cerrarSesionYRedirigir(motivo)`
    - `src/componentes/ProveedorConsultas.tsx`: `QueryClientProvider` cuyo manejador global ante `USUARIO_INACTIVO`, `SEDE_INACTIVA` o `SESION_EXPIRADA` cierra la sesión y muestra `/login`; reintentos de lectura con espera exponencial (máximo 3)
    - _Requirements: 1.5, 1.7, 2.6_

  - [ ] 12.7 Crear el script del primer Administrador y el procedimiento de configuración inicial
    - `scripts/crear-primer-admin.ts` y script `setup:primer-admin`: pide nombre completo, Nombre_de_Usuario y contraseña (entrada oculta), valida con los esquemas de Zod, se niega si ya existe un Administrador activo y crea el Usuario con `auth.admin.createUser` (`email_confirm: true` y `app_metadata`); crea su propio cliente con la clave secreta, sin importar módulos con `server-only`
    - `docs/configuracion-inicial.md` con los pasos del diseño: proyecto y migraciones, Auth, variables de entorno, primer Administrador, estaciones de caja en modo quiosco con impresora de 80 mm y Diseños_Stitch con `npm run tokens:extraer`
    - _Requirements: 6.15_

  - [ ]* 12.8 Escribir la prueba de integración del primer Administrador
    - Sobre una base limpia, la lógica del script crea un Administrador que puede iniciar sesión, y una segunda ejecución se niega
    - _Requirements: 6.15_

- [ ] 13. Punto de control: autenticación y enrutamiento
  - Asegurar que todas las pruebas pasen y que `npm run build` termine sin errores; consultar al usuario si surgen dudas.

- [ ] 14. Construir la base del Entorno_Cajero
  - [ ] 14.1 Agregar los envoltorios RPC de caja
    - En `src/datos/rpc.ts`: `abrirTurno`, `registrarVenta`, `ventaPorClave`, `registrarGasto`, `anularGasto` y `cerrarTurno`, tipados con los modelos de `src/dominio/tipos.ts`
    - _Requirements: 7.2, 11.1, 11.8, 13.1, 13.5, 14.5_

  - [ ] 14.2 Construir el layout del Entorno_Cajero con el estado de acceso
    - `src/app/caja/layout.tsx` con `data-entorno="caja"`, `ProveedorConsultas` y el encabezado `EncabezadoCaja` (nombre de la Sede, nombre del Cajero, navegación Venta, Ventas, Gastos y Cerrar turno, y Salir)
    - Salir con Turno abierto muestra “Tu turno sigue abierto” con Salir y Volver antes de cerrar la sesión
    - `useEstadoAcceso`: `miEstadoAcceso` cada 30 s; Usuario inactivo o Sede inactiva → cerrar sesión; Turno cerrado por un Administrador → aviso y `/caja/apertura`
    - _Requirements: 1.5, 1.6, 1.7, 2.7, 16.4, 23.8_

  - [ ] 14.3 Implementar el estado de conexión
    - `useEstadoConexion`: eventos `online`/`offline`, `onlineManager` de TanStack Query, estado del canal Realtime y resultado de las llamadas; en `sin_conexion`, latido con `miEstadoAcceso` cada 5 s
    - Indicador en el encabezado con `WifiOff` y color de error
    - _Requirements: 11.11, 11.13, 23.11_

  - [ ] 14.4 Construir la pantalla de apertura de Turno
    - `src/app/caja/apertura/page.tsx`: Base_de_Caja con `TecladoNumerico`, validación con el campo señalado y Abrir turno; `TURNO_YA_ABIERTO` lleva a la Cuadrícula del Turno existente; el éxito lleva a `/caja/venta` con el Carrito vacío
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 23.14_

  - [ ] 14.5 Implementar el catálogo de la caja con propagación de cambios
    - `useCatalogo(sedeId)`: `v_productos_vendibles` con `queryKey: ['catalogo', sedeId]`, `refetchInterval: 30_000`, `refetchOnReconnect` y `refetchOnWindowFocus`
    - URLs firmadas en un lote (`createSignedUrls`, 24 h) en caché; canal Realtime `postgres_changes` sobre `productos_sede` filtrado por `sede_id` que invalida la consulta con un rebote de 300 ms; las fallas alimentan el estado de conexión
    - _Requirements: 4.10, 4.11, 5.9, 5.10, 5.11, 8.1_

  - [ ] 14.6 Implementar el almacén del Carrito
    - `useCarrito(usuarioId, turnoId)`: almacén externo con `useSyncExternalStore`, selectores y `reducirCarrito`; persistencia en `localStorage` con `claveCarrito`, diferida con `requestIdleCallback`; se borra al registrar la Venta o al cerrar el Turno
    - _Requirements: 8.6, 8.7, 8.8, 8.9, 8.10, 8.11, 8.12, 8.13, 8.14, 8.18, 23.13_

  - [ ] 14.7 Construir la Cuadrícula_de_Productos y el panel del Carrito
    - `src/app/caja/venta/page.tsx` con `TarjetaProducto` (`React.memo`; imagen de tamaño fijo y carga diferida o iniciales; Precio_de_Venta; Advertencia_de_Stock), filtros Todos y Categorías con Productos_Vendibles, y búsqueda
    - Panel del Carrito: nombre, cantidad, precio unitario, subtotal y Total; aumentar, disminuir, cantidad con `TecladoNumerico`, Quitar, Vaciar con confirmación y Advertencia_de_Stock por línea; Cobrar deshabilitado con el Carrito vacío o sin conexión
    - Cada actualización del catálogo ejecuta `reconciliarCarrito` y avisa precios actualizados y Productos retirados; 3 columnas y Carrito lateral de 320 px desde 768 px, 4–5 columnas desde 1024 px
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.15, 8.17, 9.1, 9.2, 9.3, 10.7, 10.8, 23.6, 23.13_

  - [ ]* 14.8 Escribir pruebas de componentes de la Cuadrícula y el Carrito
    - Iniciales sin imagen, Vaciar con confirmación, advertencias en tarjeta y línea, y Cobrar deshabilitado con el Carrito vacío o sin conexión
    - _Requirements: 8.2, 8.14, 8.17, 9.1, 9.2, 9.3_

- [ ] 15. Implementar el cobro y el registro de la Venta
  - [ ] 15.1 Implementar la máquina de estados del cobro
    - `useCobro`: `metodo` → `monto` → `enviando` → `exito` / `error_conexion` / `error_negocio`; al confirmar genera `clave = crypto.randomUUID()` y guarda `{ clave, carga }` en `localStorage`
    - Falla de red: Carrito intacto y bloqueado con “Sin conexión” y Reintentar (misma clave y carga); Volver consulta `ventaPorClave` antes de liberar el Carrito
    - Errores de negocio: `PRECIOS_ACTUALIZADOS` aplica los precios y pide confirmar de nuevo; `PRODUCTO_NO_VENDIBLE` quita las líneas con aviso; `MONTO_INSUFICIENTE` mantiene el diálogo; `TURNO_CERRADO` borra el Carrito y lleva a `/caja/apertura` con aviso; el éxito vacía el Carrito e invalida el catálogo
    - _Requirements: 10.7, 10.8, 11.1, 11.2, 11.9, 11.11, 11.12, 16.4_

  - [ ] 15.2 Construir el diálogo de cobro
    - `DialogoCobro`: Total y Efectivo, Transferencia y Tarjeta con íconos; en Efectivo, `TecladoNumerico`, Exacto, billetes de 2.000 a 100.000 que suman al monto, y Cambio o valor pendiente con la confirmación deshabilitada; Transferencia y Tarjeta confirman por el Total; Cancelar vuelve con el Carrito sin cambios
    - Conectarlo a la acción Cobrar de `/caja/venta`; flujo de cinco toques: Producto → Cobrar → Efectivo → Exacto → Confirmar
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 11.11, 11.13, 23.12, 23.14_

  - [ ] 15.3 Construir la confirmación de la Venta
    - `DialogoConfirmacionVenta`: ícono de éxito, Número_de_Venta y Cambio en grande; se cierra con un toque y deja la Cuadrícula con el Carrito vacío
    - _Requirements: 11.9, 11.10_

  - [ ]* 15.4 Escribir pruebas de componentes del cobro
    - Íconos y accesos rápidos, Cancelar sin cambios, valor pendiente, y transiciones de `useCobro` con RPC simuladas: falla de red con Reintentar de la misma clave y Volver con `ventaPorClave`
    - _Requirements: 10.1, 10.2, 10.4, 10.6, 11.11, 11.12_

- [ ] 16. Implementar las Ventas del Turno, los Gastos y el cierre con Arqueo_Ciego
  - [ ] 16.1 Construir la lista de Ventas del Turno
    - `src/app/caja/ventas/page.tsx`: Número_de_Venta, hora, Total y Método_de_Pago con ícono de las Ventas del Turno abierto
    - _Requirements: 12.6_

  - [ ] 16.2 Construir la pantalla de Gastos
    - `src/app/caja/gastos/page.tsx`: monto con `TecladoNumerico` y descripción, validación con campos señalados y `registrarGasto` con clave de idempotencia; `GASTO_SUPERA_EFECTIVO` → “Supera el efectivo en caja” sin ningún monto
    - Lista de Gastos vigentes con hora, descripción y monto; Anular con confirmación; `TURNO_CERRADO` → aviso y `/caja/apertura`
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 16.4, 23.14_

  - [ ] 16.3 Construir el Arqueo_Ciego
    - `src/app/caja/cierre/page.tsx`: con líneas en el Carrito, aviso de Carrito pendiente; si no, Efectivo_Contado con `TecladoNumerico` sin mostrar ni pedir el Efectivo_Esperado, validación y confirmación que muestra solo el valor contado
    - `cerrarTurno`; ante falla de conexión conserva el valor en memoria y en `localStorage` y ofrece Reintentar; el éxito borra el Carrito y lleva al resultado
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.10_

  - [ ] 16.4 Construir el resultado del cierre
    - `src/app/caja/cierre/resultado/page.tsx`: Efectivo_Esperado, Efectivo_Contado y Diferencia con `Estado` (Sobrante, Faltante o Caja_Cuadrada con color e ícono) a partir de `reporte_cierre` del último Turno cerrado; Finalizar cierra la sesión sin aviso y muestra `/login`
    - _Requirements: 14.8, 14.12, 23.11_

  - [ ]* 16.5 Escribir pruebas de componentes de Gastos y cierre
    - Lista y anulación de Gastos; aviso de Carrito pendiente; el Arqueo_Ciego no contiene el Efectivo_Esperado en el DOM antes del cierre
    - _Requirements: 13.4, 13.5, 14.1, 14.2, 14.4_

- [ ] 17. Punto de control: Entorno_Cajero
  - Asegurar que todas las pruebas pasen y que `npm run build` termine sin errores; consultar al usuario si surgen dudas.

- [ ] 18. Construir la base del Panel_Admin y el Resumen
  - [ ] 18.1 Construir el layout, el Selector_de_Sede y el encabezado de alcance
    - `src/app/admin/layout.tsx` con `data-entorno="admin"` y Salir; `src/app/admin/page.tsx` con `opcionesSelector`: tarjeta Todas_las_Sedes, Sedes activas con `IconoTipoSede` y al final las inactivas con marca; al escoger lleva a `/admin/[alcance]/resumen`
    - `src/app/admin/[alcance]/layout.tsx`: valida `todas` o el `id` de una Sede, muestra la opción actual con Cambiar (→ `/admin`) y la navegación de secciones (inferior con menú “Más” en teléfono y lateral desde 1024 px)
    - _Requirements: 2.3, 18.1, 18.2, 18.3, 18.4, 18.5, 23.7, 23.9_

  - [ ] 18.2 Implementar el alcance, el Rango_de_Fechas y su selector
    - `src/datos/admin/alcance.ts`: lectura de `[alcance]` y de `?desde&hasta` (predeterminado Hoy en America/Bogota) con `validarRango`, filtros por Sede y fecha para las consultas y paginación
    - `src/componentes/ui/SelectorRangoFechas.tsx`: Hoy, Ayer, Últimos 7 días, Mes actual y selección manual; `RANGO_INVALIDO` resalta ambas fechas
    - _Requirements: 18.3, 19.1, 19.2, 19.3, 19.4_

  - [ ] 18.3 Construir la sección Resumen
    - `src/app/admin/[alcance]/resumen/page.tsx` con `reporte_resumen`: `TarjetaResumen` para Total de Ventas, cantidad de Ventas, total por Método_de_Pago y Gastos vigentes, y `GraficoBarras` (Recharts) por día con tabla alternativa para lectores de pantalla
    - Con Todas_las_Sedes, desglose por Sede de cada total
    - _Requirements: 18.6, 19.5, 19.6, 19.7, 19.8_

  - [ ]* 18.4 Escribir pruebas de componentes del Selector_de_Sede y del Rango_de_Fechas
    - Orden y marca de inactivas en el Selector; rango inválido resaltado; accesos rápidos
    - _Requirements: 18.1, 19.2, 19.3_

- [ ] 19. Implementar la gestión de Sedes, Catálogo, Precios y Usuarios
  - [ ] 19.1 Crear la base de las Server Actions y la exigencia de Sede específica
    - `src/servidor/acciones/comun.ts`: envoltorio que valida con Zod, llama a `requerirAdmin()` con el JWT del llamador, convierte errores con `interpretarError`, devuelve `{ ok: true, datos } | { ok: false, codigo, campos? }` sin lanzar y ejecuta `revalidatePath`
    - `src/componentes/admin/RequiereSede.tsx`: con Todas_las_Sedes pide escoger una Sede antes de modificar precios, habilitar Productos o registrar Entradas y Ajustes
    - _Requirements: 6.1, 18.7, 22.7, 22.10_

  - [ ] 19.2 Construir la sección Sedes
    - `src/app/admin/[alcance]/sedes/page.tsx` y `src/servidor/acciones/sedes.ts` (`crearSede`, `editarSede`, `cambiarEstadoSede`): lista con nombre, ícono del tipo y estado; crear con nombre y tipo; editar nombre, dirección y teléfono con el tipo de solo lectura; activar o desactivar con `SEDE_CON_TURNO_ABIERTO` mostrando el Cajero; campos faltantes y `NOMBRE_DUPLICADO` señalados
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.9_

  - [ ] 19.3 Construir la sección Catálogo
    - `src/app/admin/[alcance]/catalogo/page.tsx` y `src/servidor/acciones/catalogo.ts`: pestañas Panadería y Asadero (predeterminada: el tipo de la Sede escogida); Categorías (crear, renombrar, eliminar con `CATEGORIA_CON_PRODUCTOS` y la cantidad)
    - Productos: crear con nombre, Categoría y Precio_de_Referencia; editar; activar o desactivar; eliminar con `PRODUCTO_CON_HISTORIAL` ofreciendo Desactivar; cambiar el Precio_de_Referencia con la opción aplicar a todas las Sedes
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.8, 4.9, 4.10, 4.11, 4.12, 5.2, 5.7, 5.8_

  - [ ] 19.4 Implementar las imágenes de Producto
    - `src/componentes/admin/ImagenProducto.tsx`: valida el archivo original con `validarImagen`, lo reduce en el navegador a WebP de máximo 512 px y lo sube con la sesión a `productos/<producto_id>/<marca_de_tiempo>.webp`
    - Acción en `src/servidor/acciones/catalogo.ts` que guarda `imagen_ruta` y borra el objeto anterior; `IMAGEN_INVALIDA` → “JPG, PNG o WebP, máx. 2 MB”
    - _Requirements: 4.6, 4.7, 4.10_

  - [ ] 19.5 Construir la sección Precios
    - `src/app/admin/[alcance]/precios/page.tsx` y `src/servidor/acciones/precios.ts` (`cambiarHabilitacion`, `cambiarPrecioVenta`): con una Sede, Productos de su Catálogo con interruptor de habilitación y Precio_de_Venta editable; un valor inválido se rechaza y la interfaz restaura el anterior; con Todas_las_Sedes, `RequiereSede`
    - _Requirements: 5.4, 5.5, 5.6, 5.9, 5.10, 18.7_

  - [ ] 19.6 Construir la sección Usuarios
    - `src/app/admin/[alcance]/usuarios/page.tsx`: con una Sede, sus Cajeros con nombre completo, Nombre_de_Usuario y estado; con Todas_las_Sedes, todos los Usuarios con Rol y Sede
    - `src/servidor/usuarios.ts` (lógica con los clientes inyectados) y `src/servidor/acciones/usuarios.ts`: `crearUsuario` (prevalidación, solo Sedes activas, `auth.admin.createUser` con `app_metadata` y `email_exists` → Nombre_de_Usuario duplicado), `editarUsuario` (perfil y luego correo interno; revierte el nombre si Auth falla), `restablecerContrasena` y `cambiarEstadoUsuario`
    - Errores `CAJERO_CON_TURNO_ABIERTO`, `ULTIMO_ADMINISTRADOR` y `SEDE_NO_DISPONIBLE` en el campo correspondiente
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 6.12, 6.13, 6.14, 22.10_

  - [ ]* 19.7 Escribir pruebas de integración de Usuarios contra Supabase Auth local
    - Creación e inicio de sesión, restablecimiento de contraseña, edición del Nombre_de_Usuario, `signUp` público rechazado y conservación de datos al desactivar
    - _Requirements: 6.1, 6.2, 6.9, 6.12_

- [ ] 20. Implementar la operación y los reportes del Panel_Admin
  - [ ] 20.1 Construir la sección Turnos
    - `src/app/admin/[alcance]/turnos/page.tsx` con `v_turnos_admin`: Turnos abiertos (Cajero, Sede y apertura) con Cerrar por Efectivo_Contado (`src/servidor/acciones/turnos.ts`, `cerrarTurnoAdmin`) y diálogo de resultado
    - Historial por fecha de apertura con totales, Efectivo_Esperado, Efectivo_Contado, Diferencia con color e ícono y marca de cierre por Administrador; detalle `turnos/[turnoId]` que muestra el contenido de `modeloReporteTurno`
    - _Requirements: 16.1, 16.2, 16.3, 20.3, 20.4, 20.5_

  - [ ] 20.2 Construir la sección Inventario
    - `src/app/admin/[alcance]/inventario/page.tsx` y `src/servidor/acciones/inventario.ts`: con una Sede, Stock por Producto resaltado con color e ícono si es ≤ 0; Entrada de varias líneas con la línea inválida señalada; Ajuste con diferencia previa, motivo y `STOCK_CAMBIADO` que recalcula y pide confirmar; historial por Producto y Rango_de_Fechas
    - Con Todas_las_Sedes, matriz Producto × Sede de solo lectura; Entrada y Ajuste usan `RequiereSede`
    - _Requirements: 17.2, 17.3, 17.4, 17.5, 17.6, 17.11, 17.12, 17.13, 18.7_

  - [ ] 20.3 Construir la sección Ventas
    - `src/app/admin/[alcance]/ventas/page.tsx` con `v_ventas_admin`: lista paginada con Número_de_Venta, fecha y hora, Cajero, Total y Método_de_Pago (más Sede con Todas_las_Sedes); al tocar, sus Líneas_de_Venta
    - _Requirements: 18.6, 19.9, 19.10_

  - [ ] 20.4 Construir la sección Gastos
    - `src/app/admin/[alcance]/gastos/page.tsx` con `v_gastos_admin`: fecha y hora, Cajero, descripción, monto y estado (anulados con marca visual), total de vigentes y, con Todas_las_Sedes, Sede y desglose
    - _Requirements: 18.6, 20.1, 20.2_

  - [ ] 20.5 Construir el reporte de Productos
    - `src/app/admin/[alcance]/productos/page.tsx` con `reporte_productos`: unidades y valor, orden por unidades, valor o nombre, y búsqueda con `filtrarReporteProductos`; con Todas_las_Sedes, ícono del Tipo_de_Sede y unidades por Sede
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6_

  - [ ]* 20.6 Escribir pruebas de componentes de Inventario, Gastos y Productos
    - Diferencia previa del Ajuste, marca de Gastos anulados y orden y búsqueda del reporte de Productos
    - _Requirements: 17.4, 20.2, 21.4, 21.5_

- [ ] 21. Punto de control: Panel_Admin
  - Asegurar que todas las pruebas pasen y que `npm run build` termine sin errores; consultar al usuario si surgen dudas.

- [ ] 22. Implementar la impresión en Formato_80mm
  - [ ] 22.1 Crear la zona de impresión y los documentos imprimibles
    - `src/impresion/impresion.css`: en `@media print` solo se ve `#zona-impresion`; contenido de 72 mm con 4 mm de margen, fuente monoespaciada de 12 px, texto negro, separadores punteados y `break-inside: avoid`
    - `ZonaImpresion.tsx` (portal oculto en pantalla), `Ticket.tsx` y `ReporteTurno.tsx` (presentan las secciones de `modeloTicket` y `modeloReporteTurno`)
    - `imprimir.ts`: renderiza, espera `document.fonts.ready` y dos cuadros, mide la altura, agrega `@page { size: 80mm <alto>mm; margin: 0 }`, llama a `window.print()` y limpia en `afterprint`; nunca lanza y permite mostrar “No se pudo imprimir” con Reimprimir
    - Montar `ZonaImpresion` en los layouts de `/caja` y `/admin`
    - _Requirements: 12.1, 12.5, 14.9, 20.6_

  - [ ] 22.2 Integrar la impresión en el Entorno_Cajero
    - Ticket original después de mostrar la confirmación de la Venta; Reimprimir en `/caja/ventas` con el nuevo envoltorio `datosTicket` en `src/datos/rpc.ts` y marca COPIA
    - Reporte_de_Turno original automático en `/caja/cierre/resultado` y Reimprimir reporte (COPIA); en `/caja/apertura`, Reimprimir reporte del último Turno cerrado por el Cajero (COPIA)
    - _Requirements: 12.1, 12.5, 12.7, 14.9, 15.7, 15.8, 15.9_

  - [ ] 22.3 Integrar la impresión en el Panel_Admin
    - Imprimir en el detalle de un Turno cerrado (COPIA); en el diálogo de resultado del cierre forzado, la primera impresión es el original
    - _Requirements: 16.3, 20.5, 20.6_

  - [ ]* 22.4 Escribir pruebas unitarias de `imprimir`
    - Con `window.print` simulado: regla `@page` agregada y limpiada, y un error resuelve sin lanzar y deja intactos los datos
    - _Requirements: 12.5_

- [ ] 23. Implementar la extracción de tokens visuales de Stitch
  - [ ] 23.1 Crear el script de extracción de tokens
    - `scripts/extraer-tokens-stitch.ts` y script `tokens:extraer`: lee cada `docs/diseno/*.html` como texto no confiable con `extraerPaleta`; escribe `docs/diseno/tokens-extraidos.json` y propone `docs/diseno/mapa-tokens.json` (respeta un mapa ya revisado)
    - Corrige con `varianteAccesible` cada par de `PARES_DE_CONTRASTE` por debajo de 4,5:1 y genera `src/estilos/tokens.generados.css` y `docs/diseno/reporte-contraste.md`
    - Sin archivos HTML termina con un mensaje claro y no modifica `tokens.generados.css`, de modo que rige la paleta de respaldo
    - _Requirements: 23.1, 23.4, 23.5_

  - [ ]* 23.2 Escribir pruebas unitarias del script de extracción
    - Con HTML sintético en una carpeta temporal: CSS generado, reporte de contraste, mapa revisado respetado y caso sin archivos
    - _Requirements: 23.1, 23.5_

- [ ] 24. Endurecer la seguridad y verificar de extremo a extremo
  - [ ] 24.1 Agregar la política CSP y los encabezados de seguridad
    - En `next.config.ts`: `connect-src` limitado al propio origen y al dominio de Supabase (`https` y `wss`), `img-src` con las URLs firmadas de Storage, `frame-ancestors 'none'` y ajustes solo para desarrollo
    - _Requirements: 22.10_

  - [ ]* 24.2 Crear la infraestructura de pruebas E2E
    - `tests/e2e/apoyo/`: datos propios por prueba (Sedes, Productos y Usuarios con nombres únicos creados con la clave secreta local), inicio de sesión por Rol, espía de `window.print`, medición de objetivos táctiles y de tiempos; `globalSetup` en `playwright.config.ts` que verifica Supabase local
    - _Requirements: 1.1, 22.9_

  - [ ]* 24.3 Escribir pruebas E2E de autenticación y sesión
    - `tests/e2e/autenticacion.spec.ts`: inicio por Rol, mismo mensaje para usuario inexistente y contraseña errada, Usuario inactivo, Sede inactiva, recarga, Salir con y sin Turno abierto, desactivación con sesión iniciada, acceso cruzado entre ambientes y Finalizar
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 14.12_

  - [ ]* 24.4 Escribir pruebas E2E de los flujos de caja
    - `tests/e2e/caja.spec.ts`: apertura con Carrito vacío, iniciales, Vaciar, diálogo de cobro, Cancelar, confirmación con Cambio, lista de Ventas, Gastos y anulación, Carrito pendiente al cerrar, Arqueo_Ciego sin Efectivo_Esperado en el DOM ni en las respuestas previas, resultado con color e ícono, Reimprimir reporte desde la apertura y aviso de Turno cerrado por Administrador
    - _Requirements: 7.5, 8.2, 8.14, 10.1, 10.2, 10.6, 11.9, 11.10, 12.6, 13.4, 14.1, 14.2, 14.4, 14.8, 15.7, 15.8, 16.4_

  - [ ]* 24.5 Escribir pruebas E2E de fallas de conexión y reintentos
    - `tests/e2e/conexion.spec.ts` con `page.route`: falla durante el cobro conserva el Carrito y Reintentar crea una sola Venta; indicador sin conexión con Cobrar deshabilitado; falla durante el cierre conserva el Efectivo_Contado
    - _Requirements: 11.11, 11.12, 11.13, 14.10_

  - [ ]* 24.6 Escribir pruebas E2E de impresión
    - `tests/e2e/impresion.spec.ts` con `page.emulateMedia({ media: 'print' })`: solo la zona de impresión es visible, mide 80 mm y contiene el Ticket o el Reporte_de_Turno; COPIA en reimpresiones; un error de impresión no afecta la Venta
    - _Requirements: 12.1, 12.5, 12.7, 14.9, 15.9, 20.6_

  - [ ]* 24.7 Escribir pruebas E2E del Panel_Admin
    - `tests/e2e/admin.spec.ts`: Selector y Resumen, Cambiar, recarga con la opción conservada, acciones que exigen Sede, pestañas de Catálogo, Sedes, Productos, Categorías e imagen en Storage, edición de Sede reflejada en un Ticket nuevo, detalle de Venta y de Turno, y diferencia previa del Ajuste
    - _Requirements: 3.1, 3.4, 3.6, 3.9, 4.2, 4.3, 4.6, 4.8, 17.4, 18.2, 18.4, 18.5, 18.7, 19.10, 20.5_

  - [ ]* 24.8 Escribir pruebas E2E de propagación de cambios
    - `tests/e2e/propagacion.spec.ts`: con Realtime bloqueado, un cambio de precio del Administrador aparece en la caja en menos de 60 s; con Realtime activo, en pocos segundos
    - _Requirements: 5.11_

  - [ ]* 24.9 Escribir pruebas E2E de rendimiento
    - `tests/e2e/rendimiento.spec.ts`: con 150 ms de latencia emulada, la confirmación de la Venta aparece en 2 s o menos; con CPU limitada ×4, el Carrito se actualiza en 200 ms o menos, medido con `performance.now()`
    - _Requirements: 11.8, 23.13_

  - [ ]* 24.10 Escribir pruebas E2E de usabilidad y accesibilidad
    - `tests/e2e/usabilidad.spec.ts`: venta en Efectivo exacto en cinco toques; objetivos de al menos 48 × 48 px en la caja y 44 × 44 px en el Panel_Admin con `boundingBox()`; vistas a 768 px (caja) y a 360, 768 y 1280 px (admin); axe sin violaciones de contraste; ícono y etiqueta en acciones; estados con color e ícono; teclado numérico en cada monto; formato `$ 12.500`; `lang="es-CO"`
    - _Requirements: 23.4, 23.6, 23.7, 23.8, 23.9, 23.10, 23.11, 23.12, 23.14, 23.15, 23.16_

  - [ ]* 24.11 Escribir pruebas de seguridad de la construcción y del registro
    - `tests/e2e/seguridad.spec.ts`: tras `next build`, ningún archivo de `.next/static` contiene el valor de la clave secreta ni el nombre `SUPABASE_SECRET_KEY`; `signUp` público rechazado
    - _Requirements: 6.1, 22.10_

- [ ] 25. Aplicar los Diseños_Stitch (requiere las exportaciones del usuario en `docs/diseno/`)
  - [ ] 25.1 Generar y aplicar los tokens de la Paleta_de_Colores de Stitch
    - Requisito previo: el usuario copió en `docs/diseno/` las exportaciones de Stitch (HTML e imágenes). Si la carpeta no las contiene, detener la tarea y pedirlas al usuario; no inventar la paleta
    - Ejecutar `npm run tokens:extraer`, revisar y ajustar `docs/diseno/mapa-tokens.json` y repetir hasta que `docs/diseno/reporte-contraste.md` muestre todos los pares en 4,5:1 o más
    - Conservar `src/estilos/tokens.generados.css` generado y ejecutar `tests/propiedades/visual.prop.test.ts` si existe
    - _Requirements: 23.1, 23.4, 23.5_

  - [ ] 25.2 Reproducir la estructura y la disposición de las pantallas de referencia
    - Requisito previo: el mismo de la tarea 25.1
    - Crear `docs/diseno/mapa-pantallas.md` con el archivo de referencia de cada pantalla de la tabla del diseño
    - Ajustar las pantallas con referencia (inicio de sesión, apertura, venta, cobro, Gastos si tiene referencia, cierre, Selector_de_Sede, Resumen y listados y formularios del Panel_Admin) reutilizando los componentes existentes; las pantallas sin referencia usan los mismos tokens y componentes
    - Mantener objetivos táctiles, íconos con etiqueta, estados con color e ícono y textos en español; volver a ejecutar `tests/e2e/usabilidad.spec.ts` si existe
    - _Requirements: 23.2, 23.3, 23.6, 23.7, 23.8, 23.9_

- [ ] 26. Punto de control final
  - Asegurar que todas las pruebas pasen (`npm test`, `npm run test:bd`, `npm run db:test`, `npm run test:e2e`) y que `npm run build` termine sin errores; consultar al usuario si surgen dudas.

## Notes

- Las sub-tareas marcadas con `*` son opcionales (pruebas y sus utilidades) y pueden omitirse para un MVP más rápido.
- Cada tarea referencia criterios de aceptación de `requirements.md`; cada prueba de propiedad referencia su Propiedad de `design.md`.
- Pruebas de propiedades: fast-check con `numRuns` de al menos 100, una sola prueba por Propiedad y la etiqueta `// Feature: pos-multisede, Property N: <título>`.
- Las pruebas de Base_de_Datos y E2E requieren `supabase start`. Solo las tareas de migración, de datos de desarrollo y la 12.8 ejecutan `supabase db reset`; las demás pruebas usan transacciones con `rollback` o datos propios que limpian al terminar.
- Las migraciones tienen nombres fijos para conservar su orden aunque se trabajen en distintas olas: tablas → auxiliares → disparadores → RLS → vistas → Storage y Realtime → RPC → reportes.
- Las pruebas E2E van en olas separadas porque comparten la carpeta `.next` y la base local.
- El grupo 25 depende de que el usuario copie los Diseños_Stitch en `docs/diseno/`; está al final para no bloquear el resto del plan.
- Fuera del plan, por ser manual: la revisión lado a lado con Stitch, la impresión física en la térmica de 80 mm y la conformidad completa con WCAG, que requiere pruebas con tecnologías de asistencia y revisión experta.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "1.5"] },
    { "id": 2, "tasks": ["2.1", "7.1", "7.2", "7.4", "7.6", "7.13", "9.1", "9.2"] },
    { "id": 3, "tasks": ["2.2", "7.3", "7.5", "7.9", "7.14", "7.15", "8.11", "8.15", "8.18", "9.3", "11.1", "23.1"] },
    { "id": 4, "tasks": ["2.3", "7.7", "7.10", "7.16", "8.1", "8.12", "8.16", "9.4", "11.3", "23.2"] },
    { "id": 5, "tasks": ["3.1", "7.11", "7.17", "8.2", "8.5", "8.7", "8.17"] },
    { "id": 6, "tasks": ["3.2", "7.12", "8.3", "8.6", "8.9", "11.2"] },
    { "id": 7, "tasks": ["3.3", "8.4", "8.8", "8.10", "11.4"] },
    { "id": 8, "tasks": ["4.1"] },
    { "id": 9, "tasks": ["4.2"] },
    { "id": 10, "tasks": ["4.3"] },
    { "id": 11, "tasks": ["4.4"] },
    { "id": 12, "tasks": ["5.1"] },
    { "id": 13, "tasks": ["5.2"] },
    { "id": 14, "tasks": ["5.3"] },
    { "id": 15, "tasks": ["5.4"] },
    { "id": 16, "tasks": ["5.5"] },
    { "id": 17, "tasks": ["2.4", "12.1", "12.7"] },
    { "id": 18, "tasks": ["2.5", "2.7", "4.5", "5.6", "5.9", "5.11", "5.12", "7.8", "8.13", "12.2", "12.3", "12.4", "12.6", "14.1", "14.6", "18.2"] },
    { "id": 19, "tasks": ["2.6", "4.6", "5.8", "5.10", "5.13", "8.14", "12.5", "14.2", "18.1", "19.1"] },
    { "id": 20, "tasks": ["3.4", "4.7", "8.19", "14.3", "14.4", "16.1", "16.2", "16.3", "18.3", "19.2", "19.3", "19.5", "19.6", "20.1", "20.2", "20.3", "20.4", "20.5"] },
    { "id": 21, "tasks": ["4.8", "5.7", "14.5", "16.4", "18.4", "19.4", "19.7", "20.6", "22.1"] },
    { "id": 22, "tasks": ["4.9", "14.7", "15.1", "16.5", "22.3", "22.4"] },
    { "id": 23, "tasks": ["4.10", "14.8", "15.2"] },
    { "id": 24, "tasks": ["12.8", "15.3"] },
    { "id": 25, "tasks": ["15.4", "22.2"] },
    { "id": 26, "tasks": ["24.1"] },
    { "id": 27, "tasks": ["24.2"] },
    { "id": 28, "tasks": ["24.3"] },
    { "id": 29, "tasks": ["24.4"] },
    { "id": 30, "tasks": ["24.5"] },
    { "id": 31, "tasks": ["24.6"] },
    { "id": 32, "tasks": ["24.7"] },
    { "id": 33, "tasks": ["24.8"] },
    { "id": 34, "tasks": ["24.9"] },
    { "id": 35, "tasks": ["24.10"] },
    { "id": 36, "tasks": ["24.11"] },
    { "id": 37, "tasks": ["25.1"] },
    { "id": 38, "tasks": ["25.2"] }
  ]
}
```
