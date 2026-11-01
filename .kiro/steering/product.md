---
inclusion: always
---

# Producto: POS multisede

POS web para una empresa con varias sedes de dos tipos: **Panadería** y **Asadero**. Todo vive en una sola base de datos Supabase.

## Ambientes (según el rol del usuario)

- **Caja (Cajero)**: abrir turno con base, vender, cobrar, imprimir ticket, registrar gastos, cerrar turno con arqueo ciego e imprimir el reporte de turno para el encargado.
- **Admin (Administrador)**: escoger sede (o "Todas"), gestionar sedes, productos, precios, usuarios, ver reportes e inventario mensual.

## Reglas de negocio confirmadas

### Generales

- Moneda COP en enteros, sin decimales. Zona horaria `America/Bogota` (los días de los reportes se cortan a medianoche de Bogotá).
- Solo en línea. La app instalable (PWA) muestra una página "Sin conexión" pero no vende sin internet.
- No hay control de stock en tiempo real. Las ventas no descuentan inventario.
- Montos permitidos (base, precio, costo, gasto, efectivo contado): de $ 1 a $ 999.999.999 (la base y el contado pueden ser $ 0).

### Usuarios y acceso

- Roles fijos: `cajero` y `admin`. Cada cajero pertenece a **una** sede. El admin es global y no vende.
- Login con nombre de usuario + contraseña (mín. 8). Solo el admin crea usuarios y restablece contraseñas. No hay registro público.
- El nombre de usuario no se cambia después de creado.
- Los usuarios no se borran: se desactivan. Un usuario inactivo no puede entrar.
- Debe quedar siempre al menos un admin activo.
- Un cajero solo se asigna a una sede activa.
- A un cajero con turno abierto no se le puede cambiar la sede ni el rol, ni desactivar. Primero se cierra el turno.
- Si la sede del cajero está inactiva, el cajero no puede trabajar en la caja.

### Sedes

- Tipo **Panadería** o **Asadero**. El tipo no cambia después de creada.
- Una sede con turno abierto no se puede desactivar (se indica qué cajeros lo tienen).
- Al crear una sede quedan habilitados todos los productos de su catálogo al precio de referencia.
- NIT opcional por sede (solo números, dígito de verificación opcional). El ticket lo imprime en la cabecera junto con "Régimen simplificado".

### Catálogo, precios y costos

- Un catálogo por tipo de sede. Un producto pertenece a un solo catálogo y no se cambia de catálogo.
- Nombre de producto único dentro del catálogo (sin distinguir mayúsculas), máx. 80 caracteres. Categoría máx. 40 y del mismo catálogo.
- Imagen y categoría son opcionales. La foto se reduce en el navegador (lado mayor 600 px, WebP) sin recortarla. Se acepta un original de hasta 25 MB.
- Producto nuevo: queda habilitado en todas las sedes de su tipo con el precio de referencia.
- Cada sede habilita o no cada producto y define **su propio precio de venta**. "Aplicar a todas las sedes" copia el precio de referencia a todas.
- El **costo** es por sede y opcional (sin costo = vacío). Solo lo ve el admin; el cajero no puede leerlo por ningún medio.
- Un producto con ventas no se elimina: se desactiva. Una categoría con productos no se elimina.
- La caja solo muestra productos **activos** y **habilitados** en su sede.

### Turnos

- Una sola caja por sede: **un solo turno abierto por sede**. Otro cajero ve "Caja ocupada" con el nombre y la hora de quien la tiene, y no puede abrir hasta que se cierre.
- Un turno abierto máximo por cajero. Sin turno abierto no se vende ni se registran gastos.
- **El turno queda amarrado al equipo donde se abrió.** Mientras esté abierto, el cajero solo puede entrar, vender, registrar o anular gastos y cerrar desde ese equipo. Si entra desde otro equipo se le cierra la sesión con el aviso correspondiente.
- El turno lo cierra su cajero o el admin. El admin puede cerrarlo desde cualquier equipo y el reporte queda marcado "cerrado por admin".
- El admin puede ver cómo va la caja de un turno abierto (ventas, métodos, gastos, esperado).
- Al cerrar, el cajero imprime el reporte y con "Siguiente cajero" se cierra la sesión para que entre otro usuario.
- Un turno cerrado no se modifica ni se borra. El reporte se guarda tal como se imprimió al cerrar, para reimprimirlo igual.

