# Requirements: 02 Catálogo y precios por sede

Depende de: spec 01.

## R1. Catálogo por tipo de sede

1. Debe existir un catálogo para Panadería y otro para Asadero. La pantalla Productos muestra una pestaña por tipo.
2. El admin DEBE poder crear un producto con nombre (único en el catálogo, sin distinguir mayúsculas), precio de referencia, y opcionalmente categoría e imagen.
3. Precios: enteros > 0 y ≤ $ 999.999.999. Si no, se rechaza y se marca el campo.
4. Imagen: JPG, PNG o WebP, máx. 2 MB. Si no hay imagen, la caja muestra las iniciales del producto.
5. El admin DEBE poder crear, renombrar y eliminar categorías. SI una categoría tiene productos, no se elimina y se indica cuántos tiene.
6. El admin DEBE poder editar y activar/desactivar productos. Un producto inactivo desaparece de la caja en todas las sedes.
7. SI un producto ya tiene ventas o inventarios, no se elimina; se ofrece desactivarlo.

## R2. Productos de cada sede

1. CUANDO se crea una sede, el sistema DEBE habilitar en ella los productos activos de su catálogo con el precio de referencia y sin costo.
2. CUANDO se crea un producto, el sistema DEBE habilitarlo en todas las sedes de su tipo con el precio de referencia y sin costo.
3. Una sede solo puede tener productos de su propio catálogo.

## R3. Pantalla Precios (una sede escogida)

1. CUANDO hay una sede escogida, la pantalla Precios DEBE listar los productos del catálogo de esa sede con: interruptor habilitado, precio de venta y costo, ambos editables.
2. SI está escogido "Todas las sedes", la pantalla DEBE pedir escoger una sede.
3. Cambiar el precio o la habilitación afecta solo a esa sede y solo a ventas futuras.
4. Cambiar el precio de referencia NO cambia los precios de las sedes, salvo que el admin marque "Aplicar a todas las sedes", que lo copia a todas las sedes del tipo.
5. El costo es entero > 0 y ≤ $ 999.999.999, vacío hasta que el admin lo define. Los cajeros NUNCA pueden verlo.
6. Búsqueda por nombre en la lista.

## R4. Guardado automático (precio, costo, interruptor)

1. El precio y el costo se guardan al salir del campo o al presionar Enter. El interruptor se guarda al tocarlo. No hay botón Guardar.
2. Entrar y salir de un campo sin cambiar el valor no guarda nada.
3. SI el valor es inválido, el campo se marca en rojo con ícono de error y vuelve al valor anterior.
4. SI el guardado falla (p. ej. sin conexión), se conserva lo escrito y aparece un aviso con "Reintentar". Al guardar con éxito el aviso desaparece.
5. Un indicador discreto (✓) confirma cada guardado.

## R5. Reflejo en la caja

1. Los cambios de precio, habilitación, nombre, imagen, categoría o estado DEBEN verse en la caja de la sede en máximo 60 segundos sin recargar.
