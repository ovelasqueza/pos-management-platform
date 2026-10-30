---
inclusion: always
---

# Producto: POS multisede

POS web para una empresa con varias sedes de dos tipos: **Panadería** y **Asadero**. Todo vive en una sola base de datos Supabase.

## Ambientes (según el rol del usuario)

- **Caja (Cajero)**: abrir turno con base, vender, cobrar, imprimir ticket, registrar gastos, cerrar turno con arqueo ciego e imprimir el reporte de turno para el encargado.
- **Admin (Administrador)**: escoger sede (o "Todas"), gestionar sedes, productos, precios, usuarios, ver reportes e inventario mensual.

## Reglas de negocio confirmadas

- Roles fijos: `cajero` y `admin`. Cada cajero pertenece a **una** sede. El admin es global y no vende.
- Login con nombre de usuario + contraseña (mín. 8). Solo el admin crea usuarios.
- Un catálogo por tipo de sede. Cada sede habilita sus productos y define **su propio precio de venta**. El precio de referencia del catálogo es el valor inicial.
- Imagen y categoría del producto son opcionales. Venta solo por unidades enteras.
- Una sola caja por sede: **un solo turno abierto por sede**. Otro cajero no puede abrir turno hasta que se cierre el abierto (lo cierra su cajero o el admin). Un turno abierto máximo por cajero. Sin turno abierto no se vende.
- Cada venta tiene **un** método de pago: Efectivo, Transferencia (Nequi/Daviplata/QR) o Tarjeta. Transferencia y tarjeta se verifican a mano.
- Gastos = salidas de efectivo de la caja durante el turno. No pueden superar el efectivo esperado. Se pueden anular mientras el turno está abierto.
- Efectivo esperado = base + ventas en efectivo − gastos vigentes.
- Cierre con **arqueo ciego**: el cajero cuenta sin ver el esperado. Se imprime el reporte de turno (80 mm) con firmas de cajero y encargado.
- Reimpresiones llevan la marca **COPIA**.
- No hay control de stock en tiempo real. Las ventas no descuentan inventario.
- Moneda COP en enteros, sin decimales. Zona horaria `America/Bogota`.
- Solo en línea (sin modo offline).

## Fuera de alcance v1

Facturación electrónica DIAN, offline, recetas/materias primas, descuentos, pagos combinados, anulación de ventas y devoluciones, venta por peso, integración con datáfonos o pasarelas, exportar a Excel/PDF, envío por correo/WhatsApp, impuestos desglosados, mesas/comandas.

## Principio rector

**Minimalista e intuitivo.** Cada pantalla muestra solo lo necesario para la tarea. Poco texto, íconos de apoyo, botones grandes. Si una función no es imprescindible, no va. Ante la duda, preguntar al usuario en vez de suponer.