### Ventas y cobro

- Venta solo por unidades enteras: de 1 a 999 por producto.
- Cada venta tiene **un** método de pago: Efectivo, Transferencia (en pantalla **"QR"**: Nequi/Daviplata/QR) o Tarjeta. QR y tarjeta se verifican a mano.
- Efectivo: lo recibido debe cubrir el total. El sistema calcula el cambio. Se cobra con billetes y monedas de Colombia en pantalla, "Exacto" o teclado numérico.
- El total lo calcula la base de datos con sus precios. Si un precio cambió mientras el carrito estaba abierto, la venta se rechaza y el carrito se ajusta al precio nuevo.
- Cada cobro lleva una clave única: si se reintenta por fallas de red no se duplica la venta.
- Número de venta consecutivo por sede.
- Las ventas no se modifican, no se anulan ni se borran. Guardan copia del nombre y del precio del momento.

### Gastos

- Gastos = salidas de efectivo de la caja durante el turno, con descripción obligatoria (máx. 120).
- No pueden superar el efectivo esperado. El rechazo no revela cuánto hay (arqueo ciego).
- Se pueden anular mientras el turno está abierto. El gasto anulado no cuenta en el esperado ni en los reportes (se muestra tachado).

### Cierre y documentos

- Efectivo esperado = base + ventas en efectivo − gastos vigentes.
- Cierre con **arqueo ciego**: el cajero cuenta sin ver el esperado. Diferencia = contado − esperado (faltante o sobrante).
- Se imprime el reporte de turno (80 mm) con firmas de cajero y encargado. El ticket de venta también es de 80 mm.
- Reimpresiones llevan la marca **COPIA**.

### Reportes (solo admin)

- Por sede o "Todas". Rango de fechas máximo de 1 año.
- Resumen, ventas, gastos, turnos, ventas por producto, cuadre diario, diferencias por cajero y ventas por hora.

### Inventario por fecha (pendiente, spec 05)

- Conteo físico por sede en una fecha, valorizado con costos. Independiente de las ventas. Solo admin. Detalles en `.kiro/specs/05-inventario/`.
- Incluye productos de venta y **materias primas** por sede (harina, aceite, carbón, empaques) con unidad (bulto, kilo, libra…) y cantidades con fracción (9½ bultos). Las materias primas nunca aparecen en la caja. En la BD se llaman `articulos_inventario`.
- Un inventario en curso por sede; se continúa hasta finalizarlo. Uno finalizado se puede volver a editar. Se descarga en Excel (CSV), sin PDF.

### Carga de productos desde el software anterior

- Se importan nombre, precio de venta y categoría. Nombres y categorías en MAYÚSCULAS.
- Se ignoran inventario, impuestos y códigos del archivo anterior.
- Script: `npm run importar-productos -- <csv> --tipo=panaderia|asadero` (sin `--aplicar` solo analiza).

## Fuera de alcance v1

Facturación electrónica DIAN, offline, recetas (descontar materias primas al vender), descuentos, pagos combinados, anulación de ventas y devoluciones, venta por peso, integración con datáfonos o pasarelas, exportar reportes de ventas a Excel/PDF (solo el inventario se descarga, en CSV), PDF del inventario, envío por correo/WhatsApp, impuestos desglosados, mesas/comandas.

## Principio rector

**Minimalista e intuitivo.** Cada pantalla muestra solo lo necesario para la tarea. Poco texto, íconos de apoyo, botones grandes. Si una función no es imprescindible, no va. Ante la duda, preguntar al usuario en vez de suponer.
