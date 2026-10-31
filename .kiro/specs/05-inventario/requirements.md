# Requirements: 05 Inventario por fecha

> Estado: **v3 (2026-10-31)**, cerrada con las respuestas del usuario. Lista para implementar.

Depende de: specs 01 y 02 (sedes, productos y costos por sede).

## Concepto

El admin hace un **conteo físico** de lo que hay en una sede en una fecha y lo valoriza con costos. Solo para llevar cuentas: no se compara con las ventas y las ventas no lo afectan. Solo lo maneja el admin.

En un inventario se cuentan dos clases de cosas:

- **Productos de venta**: los del catálogo de la sede (pan, pollo, gaseosas…), con su costo por sede (spec 02).
- **Artículos de inventario**: cosas que existen solo para el inventario (harina, aceite, carbón, empaques…). **Nunca** aparecen en la caja, en Productos, en precios ni en reportes de ventas.

## R1. Artículos de inventario (por sede)

1. Cada sede tiene sus propios artículos. Se crean con nombre (único en la sede sin distinguir mayúsculas, máx. 80, en MAYÚSCULAS), **unidad de medida** y costo por esa unidad (opcional).
2. Unidades: Unidad, Kilo, Gramo, Libra, Litro, Bulto, Arroba, Paquete, Caja.
3. La unidad es la forma en que se cuenta el artículo y el costo es por esa unidad (ej.: HARINA · Bulto · $ 95.000 el bulto).
4. Se pueden editar (nombre, unidad, costo) y desactivar. Un artículo usado en algún inventario no se borra, solo se desactiva. Un artículo inactivo no sale en inventarios nuevos.
5. Cambiar la unidad de un artículo no cambia inventarios ya hechos (guardan copia de la unidad).
6. El cajero no puede ver los artículos ni su costo por ningún medio.

## R2. Cantidades con fracciones

El reto: en materia prima se cuenta, por ejemplo, "9 bultos completos y medio bulto".

1. La cantidad se escribe en la unidad del artículo y admite decimales: **9,5** bultos. Hasta 3 decimales (0,125 = un octavo; 0,250 kg).
2. Junto al campo hay atajos para sumar fracciones: **+¼ +½ +¾**. Ejemplo: escribir 9 y tocar +½ → 9,5.
3. Se muestra la cantidad con su unidad y, si tiene fracción común, también en palabras: "9½ bultos".
4. Los productos de venta se cuentan en unidades enteras (sin decimales ni atajos).
5. Rango: 0 a 999.999. Vacía = 0. Coma o punto como separador decimal.

## R3. Inventario de una sede en una fecha

1. Cada inventario pertenece a **una sede** y tiene una **fecha** (día) que escoge el admin. Por defecto hoy (Bogotá). No se permiten fechas futuras.
2. Varias sedes pueden tener inventario el mismo día. Una misma sede tiene máximo **un inventario por fecha**.
3. Nota opcional (máx. 120), por ejemplo "Cierre de mes".
4. Al crear el inventario se arma la lista inicial con los productos **activos y habilitados** en la sede y los artículos **activos** de la sede, con cantidad vacía y el costo vigente copiado.
5. El admin puede agregar cualquier producto del catálogo de la sede o artículo de la sede que no esté en la lista, y quitar líneas (con confirmación).
6. Solo sedes activas pueden tener inventarios nuevos o editarse. Los de una sede inactiva son de solo consulta.

## R4. Estados: En curso y Finalizado

1. Un inventario nuevo queda **En curso**. Se puede salir y **continuar** después tantas veces como haga falta; cada cambio se guarda solo.
2. Una sede tiene como máximo **un inventario En curso** a la vez. Al tocar "+ Inventario" con uno en curso, se ofrece continuarlo.
3. **Finalizar** pide confirmación y deja el inventario de solo lectura. Registra quién y cuándo lo finalizó.
4. Un inventario finalizado se puede **editar** con un botón discreto (texto pequeño, sin color, junto a la última modificación). Pide confirmación y lo vuelve a dejar En curso hasta finalizarlo otra vez.
5. Solo un inventario En curso se puede borrar (con confirmación). Uno finalizado primero se edita y luego se borra.

## R5. Líneas, valores y costos

1. Cada línea guarda: producto o artículo, copia del nombre, copia de la unidad, cantidad y copia del costo por unidad (puede ir vacío).
2. Valor = cantidad × costo, redondeado a pesos enteros. Sin costo → "sin costo".
3. Total = suma de las líneas con costo. Si alguna no tiene costo, el total lleva un aviso (ícono + color).
4. Se muestran subtotales **Productos** y **Artículos** y el total.
5. Líneas en dos grupos (Productos, Artículos), cada uno en orden alfabético.
6. El costo se copia al crear la línea. Cambiar después un costo en Productos o en Artículos no modifica inventarios ya hechos.
7. Mientras está En curso, el botón **"Actualizar costos"** vuelve a copiar los costos vigentes en todas las líneas (con confirmación). El costo no se escribe a mano en el inventario.

## R6. Guardado

1. La cantidad se guarda sola al salir del campo o con Enter (reglas de autoguardado de la spec 02 R4). Enter pasa a la siguiente línea.
2. Se muestra quién y cuándo hizo la última modificación.

## R7. Ver y descargar

1. Cualquier inventario (en curso o finalizado) se puede **ver** completo en pantalla.
2. **Descargar Excel (CSV)**: archivo que Excel abre directo, con sede, NIT, fecha, estado, nota y una fila por línea (grupo, nombre, unidad, cantidad, costo, valor), subtotales y total.
3. Un inventario En curso se descarga con el estado "EN CURSO".
4. No hay PDF ni impresión del inventario.

## R8. Pantallas

### Con una sede escogida

1. **Lista de inventarios**, del más reciente al más antiguo: fecha, estado, nota, total (aviso "sin costo") y última modificación. Botón "+ Inventario" (o "Continuar" si hay uno en curso).
2. **Detalle**: fecha, estado y nota arriba; total grande con subtotales; buscador sin tildes; líneas Nombre | Cantidad + unidad (+¼ +½ +¾ en artículos) | Costo | Valor | quitar. Botones "+ Agregar", "Actualizar costos", "Finalizar", "Excel".
3. **Artículos**: tabla Nombre | Unidad | Costo | Activo | editar. Botón "+ Artículo".

### Con "Todas las sedes"

4. Tabla con el **último inventario finalizado** de cada sede: sede, fecha, total (aviso "sin costo") y total general. Si la sede tiene uno en curso, se indica. Sin inventarios: "Sin inventario". Orden: activas primero, alfabético.

## Fuera de alcance

- Recetas o descontar materias primas al vender.
- Comparar con ventas o con el inventario anterior (diferencias, mermas).
- Conversión automática entre unidades (ej. bultos ↔ kilos). Cada artículo se cuenta en una sola unidad.
- Compras, proveedores, entradas y salidas de bodega.
- Escribir el costo a mano dentro del inventario.
- PDF o impresión del inventario (solo se descarga en CSV).
