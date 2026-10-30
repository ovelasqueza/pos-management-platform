# Requirements Document

## Introduction

Plataforma POS (punto de venta) multisede para una empresa con Sedes de tipo Panadería y Asadero. Toda la información de las Sedes se unifica en una única Base_de_Datos en Supabase. La Plataforma_POS tiene dos ambientes según el Rol del Usuario:

- **Entorno_Cajero**: el Cajero abre su Turno con una Base_de_Caja, vende los Productos de su Sede con el Precio_de_Venta definido, escoge las unidades, cobra con Efectivo, Transferencia o Tarjeta, imprime el Ticket, registra Gastos y cierra el Turno con un Arqueo_Ciego. Al cerrar, se imprime el Reporte_de_Turno para el Encargado.
- **Panel_Admin**: el Administrador escoge primero una Sede (o Todas_las_Sedes) y desde allí gestiona Sedes, Catálogos, Precios_de_Venta, Costos y Usuarios, registra el Inventario_Mensual de cada Sede y consulta reportes de Ventas, Gastos, Turnos, Productos e Inventarios_Mensuales, por Sede o consolidados.

La experiencia debe ser muy intuitiva y minimalista: entre menos elementos tenga cada pantalla y más funcional sea, mejor para los empleados. Se usa poco texto, botones grandes para pantallas táctiles e íconos como apoyo visual. Los Diseños_Stitch sirven como guía de la Paleta_de_Colores y del estilo general.

### Supuestos

Todos los supuestos de esta lista fueron confirmados por el usuario.

1. La Plataforma_POS es una única aplicación web responsiva y apta para pantallas táctiles; el Rol del Usuario determina el ambiente que se muestra. (Confirmado por el usuario)
2. La Plataforma_POS opera únicamente en línea; no existe modo sin conexión. (Confirmado por el usuario)
3. Supabase provee la Base_de_Datos (PostgreSQL), la autenticación de Usuarios y las Políticas_de_Acceso (Row Level Security). (Confirmado por el usuario)
4. La moneda es el peso colombiano (COP) en valores enteros, sin decimales, y la Zona_Horaria_Operativa es America/Bogota. (Confirmado por el usuario)
5. Los Roles son fijos: Cajero y Administrador. Cada Usuario tiene un solo Rol. Cada Cajero pertenece a exactamente una Sede. El Administrador es global y no registra Ventas. Los Usuarios inician sesión con Nombre_de_Usuario y contraseña de mínimo 8 caracteres; solo el Administrador crea Usuarios y el primer Administrador se crea con un procedimiento de configuración inicial. (Confirmado por el usuario)
6. El Encargado no es un Rol de la Plataforma_POS; es la persona que recibe el Reporte_de_Turno impreso. (Confirmado por el usuario)
7. Existe un Catálogo por Tipo_de_Sede. El Tipo_de_Sede no cambia después de crear la Sede. Cada Producto nuevo se habilita automáticamente en las Sedes de su Tipo_de_Sede y cada Sede nueva habilita automáticamente los Productos activos de su Catálogo. Cada Sede habilita los Productos que vende y define su propio Precio_de_Venta; el Precio_de_Referencia del Catálogo sirve como valor inicial y el Administrador puede aplicarlo a todas las Sedes del Tipo_de_Sede. La imagen y la Categoría de cada Producto son opcionales. (Confirmado por el usuario)
8. Cada Cajero tiene como máximo un Turno abierto y maneja su propia caja durante el Turno. El Cajero necesita un Turno abierto para vender. El Administrador puede cerrar un Turno abierto. Mientras un Cajero tiene un Turno abierto, el Administrador no puede cambiarle la Sede ni el Rol, desactivarlo ni desactivar su Sede. El cierre se hace con Arqueo_Ciego, el Reporte_de_Turno se imprime automáticamente y la acción Finalizar cierra la sesión del Cajero. (Confirmado por el usuario)
9. Cada Venta se paga con un único Método_de_Pago. Los pagos por Transferencia y Tarjeta se verifican manualmente, sin integración con datáfonos ni billeteras digitales. Las reimpresiones de Tickets y de Reportes_de_Turno llevan la marca COPIA. (Confirmado por el usuario)
10. El Inventario_Mensual es un conteo físico mensual de los Productos de cada Sede que sirve solo para llevar cuentas. No existe control de existencias en tiempo real y las Ventas no afectan el inventario. Solo el Administrador registra y edita el Inventario_Mensual, que permanece editable sin cierre ni bloqueo mientras la Sede está activa. Los Inventarios_Mensuales de una Sede inactiva son de solo consulta: el Administrador no puede registrar Inventarios_Mensuales nuevos para esa Sede ni modificar cantidades, agregar o quitar Líneas_de_Inventario en los existentes. El Administrador puede agregar a un Inventario_Mensual cualquier Producto del Catálogo del Tipo_de_Sede de la Sede que todavía no tenga Línea_de_Inventario en ese Inventario_Mensual, esté el Producto activo o inactivo y habilitado o deshabilitado en la Sede; así puede volver a agregar un Producto quitado por error. El Costo de cada Producto es distinto por Sede, se define en el Producto_de_Sede y se cambia solo cuando hace falta. El Costo es un número entero mayor que cero y el Cajero no puede consultarlo. El Inventario_Mensual se registra para el mes actual o para meses anteriores. En una Sede activa, un cambio de Costo actualiza solo el Inventario_Mensual del mes actual de la Sede y cuenta como su última modificación, con el Administrador que cambió el Costo y la fecha y hora del cambio. En una Sede inactiva, un cambio de Costo no modifica sus Inventarios_Mensuales. Cuando el Administrador reactiva una Sede (de inactiva a activa), las Líneas_de_Inventario del Inventario_Mensual del mes actual de la Sede, si existe, toman el Costo vigente de cada Producto_de_Sede, incluidos los Costos cambiados mientras la Sede estaba inactiva; las Líneas_de_Inventario cuyo Producto_de_Sede no tiene Costo quedan sin Costo y los Inventarios_Mensuales de meses anteriores no cambian. Esa actualización cuenta como la última modificación del Inventario_Mensual del mes actual, con el Administrador que reactivó la Sede y la fecha y hora de la reactivación. Al consultar una Sede inactiva en un mes sin Inventario_Mensual, el Panel_Admin muestra la marca "Sin inventario" en modo de solo consulta, sin acciones para registrarlo. El Inventario_Mensual no se compara con el mes anterior ni con las unidades vendidas. (Confirmado por el usuario)
11. Los Gastos los registra el Cajero durante el Turno y corresponden a salidas de efectivo de la caja. Un Gasto no puede superar el Efectivo_Esperado. El Cajero puede anular Gastos mientras el Turno está abierto y el Gasto anulado se conserva con la marca de anulado. (Confirmado por el usuario)
12. La impresión del Ticket y del Reporte_de_Turno se realiza desde el navegador con Formato_80mm. El Reporte_de_Turno incluye las unidades vendidas por Producto y espacios para las firmas del Cajero y del Encargado. (Confirmado por el usuario)
13. Los Diseños_Stitch se ubican en la carpeta docs/diseno/ del proyecto: el archivo paleta.md con la Paleta_de_Colores y, por cada pantalla, un archivo .html y opcionalmente un archivo .md (por ejemplo: login.html, caja.html, cierre-turno.html, admin-ventas.html). Los Diseños_Stitch son una guía de la Paleta_de_Colores y del estilo general, no una especificación estricta: cada pantalla puede simplificarse o cambiarse para mejorar la facilidad de uso. (Confirmado por el usuario)
14. La Plataforma_POS es minimalista: cada pantalla muestra solo lo necesario para la tarea, porque entre menos elementos tenga y más funcional sea, mejor para los empleados. (Confirmado por el usuario)
15. El Inventario_Mensual no tiene acción Guardar: cada cambio se guarda automáticamente y el Inventario_Mensual de un mes queda registrado con el primer cambio que el Administrador hace sobre la Propuesta_de_Inventario; abrir o consultar el mes no lo registra. Mientras una Sede activa no tiene Inventario_Mensual registrado en el mes escogido, el Panel_Admin muestra la Propuesta_de_Inventario con la marca "Sin inventario", el total en $ 0 y sin última modificación. Quitar una Línea_de_Inventario pide confirmación. Cada Línea_de_Inventario guarda una copia del nombre del Producto al crearse; cuando cambia el nombre del Producto, la copia se actualiza solo en los Inventarios_Mensuales del mes actual de las Sedes activas, y los meses anteriores y los Inventarios_Mensuales de las Sedes inactivas conservan el nombre guardado. El detalle por Producto de Todas_las_Sedes muestra y ordena los Productos por su nombre vigente en el Catálogo. Guardar una cantidad contada o un Costo igual al anterior cuenta como última modificación, y la reactivación de una Sede cuenta como última modificación del Inventario_Mensual del mes actual aunque ningún nombre ni Costo cambie. (Confirmado por el usuario)
16. El Costo de la sección Precios también se guarda automáticamente al salir del campo o confirmar el valor, sin acción Guardar. Para la cantidad contada del Inventario_Mensual y para el Costo: entrar y salir de un campo sin escribir no cuenta como cambio (no registra el mes, no guarda y no actualiza la última modificación); si el guardado automático falla, por ejemplo por falta de conexión, el Panel_Admin muestra un aviso con la acción Reintentar y conserva el valor escrito; si el valor es inválido, el campo se señala en rojo con un ícono de error y vuelve al valor anterior. (Confirmado por el usuario)
17. En el Selector_de_Sede, y por lo tanto en el resumen por Sede del Inventario_Mensual, las Sedes activas van primero y las Sedes inactivas al final, y dentro de cada grupo las Sedes se ordenan alfabéticamente por nombre. (Confirmado por el usuario)
18. En la sección Precios, el Precio_de_Venta y el interruptor de habilitación también se guardan automáticamente, sin acción Guardar, igual que el Costo: el Precio_de_Venta se guarda al salir del campo o confirmar el valor, y el interruptor se guarda al tocarlo. Al Precio_de_Venta le aplican las mismas reglas del Costo: entrar y salir del campo sin escribir no cuenta como cambio; si el guardado automático falla, por ejemplo por falta de conexión, el Panel_Admin muestra un aviso con la acción Reintentar y conserva el valor escrito; si el valor es inválido, el campo se señala en rojo con un ícono de error y vuelve al valor anterior. Si falla el guardado automático del interruptor, el Panel_Admin muestra un aviso con la acción Reintentar y conserva el interruptor en el estado tocado por el Administrador. (Confirmado por el usuario)
19. El cambio de nombre de un Producto funciona en el Inventario_Mensual igual que el cambio de Costo: la actualización del nombre en el Inventario_Mensual del mes actual de cada Sede activa cuenta como última modificación de ese Inventario_Mensual, con el Administrador que cambió el nombre y la fecha y hora del cambio. Cuando el Administrador reactiva una Sede, las Líneas_de_Inventario del Inventario_Mensual del mes actual de la Sede, si existe, toman el nombre vigente de cada Producto en el Catálogo, incluidos los nombres cambiados mientras la Sede estaba inactiva; los Inventarios_Mensuales de meses anteriores conservan el nombre guardado. Esa actualización forma parte de la última modificación que registra la reactivación. (Confirmado por el usuario)
20. El aviso de guardado automático fallido incluye la acción Reintentar, que funciona igual para el Precio_de_Venta, el Costo, la cantidad contada y el interruptor de habilitación: al tocar Reintentar, la Plataforma_POS vuelve a enviar el valor o el estado pendiente. (Confirmado por el usuario)
21. Editar un Producto sin cambiar su nombre (por ejemplo, solo la imagen o la Categoría) no cuenta como última modificación de los Inventarios_Mensuales del mes actual; solo un cambio real del nombre cuenta como última modificación. (Confirmado por el usuario)
22. El Precio_de_Venta y el Precio_de_Referencia tienen el mismo máximo del Costo: los valores mayores que $ 999.999.999 se rechazan. (Confirmado por el usuario)

### Fuera de alcance (v1)

Lista confirmada por el usuario.

- Modo sin conexión (offline).
- Materias primas, recetas y control de producción.
- Facturación electrónica (DIAN).
- Descuentos y promociones.
- Envío digital de reportes (correo electrónico, WhatsApp).
- Pagos combinados (más de un Método_de_Pago en una misma Venta).
- Anulación de Ventas y devoluciones.
- Venta por peso o en cantidades fraccionadas.
- Integración con datáfonos, Nequi, Daviplata u otras pasarelas de pago.
- Roles personalizados y Rol de Encargado.
- Exportación de reportes a archivos (Excel, PDF).

## Glossary

- **Plataforma_POS**: Sistema objeto de esta especificación. Aplicación web responsiva que contiene el Entorno_Cajero y el Panel_Admin, con la información centralizada en la Base_de_Datos.
- **Entorno_Cajero**: Ambiente de la Plataforma_POS para el Cajero: apertura y cierre de Turno, registro de Ventas y Gastos, e impresión de Tickets y Reportes_de_Turno.
- **Panel_Admin**: Ambiente de la Plataforma_POS para el Administrador: gestión de Sedes, Catálogos, Precios_de_Venta, Costos y Usuarios, registro de los Inventarios_Mensuales y consulta de reportes.
- **Base_de_Datos**: Base de datos única en Supabase (PostgreSQL) que unifica la información de todas las Sedes.
- **Política_de_Acceso**: Regla de seguridad aplicada por la Base_de_Datos que define qué registros, y qué datos de cada registro, puede leer o modificar cada Usuario.
- **Sede**: Punto de venta físico de la empresa, con nombre, Tipo_de_Sede, dirección opcional, teléfono opcional y estado (activa o inactiva).
- **Tipo_de_Sede**: Clasificación de una Sede: Panadería o Asadero.
- **Usuario**: Persona registrada en la Plataforma_POS con nombre completo, Nombre_de_Usuario, contraseña, Rol y estado (activo o inactivo).
- **Nombre_de_Usuario**: Identificador único con el que un Usuario inicia sesión.
- **Rol**: Perfil de permisos de un Usuario. Los valores posibles son Cajero y Administrador.
- **Cajero**: Usuario con Rol Cajero, asignado a exactamente una Sede, que registra Ventas y Gastos durante el Turno.
- **Administrador**: Usuario con Rol Administrador, con acceso a la información de todas las Sedes desde el Panel_Admin.
- **Encargado**: Persona que recibe el Reporte_de_Turno impreso. No es un Rol de la Plataforma_POS.
- **Catálogo**: Conjunto de Productos asociado a un Tipo_de_Sede. Existen dos Catálogos: Panadería y Asadero.
- **Categoría**: Agrupación opcional de Productos dentro de un Catálogo (por ejemplo: panes, bebidas, pollos) usada para filtrar la Cuadrícula_de_Productos.
- **Producto**: Artículo terminado que pertenece a un Catálogo y se vende por unidades enteras. Tiene nombre, Categoría opcional, Precio_de_Referencia, imagen opcional y estado (activo o inactivo).
- **Precio_de_Referencia**: Valor unitario de un Producto en el Catálogo, usado como Precio_de_Venta inicial cuando el Producto se agrega a una Sede.
- **Producto_de_Sede**: Relación entre un Producto y una Sede del mismo Tipo_de_Sede que indica si el Producto está habilitado en esa Sede, su Precio_de_Venta y su Costo.
- **Precio_de_Venta**: Valor unitario, en pesos colombianos, con el que se vende un Producto en una Sede específica.
- **Costo**: Valor unitario, en pesos colombianos y en número entero mayor que cero, que el Administrador asigna a un Producto en una Sede específica para valorizar el Inventario_Mensual. Se guarda en el Producto_de_Sede y permanece vacío (sin Costo) hasta que el Administrador lo define.
- **Producto_Vendible**: Producto activo cuyo Producto_de_Sede está habilitado en la Sede del Cajero.
- **Cuadrícula_de_Productos**: Pantalla principal de venta del Entorno_Cajero que muestra los Productos_Vendibles como tarjetas táctiles junto al Carrito.
- **Carrito**: Conjunto de Líneas_de_Venta de la venta en curso, antes del cobro.
- **Línea_de_Venta**: Elemento del Carrito o de una Venta compuesto por un Producto, una cantidad entera mayor que cero, el Precio_de_Venta unitario y el subtotal (cantidad × Precio_de_Venta).
- **Total**: Suma de los subtotales de las Líneas_de_Venta de un Carrito o de una Venta.
- **Venta**: Transacción registrada al confirmar el cobro de un Carrito. Pertenece a un Turno, a una Sede y a un Cajero, y tiene Número_de_Venta, fecha y hora, Líneas_de_Venta, Total y Método_de_Pago.
- **Número_de_Venta**: Número consecutivo y único de una Venta dentro de la Sede.
- **Método_de_Pago**: Forma de pago de una Venta: Efectivo, Transferencia (transferencia bancaria, Nequi, Daviplata o pago con código QR) o Tarjeta (datáfono).
- **Monto_Recibido**: Efectivo entregado por el cliente en una Venta pagada en Efectivo.
- **Cambio**: Valor devuelto al cliente, igual al Monto_Recibido menos el Total.
- **Ticket**: Comprobante impreso de una Venta que se entrega al cliente.
- **Turno**: Periodo de trabajo de un Cajero en la Sede asignada, entre la apertura y el cierre de caja. Estados posibles: abierto o cerrado.
- **Base_de_Caja**: Monto en efectivo con el que el Cajero abre el Turno.
- **Gasto**: Salida de efectivo de la caja durante un Turno, con monto, descripción y estado (vigente o anulado).
- **Efectivo_Esperado**: Base_de_Caja más la suma de los Totales de las Ventas en Efectivo del Turno, menos la suma de los Gastos vigentes del Turno.
- **Efectivo_Contado**: Monto en efectivo que el Cajero cuenta físicamente en la caja al cerrar el Turno.
- **Arqueo_Ciego**: Procedimiento de cierre en el que el Cajero registra el Efectivo_Contado sin ver el Efectivo_Esperado.
- **Diferencia**: Efectivo_Contado menos Efectivo_Esperado.
- **Sobrante**: Diferencia mayor que cero.
- **Faltante**: Diferencia menor que cero.
- **Caja_Cuadrada**: Diferencia igual a cero.
- **Reporte_de_Turno**: Documento impreso al cierre de un Turno con el resumen de Ventas, Gastos, Efectivo_Esperado, Efectivo_Contado y Diferencia, que se entrega al Encargado.
- **Inventario_Mensual**: Conteo físico de los Productos de una Sede correspondiente a un mes calendario en la Zona_Horaria_Operativa, registrado por el Administrador solo para llevar cuentas. Está compuesto por Líneas_de_Inventario, guarda el Administrador y la fecha y hora de la última modificación, y su total es la suma de los valores de las Líneas_de_Inventario que tienen Costo.
- **Línea_de_Inventario**: Elemento de un Inventario_Mensual compuesto por un Producto, una copia del nombre del Producto, guardada al crear la Línea_de_Inventario y actualizada en el Mes_Actual de las Sedes activas cuando cambia el nombre del Producto y en el Mes_Actual de una Sede cuando la Sede se reactiva, la cantidad contada (número entero mayor o igual a cero de unidades encontradas físicamente en la Sede), una copia del Costo, que queda vacía (sin Costo) cuando el Producto_de_Sede no tiene Costo, y el valor de la línea (cantidad contada × Costo).
- **Propuesta_de_Inventario**: Conjunto de Líneas_de_Inventario que el Panel_Admin presenta al abrir, para una Sede activa, un mes sin Inventario_Mensual registrado: una Línea_de_Inventario por cada Producto activo del Catálogo cuyo Producto_de_Sede está habilitado en la Sede. Se convierte en el Inventario_Mensual registrado de la Sede y del mes con el primer cambio del Administrador (ingresar una cantidad contada, agregar un Producto o quitar una Línea_de_Inventario).
- **Aviso_Sin_Costo**: Indicador visual, con un ícono y un color, que señala que un total o un valor del Inventario_Mensual incluye Líneas_de_Inventario sin Costo.
- **Selector_de_Sede**: Control del Panel_Admin para escoger una Sede específica o la opción Todas_las_Sedes.
- **Todas_las_Sedes**: Opción del Selector_de_Sede que presenta la información consolidada de todas las Sedes.
- **Rango_de_Fechas**: Fecha inicial y fecha final, ambas incluidas, usadas para filtrar reportes en la Zona_Horaria_Operativa.
- **Zona_Horaria_Operativa**: Zona horaria America/Bogota (UTC−5), usada para fechas, horas y cortes diarios.
- **Mes_Actual**: Mes calendario en curso en la Zona_Horaria_Operativa en el momento de la operación.
- **Formato_80mm**: Diseño de impresión para impresoras térmicas de rollo de 80 mm de ancho, sin elementos de navegación de la interfaz.
- **Diseños_Stitch**: Archivos exportados por el usuario desde Stitch a la carpeta docs/diseno/ del proyecto: paleta.md con la Paleta_de_Colores y, por cada pantalla, un archivo .html y opcionalmente un archivo .md. Son una guía de colores y de estilo general, no una especificación estricta.
- **Paleta_de_Colores**: Conjunto de colores definido en el archivo docs/diseno/paleta.md de los Diseños_Stitch.
- **Objetivo_Táctil**: Elemento interactivo (botón, tarjeta o control) que el Usuario toca o hace clic en la pantalla.

## Requirements

### Requisito 1: Inicio y cierre de sesión

**Historia de Usuario:** Como Usuario, quiero iniciar sesión con mi Nombre_de_Usuario y mi contraseña, para acceder al ambiente que corresponde a mi Rol.

#### Criterios de Aceptación

1. CUANDO un Usuario activo ingresa un Nombre_de_Usuario y una contraseña correctos, LA Plataforma_POS DEBERÁ iniciar la sesión del Usuario.
2. SI el Nombre_de_Usuario o la contraseña son incorrectos, ENTONCES LA Plataforma_POS DEBERÁ rechazar el inicio de sesión y mostrar un mensaje de credenciales inválidas sin indicar cuál de los dos datos es incorrecto.
3. SI un Usuario inactivo ingresa credenciales correctas, ENTONCES LA Plataforma_POS DEBERÁ rechazar el inicio de sesión y mostrar un mensaje de usuario inactivo.
4. MIENTRAS la sesión de un Usuario está iniciada, LA Plataforma_POS DEBERÁ conservar la sesión al recargar la página.
5. CUANDO un Usuario toca la acción Salir, LA Plataforma_POS DEBERÁ cerrar la sesión del Usuario y mostrar la pantalla de inicio de sesión.
6. CUANDO un Cajero con un Turno abierto toca la acción Salir, EL Entorno_Cajero DEBERÁ mostrar un aviso indicando que el Turno permanece abierto antes de cerrar la sesión.
7. SI un Usuario desactivado por un Administrador tiene una sesión iniciada, ENTONCES LA Plataforma_POS DEBERÁ rechazar la siguiente operación del Usuario y mostrar la pantalla de inicio de sesión.

### Requisito 2: Acceso según el Rol

**Historia de Usuario:** Como Usuario, quiero entrar directamente al ambiente de mi Rol, para empezar a trabajar sin pasos adicionales.

#### Criterios de Aceptación

1. CUANDO un Cajero sin Turno abierto inicia sesión, EL Entorno_Cajero DEBERÁ mostrar la pantalla de apertura de Turno de la Sede asignada al Cajero, sin solicitar la selección de una Sede.
2. CUANDO un Cajero con un Turno abierto inicia sesión, EL Entorno_Cajero DEBERÁ mostrar la Cuadrícula_de_Productos del Turno abierto.
3. CUANDO un Administrador inicia sesión, EL Panel_Admin DEBERÁ mostrar el Selector_de_Sede como primera pantalla.
4. SI un Cajero intenta acceder a una pantalla del Panel_Admin, ENTONCES LA Plataforma_POS DEBERÁ denegar el acceso y mostrar el Entorno_Cajero.
5. SI un Administrador intenta acceder a una pantalla del Entorno_Cajero, ENTONCES LA Plataforma_POS DEBERÁ mostrar el Panel_Admin.
6. SI un Cajero asignado a una Sede inactiva inicia sesión, ENTONCES LA Plataforma_POS DEBERÁ rechazar el acceso y mostrar un mensaje de Sede inactiva.
7. EL Entorno_Cajero DEBERÁ mostrar en el encabezado de cada pantalla el nombre de la Sede asignada y el nombre del Cajero.

### Requisito 3: Gestión de Sedes

**Historia de Usuario:** Como Administrador, quiero crear y editar Sedes de tipo Panadería o Asadero, para organizar la operación de cada punto de venta.

#### Criterios de Aceptación

1. CUANDO un Administrador crea una Sede con nombre y Tipo_de_Sede, EL Panel_Admin DEBERÁ registrar la Sede en estado activa.
2. SI un Administrador intenta guardar una Sede sin nombre o sin Tipo_de_Sede, ENTONCES EL Panel_Admin DEBERÁ rechazar la operación y señalar los campos faltantes.
3. SI un Administrador intenta guardar una Sede con un nombre ya usado por otra Sede, sin distinguir mayúsculas de minúsculas, ENTONCES EL Panel_Admin DEBERÁ rechazar la operación y señalar el campo de nombre.
4. CUANDO un Administrador edita el nombre, la dirección o el teléfono de una Sede, EL Panel_Admin DEBERÁ guardar los cambios y aplicar los nuevos datos en los Tickets impresos a partir de ese momento.
5. EL Panel_Admin DEBERÁ presentar el Tipo_de_Sede como dato no editable después de la creación de la Sede.
6. CUANDO un Administrador cambia el estado de una Sede entre activa e inactiva, EL Panel_Admin DEBERÁ guardar el nuevo estado de la Sede.
7. SI un Administrador intenta desactivar una Sede con un Turno abierto, ENTONCES EL Panel_Admin DEBERÁ rechazar la desactivación e indicar el Cajero del Turno abierto.
8. LA Plataforma_POS DEBERÁ conservar las Ventas, Turnos, Gastos e Inventarios_Mensuales de las Sedes inactivas y presentar esa información en el Panel_Admin.
9. EL Panel_Admin DEBERÁ listar las Sedes con nombre, ícono del Tipo_de_Sede y estado.

### Requisito 4: Catálogo de Productos por Tipo de Sede

**Historia de Usuario:** Como Administrador, quiero mantener un Catálogo de Productos para Panadería y otro para Asadero, para no repetir los mismos Productos en cada Sede.

#### Criterios de Aceptación

1. LA Plataforma_POS DEBERÁ mantener un Catálogo para cada Tipo_de_Sede: Panadería y Asadero.
2. EL Panel_Admin DEBERÁ presentar la sección Catálogo con una pestaña por cada Tipo_de_Sede.
3. CUANDO un Administrador crea un Producto con nombre y Precio_de_Referencia en un Catálogo, EL Panel_Admin DEBERÁ registrar el Producto en estado activo dentro de ese Catálogo.
4. SI un Administrador intenta guardar un Producto sin nombre, o con un Precio_de_Referencia que no es un número entero mayor que cero o que es mayor que $ 999.999.999, ENTONCES EL Panel_Admin DEBERÁ rechazar la operación y señalar los campos inválidos.
5. SI un Administrador intenta guardar un Producto con un nombre ya existente en el mismo Catálogo, sin distinguir mayúsculas de minúsculas, ENTONCES EL Panel_Admin DEBERÁ rechazar la operación y señalar el campo de nombre.
6. DONDE un Administrador asigna una imagen a un Producto, EL Panel_Admin DEBERÁ guardar la imagen asociada al Producto.
7. SI la imagen de un Producto no está en formato JPG, PNG o WebP, o supera 2 MB, ENTONCES EL Panel_Admin DEBERÁ rechazar la imagen e indicar los formatos y el tamaño permitidos.
8. CUANDO un Administrador crea una Categoría con un nombre en un Catálogo, EL Panel_Admin DEBERÁ registrar la Categoría en ese Catálogo.
9. SI un Administrador intenta eliminar una Categoría con Productos asociados, ENTONCES EL Panel_Admin DEBERÁ rechazar la eliminación e indicar la cantidad de Productos asociados.
10. CUANDO un Administrador edita el nombre, la Categoría o la imagen de un Producto, LA Plataforma_POS DEBERÁ aplicar los cambios en la Cuadrícula_de_Productos de todas las Sedes del Tipo_de_Sede correspondiente.
11. CUANDO un Administrador desactiva un Producto, LA Plataforma_POS DEBERÁ retirar el Producto de la Cuadrícula_de_Productos de todas las Sedes.
12. SI un Administrador intenta eliminar un Producto incluido en Ventas o en Inventarios_Mensuales registrados, ENTONCES EL Panel_Admin DEBERÁ rechazar la eliminación y ofrecer la desactivación del Producto.

### Requisito 5: Productos, Precios y Costos por Sede

**Historia de Usuario:** Como Administrador, quiero definir qué Productos vende cada Sede, a qué Precio_de_Venta y con qué Costo, para manejar las diferencias de precio y de costo entre Sedes del mismo tipo.

#### Criterios de Aceptación

1. CUANDO un Administrador crea una Sede, LA Plataforma_POS DEBERÁ habilitar en la Sede todos los Productos activos del Catálogo del Tipo_de_Sede, con el Precio_de_Referencia como Precio_de_Venta inicial y sin Costo.
2. CUANDO un Administrador crea un Producto en un Catálogo, LA Plataforma_POS DEBERÁ habilitar el Producto en todas las Sedes del Tipo_de_Sede correspondiente, con el Precio_de_Referencia como Precio_de_Venta inicial y sin Costo.
3. LA Plataforma_POS DEBERÁ limitar los Productos_de_Sede de cada Sede a Productos del Catálogo del Tipo_de_Sede de esa Sede.
4. MIENTRAS el Selector_de_Sede tiene una Sede específica seleccionada, EL Panel_Admin DEBERÁ mostrar en la sección Precios los Productos del Catálogo de esa Sede con un interruptor de habilitación, el Precio_de_Venta editable y el Costo editable.
5. CUANDO un Administrador modifica el Precio_de_Venta de un Producto en una Sede, LA Plataforma_POS DEBERÁ aplicar el nuevo Precio_de_Venta únicamente en esa Sede y en las Ventas registradas a partir de ese momento.
6. SI un Administrador escribe en el campo de Precio_de_Venta y el valor resultante está vacío, es igual a cero, es negativo, no es un número entero o es mayor que $ 999.999.999, ENTONCES EL Panel_Admin DEBERÁ rechazar el valor sin registrar el valor vacío como cero, conservar el Precio_de_Venta anterior, volver a mostrar el valor anterior en el campo y señalar el campo en color rojo con un ícono de error.
7. CUANDO un Administrador modifica el Precio_de_Referencia de un Producto, LA Plataforma_POS DEBERÁ conservar sin cambios los Precios_de_Venta definidos en las Sedes.
8. CUANDO un Administrador modifica el Precio_de_Referencia de un Producto y elige la opción aplicar a todas las Sedes, LA Plataforma_POS DEBERÁ asignar el nuevo valor como Precio_de_Venta del Producto en todas las Sedes del Tipo_de_Sede correspondiente.
9. CUANDO un Administrador modifica el Costo de un Producto en una Sede, LA Plataforma_POS DEBERÁ guardar el nuevo Costo en el Producto_de_Sede de esa Sede sin cambiar el Costo del Producto en las demás Sedes.
10. SI un Administrador escribe en el campo de Costo y el valor resultante está vacío, es igual a cero, es negativo, no es un número entero o es mayor que $ 999.999.999, ENTONCES EL Panel_Admin DEBERÁ rechazar el valor sin registrar el valor vacío como cero, conservar el Costo anterior, volver a mostrar el valor anterior en el campo y señalar el campo en color rojo con un ícono de error.
11. CUANDO un Administrador deshabilita un Producto en una Sede, LA Plataforma_POS DEBERÁ retirar el Producto de la Cuadrícula_de_Productos de esa Sede.
12. CUANDO un Administrador habilita nuevamente un Producto en una Sede, LA Plataforma_POS DEBERÁ incluir el Producto en la Cuadrícula_de_Productos de esa Sede con el Precio_de_Venta vigente.
13. CUANDO cambia el Precio_de_Venta o la habilitación de un Producto en una Sede, EL Entorno_Cajero de esa Sede DEBERÁ reflejar el cambio en un máximo de 60 segundos sin que el Cajero recargue la página.
14. MIENTRAS el Selector_de_Sede tiene una Sede específica seleccionada, CUANDO un Administrador escribe el Precio_de_Venta de un Producto en la sección Precios y sale del campo o confirma el valor, LA Plataforma_POS DEBERÁ guardar el Precio_de_Venta en ese momento, sin una acción Guardar.
15. MIENTRAS el Selector_de_Sede tiene una Sede específica seleccionada, CUANDO un Administrador toca el interruptor de habilitación de un Producto en la sección Precios, LA Plataforma_POS DEBERÁ guardar en ese momento la nueva habilitación del Producto_de_Sede, sin una acción Guardar.
16. CUANDO un Administrador entra y sale del campo de Precio_de_Venta de un Producto en la sección Precios sin escribir en el campo, LA Plataforma_POS DEBERÁ conservar sin cambios el Precio_de_Venta del Producto_de_Sede.
17. SI falla el guardado automático o el reintento de guardado de un Precio_de_Venta, por ejemplo por falta de conexión con la Base_de_Datos, ENTONCES EL Panel_Admin DEBERÁ conservar en el campo el Precio_de_Venta escrito y mostrar un aviso de que el valor no se guardó con la acción Reintentar.
18. SI falla el guardado automático o el reintento de guardado del interruptor de habilitación de un Producto, por ejemplo por falta de conexión con la Base_de_Datos, ENTONCES EL Panel_Admin DEBERÁ conservar el interruptor en el estado tocado por el Administrador y mostrar un aviso de que el cambio no se guardó con la acción Reintentar.
19. CUANDO un Administrador toca la acción Reintentar del aviso de un Precio_de_Venta no guardado, LA Plataforma_POS DEBERÁ volver a enviar el Precio_de_Venta conservado en el campo y guardarlo con el mismo efecto del guardado automático del Precio_de_Venta.
20. CUANDO un Administrador toca la acción Reintentar del aviso de un interruptor de habilitación no guardado, LA Plataforma_POS DEBERÁ volver a enviar el estado del interruptor tocado por el Administrador y guardarlo como la habilitación del Producto_de_Sede.
21. CUANDO LA Plataforma_POS completa el guardado de un Precio_de_Venta o de un interruptor de habilitación reenviado con la acción Reintentar, EL Panel_Admin DEBERÁ retirar el aviso de que el valor o el cambio no se guardó.

### Requisito 6: Gestión de Usuarios

**Historia de Usuario:** Como Administrador, quiero crear Usuarios, asignarles un Rol y, a cada Cajero, una Sede, para que cada Cajero que inicia sesión venda solo en la Sede asignada.

#### Criterios de Aceptación

1. LA Plataforma_POS DEBERÁ limitar la creación de Usuarios a los Administradores desde el Panel_Admin.
2. CUANDO un Administrador crea un Usuario con nombre completo, Nombre_de_Usuario, contraseña y Rol, EL Panel_Admin DEBERÁ registrar el Usuario en estado activo.
3. SI un Administrador intenta crear o editar un Cajero sin Sede asignada, ENTONCES EL Panel_Admin DEBERÁ rechazar la operación y señalar el campo de Sede.
4. EL Panel_Admin DEBERÁ ofrecer únicamente Sedes activas al asignar la Sede de un Cajero.
5. CUANDO un Administrador asigna el Rol Administrador a un Usuario, LA Plataforma_POS DEBERÁ registrar el Usuario sin Sede asignada.
6. SI un Administrador ingresa un Nombre_de_Usuario ya existente, sin distinguir mayúsculas de minúsculas, ENTONCES EL Panel_Admin DEBERÁ rechazar la operación y señalar el campo de Nombre_de_Usuario.
7. SI un Administrador ingresa un Nombre_de_Usuario con menos de 3 o más de 30 caracteres, o con caracteres distintos de letras sin tilde, números, punto, guion o guion bajo, ENTONCES EL Panel_Admin DEBERÁ rechazar la operación e indicar el formato permitido.
8. SI un Administrador ingresa una contraseña de menos de 8 caracteres, ENTONCES EL Panel_Admin DEBERÁ rechazar la operación e indicar la longitud mínima.
9. CUANDO un Administrador restablece la contraseña de un Usuario, LA Plataforma_POS DEBERÁ reemplazar la contraseña anterior por la nueva contraseña ingresada por el Administrador.
10. SI un Administrador intenta cambiar la Sede, cambiar el Rol o desactivar a un Cajero con un Turno abierto, ENTONCES EL Panel_Admin DEBERÁ rechazar la operación e indicar que el Turno debe cerrarse primero.
11. SI un Administrador intenta desactivar o quitar el Rol Administrador al último Administrador activo, ENTONCES EL Panel_Admin DEBERÁ rechazar la operación.
12. CUANDO un Administrador desactiva un Usuario, LA Plataforma_POS DEBERÁ conservar los Turnos, Ventas y Gastos asociados al Usuario.
13. MIENTRAS el Selector_de_Sede tiene una Sede específica seleccionada, EL Panel_Admin DEBERÁ listar en la sección Usuarios los Cajeros asignados a esa Sede con nombre completo, Nombre_de_Usuario y estado.
14. MIENTRAS el Selector_de_Sede tiene seleccionada la opción Todas_las_Sedes, EL Panel_Admin DEBERÁ listar en la sección Usuarios todos los Usuarios con nombre completo, Nombre_de_Usuario, Rol, Sede asignada y estado.
15. LA Plataforma_POS DEBERÁ incluir un procedimiento documentado de configuración inicial que cree el primer Administrador.

### Requisito 7: Apertura de Turno

**Historia de Usuario:** Como Cajero, quiero abrir mi Turno registrando la Base_de_Caja, para empezar a vender con el efectivo inicial controlado.

#### Criterios de Aceptación

1. MIENTRAS un Cajero no tiene un Turno abierto, EL Entorno_Cajero DEBERÁ mostrar la pantalla de apertura de Turno en lugar de la Cuadrícula_de_Productos.
2. CUANDO un Cajero confirma la apertura con una Base_de_Caja que es un número entero mayor o igual a cero, LA Plataforma_POS DEBERÁ registrar un Turno abierto con el Cajero, la Sede asignada al Cajero, la Base_de_Caja y la fecha y hora de apertura.
3. SI la Base_de_Caja está vacía, es negativa o no es un número entero, ENTONCES EL Entorno_Cajero DEBERÁ rechazar la apertura y señalar el campo de Base_de_Caja.
4. SI un Cajero con un Turno abierto intenta abrir otro Turno, ENTONCES LA Plataforma_POS DEBERÁ rechazar la apertura y mostrar el Turno abierto existente.
5. CUANDO LA Plataforma_POS registra la apertura de un Turno, EL Entorno_Cajero DEBERÁ mostrar la Cuadrícula_de_Productos con el Carrito vacío.

### Requisito 8: Cuadrícula de Productos y Carrito

**Historia de Usuario:** Como Cajero, quiero tocar los Productos y ajustar las unidades en el Carrito, para armar la compra del cliente con pocos toques.

#### Criterios de Aceptación

1. MIENTRAS un Cajero tiene un Turno abierto, EL Entorno_Cajero DEBERÁ mostrar en la Cuadrícula_de_Productos los Productos_Vendibles de la Sede asignada al Cajero, ordenados alfabéticamente, con nombre, imagen y Precio_de_Venta.
2. DONDE un Producto no tiene imagen asignada, EL Entorno_Cajero DEBERÁ mostrar en la tarjeta del Producto un marcador visual con las iniciales del nombre del Producto.
3. DONDE existen Categorías con al menos un Producto_Vendible, EL Entorno_Cajero DEBERÁ mostrar como filtros la opción Todos y esas Categorías.
4. CUANDO un Cajero toca una Categoría, EL Entorno_Cajero DEBERÁ mostrar únicamente los Productos_Vendibles de esa Categoría.
5. CUANDO un Cajero escribe un texto en la búsqueda, EL Entorno_Cajero DEBERÁ mostrar los Productos_Vendibles cuyo nombre contiene el texto, sin distinguir mayúsculas, minúsculas ni tildes.
6. CUANDO un Cajero toca un Producto que no está en el Carrito, EL Entorno_Cajero DEBERÁ agregar al Carrito una Línea_de_Venta con cantidad 1 y el Precio_de_Venta vigente.
7. CUANDO un Cajero toca un Producto que ya está en el Carrito, EL Entorno_Cajero DEBERÁ aumentar en 1 la cantidad de la Línea_de_Venta del Producto.
8. CUANDO un Cajero toca el control de aumentar de una Línea_de_Venta, EL Entorno_Cajero DEBERÁ aumentar en 1 la cantidad de la Línea_de_Venta.
9. CUANDO un Cajero toca el control de disminuir de una Línea_de_Venta con cantidad mayor que 1, EL Entorno_Cajero DEBERÁ disminuir en 1 la cantidad de la Línea_de_Venta.
10. CUANDO un Cajero toca el control de disminuir de una Línea_de_Venta con cantidad 1, EL Entorno_Cajero DEBERÁ retirar la Línea_de_Venta del Carrito.
11. CUANDO un Cajero ingresa una cantidad con el teclado numérico en una Línea_de_Venta, EL Entorno_Cajero DEBERÁ reemplazar la cantidad de la Línea_de_Venta por el valor ingresado.
12. SI un Cajero ingresa una cantidad que no es un número entero entre 1 y 999, ENTONCES EL Entorno_Cajero DEBERÁ rechazar el valor y conservar la cantidad anterior.
13. CUANDO un Cajero toca la acción Quitar de una Línea_de_Venta, EL Entorno_Cajero DEBERÁ retirar la Línea_de_Venta del Carrito.
14. CUANDO un Cajero toca la acción Vaciar y confirma, EL Entorno_Cajero DEBERÁ retirar todas las Líneas_de_Venta del Carrito.
15. MIENTRAS la Cuadrícula_de_Productos está visible, EL Entorno_Cajero DEBERÁ mostrar el Carrito con el nombre, la cantidad, el Precio_de_Venta unitario y el subtotal de cada Línea_de_Venta, y el Total.
16. LA Plataforma_POS DEBERÁ calcular el subtotal de cada Línea_de_Venta como la cantidad multiplicada por el Precio_de_Venta, y el Total como la suma de los subtotales.
17. MIENTRAS el Carrito está vacío, EL Entorno_Cajero DEBERÁ deshabilitar la acción Cobrar.
18. MIENTRAS un Turno está abierto, EL Entorno_Cajero DEBERÁ conservar el Carrito al recargar la página.

### Requisito 9: Cobro

**Historia de Usuario:** Como Cajero, quiero cobrar con Efectivo, Transferencia o Tarjeta y ver el Cambio, para cerrar cada venta sin errores de cálculo.

#### Criterios de Aceptación

1. CUANDO un Cajero toca la acción Cobrar con un Carrito no vacío, EL Entorno_Cajero DEBERÁ mostrar el Total y los Métodos_de_Pago Efectivo, Transferencia y Tarjeta, cada uno con un ícono distintivo.
2. CUANDO un Cajero selecciona Efectivo, EL Entorno_Cajero DEBERÁ solicitar el Monto_Recibido con un teclado numérico, un acceso rápido de monto exacto y accesos rápidos de billetes de 2.000, 5.000, 10.000, 20.000, 50.000 y 100.000 pesos.
3. MIENTRAS el Método_de_Pago seleccionado es Efectivo, EL Entorno_Cajero DEBERÁ mostrar el Cambio calculado como el Monto_Recibido menos el Total.
4. SI el Monto_Recibido es menor que el Total, ENTONCES EL Entorno_Cajero DEBERÁ deshabilitar la confirmación del cobro y mostrar el valor pendiente.
5. CUANDO un Cajero selecciona Transferencia o Tarjeta, EL Entorno_Cajero DEBERÁ habilitar la confirmación del cobro por el valor del Total sin solicitar Monto_Recibido.
6. CUANDO un Cajero cancela la pantalla de cobro, EL Entorno_Cajero DEBERÁ mostrar la Cuadrícula_de_Productos con el Carrito sin cambios.
7. SI el Precio_de_Venta de un Producto del Carrito cambia antes de la confirmación del cobro, ENTONCES EL Entorno_Cajero DEBERÁ actualizar la Línea_de_Venta con el nuevo Precio_de_Venta y mostrar el Total actualizado antes de registrar la Venta.
8. SI un Producto del Carrito deja de ser Producto_Vendible antes de la confirmación del cobro, ENTONCES EL Entorno_Cajero DEBERÁ retirar la Línea_de_Venta del Carrito y mostrar un aviso con el nombre del Producto retirado.

### Requisito 10: Registro de la Venta

**Historia de Usuario:** Como Administrador, quiero que cada Venta quede registrada de forma completa y exacta, para confiar en los reportes.

#### Criterios de Aceptación

1. CUANDO un Cajero confirma el cobro, LA Plataforma_POS DEBERÁ registrar la Venta con Número_de_Venta, fecha y hora, Cajero, Sede, Turno, Líneas_de_Venta, Total y Método_de_Pago.
2. CUANDO un Cajero confirma el cobro de una Venta en Efectivo, LA Plataforma_POS DEBERÁ registrar en la Venta el Monto_Recibido y el Cambio.
3. LA Plataforma_POS DEBERÁ calcular el Total de cada Venta registrada con los Precios_de_Venta vigentes en la Base_de_Datos para la Sede del Cajero en el momento del cobro.
4. LA Plataforma_POS DEBERÁ conservar en cada Línea_de_Venta registrada el nombre del Producto y el Precio_de_Venta vigentes en el momento del cobro.
5. LA Plataforma_POS DEBERÁ asignar a cada Venta un Número_de_Venta consecutivo y único dentro de la Sede.
6. LA Plataforma_POS DEBERÁ registrar la Venta y sus Líneas_de_Venta como una única operación que se completa en su totalidad o no se registra.
7. SI un Cajero sin Turno abierto intenta registrar una Venta, ENTONCES LA Plataforma_POS DEBERÁ rechazar la Venta.
8. CUANDO un Cajero confirma el cobro, LA Plataforma_POS DEBERÁ registrar la Venta y mostrar la confirmación en un máximo de 2 segundos con una latencia de red de hasta 150 ms.
9. CUANDO LA Plataforma_POS registra una Venta, EL Entorno_Cajero DEBERÁ vaciar el Carrito y mostrar una confirmación visual de la Venta.
10. CUANDO LA Plataforma_POS registra una Venta en Efectivo, EL Entorno_Cajero DEBERÁ mostrar el Cambio a entregar en la confirmación visual.
11. SI la conexión con la Base_de_Datos falla durante la confirmación del cobro, ENTONCES EL Entorno_Cajero DEBERÁ conservar el Carrito, mostrar un aviso de error de conexión y ofrecer reintentar el cobro.
12. SI una misma confirmación de cobro llega más de una vez a la Plataforma_POS, ENTONCES LA Plataforma_POS DEBERÁ registrar una sola Venta.
13. MIENTRAS no hay conexión con la Base_de_Datos, EL Entorno_Cajero DEBERÁ mostrar un indicador de sin conexión y deshabilitar la acción Cobrar.

### Requisito 11: Ticket de Venta

**Historia de Usuario:** Como Cajero, quiero imprimir un Ticket por cada Venta, para entregarle al cliente el comprobante de la compra.

#### Criterios de Aceptación

1. CUANDO LA Plataforma_POS registra una Venta, EL Entorno_Cajero DEBERÁ enviar el Ticket de la Venta a impresión en Formato_80mm.
2. EL Entorno_Cajero DEBERÁ incluir en cada Ticket el nombre de la Sede, el Número_de_Venta, la fecha y hora, el nombre del Cajero, las Líneas_de_Venta con nombre, cantidad, Precio_de_Venta unitario y subtotal, el Total y el Método_de_Pago.
3. DONDE la Sede tiene dirección o teléfono registrados, EL Entorno_Cajero DEBERÁ incluir la dirección y el teléfono de la Sede en el encabezado del Ticket.
4. CUANDO EL Entorno_Cajero imprime el Ticket de una Venta en Efectivo, EL Entorno_Cajero DEBERÁ incluir en el Ticket el Monto_Recibido y el Cambio.
5. LA Plataforma_POS DEBERÁ conservar la Venta registrada sin importar el resultado de la impresión del Ticket.
6. MIENTRAS un Turno está abierto, EL Entorno_Cajero DEBERÁ mostrar la lista de Ventas del Turno con Número_de_Venta, hora, Total y Método_de_Pago.
7. CUANDO un Cajero toca la acción Reimprimir en una Venta del Turno abierto, EL Entorno_Cajero DEBERÁ imprimir nuevamente el Ticket de la Venta con la marca COPIA.

### Requisito 12: Gastos del Turno

**Historia de Usuario:** Como Cajero, quiero registrar los Gastos pagados con el efectivo de la caja, para que el cierre del Turno refleje las salidas de dinero.

#### Criterios de Aceptación

1. CUANDO un Cajero con un Turno abierto registra un Gasto con monto y descripción, LA Plataforma_POS DEBERÁ guardar el Gasto en estado vigente, asociado al Turno, con la fecha y hora de registro.
2. SI el monto del Gasto no es un número entero mayor que cero o la descripción está vacía, ENTONCES EL Entorno_Cajero DEBERÁ rechazar el Gasto y señalar los campos inválidos.
3. SI el monto del Gasto supera el Efectivo_Esperado del Turno en el momento del registro, ENTONCES LA Plataforma_POS DEBERÁ rechazar el Gasto e indicar que el monto supera el efectivo disponible en caja, sin mostrar el valor del Efectivo_Esperado.
4. MIENTRAS un Turno está abierto, EL Entorno_Cajero DEBERÁ mostrar la lista de Gastos vigentes del Turno con hora, descripción y monto.
5. CUANDO un Cajero anula un Gasto del Turno abierto y confirma la anulación, LA Plataforma_POS DEBERÁ cambiar el estado del Gasto a anulado y excluir el Gasto anulado del Efectivo_Esperado y de los totales de Gastos.
6. SI un Cajero intenta registrar, modificar o anular un Gasto de un Turno cerrado, ENTONCES LA Plataforma_POS DEBERÁ rechazar la operación.

### Requisito 13: Cierre de Turno con Arqueo Ciego

**Historia de Usuario:** Como Cajero, quiero cerrar mi Turno contando el efectivo de la caja, para conocer el Sobrante o el Faltante y entregar el reporte al Encargado.

#### Criterios de Aceptación

1. SI el Carrito tiene Líneas_de_Venta cuando el Cajero toca la acción Cerrar turno, ENTONCES EL Entorno_Cajero DEBERÁ mostrar un aviso de Carrito pendiente y detener el cierre hasta que el Carrito esté vacío.
2. CUANDO un Cajero con el Carrito vacío toca la acción Cerrar turno, EL Entorno_Cajero DEBERÁ solicitar el Efectivo_Contado sin mostrar el Efectivo_Esperado.
3. SI el Efectivo_Contado está vacío, es negativo o no es un número entero, ENTONCES EL Entorno_Cajero DEBERÁ rechazar el valor y señalar el campo de Efectivo_Contado.
4. CUANDO un Cajero ingresa el Efectivo_Contado, EL Entorno_Cajero DEBERÁ solicitar una confirmación que muestre únicamente el Efectivo_Contado ingresado.
5. CUANDO un Cajero confirma el Efectivo_Contado, LA Plataforma_POS DEBERÁ cerrar el Turno y registrar la fecha y hora de cierre, el Efectivo_Contado, el Efectivo_Esperado y la Diferencia.
6. LA Plataforma_POS DEBERÁ calcular el Efectivo_Esperado como la Base_de_Caja más la suma de los Totales de las Ventas en Efectivo del Turno, menos la suma de los Gastos vigentes del Turno.
7. LA Plataforma_POS DEBERÁ calcular la Diferencia como el Efectivo_Contado menos el Efectivo_Esperado.
8. CUANDO LA Plataforma_POS cierra un Turno, EL Entorno_Cajero DEBERÁ mostrar el Efectivo_Esperado, el Efectivo_Contado y la Diferencia, identificando la Diferencia como Sobrante, Faltante o Caja_Cuadrada con un color y un ícono distintivos.
9. CUANDO LA Plataforma_POS cierra un Turno, EL Entorno_Cajero DEBERÁ enviar el Reporte_de_Turno a impresión en Formato_80mm.
10. SI la conexión con la Base_de_Datos falla durante la confirmación del cierre, ENTONCES EL Entorno_Cajero DEBERÁ conservar el Efectivo_Contado ingresado, mostrar un aviso de error de conexión y ofrecer reintentar el cierre.
11. SI un Usuario intenta modificar un Turno cerrado, ENTONCES LA Plataforma_POS DEBERÁ rechazar la operación.
12. CUANDO un Cajero toca la acción Finalizar en la pantalla de resultado del cierre, LA Plataforma_POS DEBERÁ cerrar la sesión del Cajero y mostrar la pantalla de inicio de sesión para el siguiente Cajero.

### Requisito 14: Reporte de Turno

**Historia de Usuario:** Como Cajero, quiero imprimir el Reporte_de_Turno al cerrar, para entregárselo al Encargado en cada cambio de turno.

#### Criterios de Aceptación

1. LA Plataforma_POS DEBERÁ incluir en el Reporte_de_Turno la Sede, el nombre del Cajero, la fecha y hora de apertura y de cierre, la Base_de_Caja, la cantidad de Ventas y el Total de Ventas del Turno.
2. LA Plataforma_POS DEBERÁ incluir en el Reporte_de_Turno el total vendido por cada Método_de_Pago, presentando Transferencia y Tarjeta en una sección separada del cálculo del Efectivo_Esperado.
3. LA Plataforma_POS DEBERÁ incluir en el Reporte_de_Turno la lista de Gastos vigentes con descripción y monto, y el total de Gastos.
4. LA Plataforma_POS DEBERÁ incluir en el Reporte_de_Turno el Efectivo_Esperado, el Efectivo_Contado y la Diferencia con la clasificación Sobrante, Faltante o Caja_Cuadrada.
5. LA Plataforma_POS DEBERÁ incluir en el Reporte_de_Turno las unidades vendidas y el valor vendido de cada Producto durante el Turno.
6. LA Plataforma_POS DEBERÁ incluir al final del Reporte_de_Turno un espacio para la firma del Cajero y un espacio para la firma del Encargado.
7. MIENTRAS el Entorno_Cajero muestra la pantalla de resultado del cierre, EL Entorno_Cajero DEBERÁ ofrecer la acción Reimprimir reporte.
8. CUANDO un Cajero toca la acción Reimprimir reporte en la pantalla de apertura de Turno, EL Entorno_Cajero DEBERÁ imprimir el Reporte_de_Turno del último Turno cerrado por ese Cajero.
9. CUANDO LA Plataforma_POS imprime nuevamente un Reporte_de_Turno, LA Plataforma_POS DEBERÁ incluir los mismos datos del cierre y la marca COPIA.

### Requisito 15: Cierre de Turno por el Administrador

**Historia de Usuario:** Como Administrador, quiero cerrar un Turno que quedó abierto, para resolver olvidos sin depender del Cajero.

#### Criterios de Aceptación

1. EL Panel_Admin DEBERÁ mostrar en la sección Turnos la lista de Turnos abiertos de la selección del Selector_de_Sede, con Cajero, Sede y fecha y hora de apertura.
2. CUANDO un Administrador cierra un Turno abierto ingresando el Efectivo_Contado, LA Plataforma_POS DEBERÁ cerrar el Turno con los mismos cálculos del cierre realizado por el Cajero y registrar al Administrador que realizó el cierre.
3. LA Plataforma_POS DEBERÁ identificar los Turnos cerrados por un Administrador en el Reporte_de_Turno y en los reportes del Panel_Admin.
4. SI un Cajero intenta registrar una Venta o un Gasto en un Turno cerrado por un Administrador, ENTONCES EL Entorno_Cajero DEBERÁ mostrar un aviso de Turno cerrado y la pantalla de apertura de Turno.

### Requisito 16: Inventario Mensual por Sede

**Historia de Usuario:** Como Administrador, quiero registrar cada mes el conteo físico de los Productos de cada Sede con su Costo, para llevar las cuentas del inventario por Sede y en total.

#### Criterios de Aceptación

1. LA Plataforma_POS DEBERÁ mantener un único Inventario_Mensual por cada Sede y cada mes.
2. LA Plataforma_POS DEBERÁ limitar el registro y la edición de los Inventarios_Mensuales a los Administradores desde el Panel_Admin.
3. CUANDO un Administrador abre la sección Inventario, EL Panel_Admin DEBERÁ mostrar el Mes_Actual.
4. EL Panel_Admin DEBERÁ ofrecer en la selección de mes de la sección Inventario el Mes_Actual y los meses anteriores al Mes_Actual.
5. SI un Administrador intenta registrar un Inventario_Mensual de un mes posterior al Mes_Actual, ENTONCES LA Plataforma_POS DEBERÁ rechazar el registro.
6. SI un Administrador intenta registrar un Inventario_Mensual nuevo para una Sede inactiva, ENTONCES LA Plataforma_POS DEBERÁ rechazar el registro e indicar que la Sede está inactiva.
7. SI un Administrador intenta modificar la cantidad contada, agregar un Producto o quitar una Línea_de_Inventario en un Inventario_Mensual de una Sede inactiva, ENTONCES LA Plataforma_POS DEBERÁ rechazar la operación, conservar sin cambios el Inventario_Mensual e indicar que la Sede está inactiva.
8. MIENTRAS el Selector_de_Sede tiene seleccionada una Sede activa, CUANDO un Administrador abre en la sección Inventario un mes sin Inventario_Mensual registrado para esa Sede, EL Panel_Admin DEBERÁ presentar una Línea_de_Inventario por cada Producto activo del Catálogo cuyo Producto_de_Sede está habilitado en esa Sede.
9. MIENTRAS el Selector_de_Sede tiene seleccionada una Sede activa, CUANDO un Administrador abre en la sección Inventario un mes con Inventario_Mensual registrado para esa Sede, EL Panel_Admin DEBERÁ mostrar ese Inventario_Mensual listo para editar.
10. MIENTRAS el Selector_de_Sede tiene seleccionada una Sede inactiva, CUANDO un Administrador abre en la sección Inventario un mes con Inventario_Mensual registrado para esa Sede, EL Panel_Admin DEBERÁ mostrar ese Inventario_Mensual en modo de solo consulta, sin las acciones de modificar la cantidad contada, agregar Productos y quitar Líneas_de_Inventario.
11. MIENTRAS la Sede del Inventario_Mensual está activa, CUANDO un Administrador agrega a un Inventario_Mensual un Producto del Catálogo del Tipo_de_Sede de la Sede que no tiene Línea_de_Inventario en ese Inventario_Mensual, EL Panel_Admin DEBERÁ incluir una Línea_de_Inventario para ese Producto, sin importar si el Producto está activo o inactivo en el Catálogo ni si su Producto_de_Sede está habilitado o deshabilitado en la Sede.
12. LA Plataforma_POS DEBERÁ limitar las Líneas_de_Inventario de cada Inventario_Mensual a Productos del Catálogo del Tipo_de_Sede de la Sede, con un máximo de una Línea_de_Inventario por Producto.
13. MIENTRAS la Sede del Inventario_Mensual está activa, CUANDO un Administrador quita una Línea_de_Inventario de un Inventario_Mensual, LA Plataforma_POS DEBERÁ retirar la Línea_de_Inventario del Inventario_Mensual y recalcular el total del Inventario_Mensual.
14. MIENTRAS la Sede del Inventario_Mensual está activa, CUANDO un Administrador registra la cantidad contada de una Línea_de_Inventario, LA Plataforma_POS DEBERÁ guardar la cantidad contada en el Inventario_Mensual de la Sede y del mes.
15. SI un Administrador escribe en el campo de cantidad contada de una Línea_de_Inventario y el valor resultante es negativo, no es un número entero o es mayor que 999.999 unidades, ENTONCES EL Panel_Admin DEBERÁ rechazar el valor, volver a mostrar el valor anterior en el campo y señalar el campo en color rojo con un ícono de error.
16. SI una Línea_de_Inventario no tiene cantidad contada ingresada, ENTONCES LA Plataforma_POS DEBERÁ tomar 0 como la cantidad contada de la Línea_de_Inventario.
17. MIENTRAS la Sede del Inventario_Mensual está activa, CUANDO un Administrador registra por primera vez el Inventario_Mensual del Mes_Actual o de un mes anterior, o agrega un Producto a un Inventario_Mensual, LA Plataforma_POS DEBERÁ guardar en cada Línea_de_Inventario creada una copia del Costo vigente del Producto_de_Sede en ese momento, que queda vacía cuando el Producto_de_Sede no tiene Costo.
18. MIENTRAS la Sede del Producto_de_Sede está activa, CUANDO un Administrador modifica el Costo de un Producto_de_Sede, LA Plataforma_POS DEBERÁ asignar el nuevo Costo a la Línea_de_Inventario de ese Producto en el Inventario_Mensual del Mes_Actual de la misma Sede.
19. MIENTRAS la Sede del Producto_de_Sede está inactiva, CUANDO un Administrador modifica el Costo de un Producto_de_Sede, LA Plataforma_POS DEBERÁ conservar sin cambios los Inventarios_Mensuales de esa Sede, incluidos el Costo guardado en las Líneas_de_Inventario y la última modificación.
20. CUANDO un Administrador modifica el Costo de un Producto_de_Sede, LA Plataforma_POS DEBERÁ conservar sin cambios el Costo guardado en las Líneas_de_Inventario de los Inventarios_Mensuales de los meses anteriores al Mes_Actual, incluidas las Líneas_de_Inventario sin Costo.
21. CUANDO un Administrador modifica la cantidad contada de una Línea_de_Inventario de un mes anterior al Mes_Actual, LA Plataforma_POS DEBERÁ conservar el Costo guardado en la Línea_de_Inventario.
22. LA Plataforma_POS DEBERÁ calcular el valor de cada Línea_de_Inventario como la cantidad contada multiplicada por el Costo guardado en la Línea_de_Inventario.
23. SI una Línea_de_Inventario no tiene Costo, ENTONCES EL Panel_Admin DEBERÁ mostrar la marca "sin costo" en lugar del valor de la Línea_de_Inventario.
24. LA Plataforma_POS DEBERÁ calcular el total de cada Inventario_Mensual como la suma de los valores de las Líneas_de_Inventario que tienen Costo.
25. MIENTRAS la Sede del Inventario_Mensual está activa, CUANDO un Administrador modifica una Línea_de_Inventario de un Inventario_Mensual de cualquier mes, LA Plataforma_POS DEBERÁ guardar el cambio y recalcular el valor de la Línea_de_Inventario y el total del Inventario_Mensual.
26. MIENTRAS la Sede del Inventario_Mensual está activa, CUANDO un Administrador registra o modifica un Inventario_Mensual, LA Plataforma_POS DEBERÁ guardar en el Inventario_Mensual el Administrador y la fecha y hora del cambio como última modificación.
27. MIENTRAS la Sede del Producto_de_Sede está activa, CUANDO un Administrador modifica el Costo de un Producto_de_Sede que tiene Línea_de_Inventario en el Inventario_Mensual del Mes_Actual de esa Sede, LA Plataforma_POS DEBERÁ guardar en ese Inventario_Mensual el Administrador que modificó el Costo y la fecha y hora del cambio de Costo como última modificación.
28. MIENTRAS el Selector_de_Sede tiene una Sede específica seleccionada, EL Panel_Admin DEBERÁ mostrar en la sección Inventario el Inventario_Mensual del mes escogido con el nombre del Producto, la cantidad contada, el Costo y el valor de cada Línea_de_Inventario, y el total del Inventario_Mensual.
29. MIENTRAS el Selector_de_Sede tiene una Sede específica seleccionada, EL Panel_Admin DEBERÁ mostrar en la sección Inventario el nombre del Administrador y la fecha y hora de la última modificación del Inventario_Mensual registrado del mes escogido.
30. SI un Inventario_Mensual tiene al menos una Línea_de_Inventario sin Costo, ENTONCES EL Panel_Admin DEBERÁ mostrar el Aviso_Sin_Costo junto al total del Inventario_Mensual, en la vista de la Sede y en la fila de la Sede del resumen por Sede.
31. MIENTRAS el Selector_de_Sede tiene seleccionada la opción Todas_las_Sedes, EL Panel_Admin DEBERÁ mostrar en la sección Inventario un resumen por Sede del mes escogido, con una fila por cada Sede con el total de su Inventario_Mensual, y el total general.
32. SI una Sede no tiene Inventario_Mensual registrado en el mes escogido, ENTONCES EL Panel_Admin DEBERÁ mostrar la marca "Sin inventario" en la fila de esa Sede del resumen por Sede.
33. LA Plataforma_POS DEBERÁ calcular el total general del resumen por Sede como la suma de los totales de los Inventarios_Mensuales de las Sedes en el mismo mes.
34. SI al menos un Inventario_Mensual del mes escogido tiene una Línea_de_Inventario sin Costo, ENTONCES EL Panel_Admin DEBERÁ mostrar el Aviso_Sin_Costo junto al total general del resumen por Sede.
35. MIENTRAS el Selector_de_Sede tiene seleccionada la opción Todas_las_Sedes, EL Panel_Admin DEBERÁ mostrar en la sección Inventario un detalle por Producto del mes escogido, separado en Panadería y Asadero, con el nombre vigente de cada Producto en el Catálogo y la cantidad contada y el valor de cada Producto sumados entre todas las Sedes.
36. SI un Producto del detalle por Producto tiene al menos una Línea_de_Inventario sin Costo en el mes escogido, ENTONCES EL Panel_Admin DEBERÁ mostrar el Aviso_Sin_Costo junto al valor del Producto.
37. MIENTRAS el Selector_de_Sede tiene seleccionada una Sede inactiva, CUANDO un Administrador abre en la sección Inventario un mes sin Inventario_Mensual registrado para esa Sede, EL Panel_Admin DEBERÁ mostrar la marca "Sin inventario" en modo de solo consulta, sin acciones para registrar el Inventario_Mensual.
38. CUANDO un Administrador cambia el estado de una Sede de inactiva a activa, LA Plataforma_POS DEBERÁ asignar a cada Línea_de_Inventario del Inventario_Mensual del Mes_Actual de esa Sede el Costo vigente del Producto_de_Sede, incluidos los Costos modificados mientras la Sede estaba inactiva.
39. CUANDO un Administrador cambia el estado de una Sede de inactiva a activa, LA Plataforma_POS DEBERÁ conservar sin Costo las Líneas_de_Inventario del Inventario_Mensual del Mes_Actual de esa Sede cuyo Producto_de_Sede no tiene Costo.
40. CUANDO un Administrador cambia el estado de una Sede de inactiva a activa, LA Plataforma_POS DEBERÁ conservar sin cambios los Inventarios_Mensuales de esa Sede de los meses anteriores al Mes_Actual, incluidos el nombre y el Costo guardados en las Líneas_de_Inventario y la última modificación.
41. CUANDO un Administrador cambia a activa el estado de una Sede inactiva que tiene Inventario_Mensual del Mes_Actual, LA Plataforma_POS DEBERÁ guardar en ese Inventario_Mensual el Administrador que cambió el estado de la Sede y la fecha y hora del cambio de estado como última modificación, aunque la reactivación no cambie el nombre ni el Costo de ninguna Línea_de_Inventario.
42. MIENTRAS el Selector_de_Sede tiene seleccionada una Sede activa, CUANDO un Administrador ingresa la cantidad contada de una Línea_de_Inventario y sale del campo o confirma el valor, LA Plataforma_POS DEBERÁ guardar la cantidad contada en ese momento, sin una acción Guardar.
43. MIENTRAS el Selector_de_Sede tiene seleccionada una Sede activa, CUANDO un Administrador hace el primer cambio sobre la Propuesta_de_Inventario de un mes sin Inventario_Mensual registrado para esa Sede, ya sea ingresar una cantidad contada, agregar un Producto o quitar una Línea_de_Inventario, LA Plataforma_POS DEBERÁ registrar el Inventario_Mensual de la Sede y del mes con las Líneas_de_Inventario de la Propuesta_de_Inventario y el cambio aplicado.
44. CUANDO un Administrador abre o consulta en la sección Inventario un mes sin Inventario_Mensual registrado para una Sede activa, LA Plataforma_POS DEBERÁ conservar ese mes sin Inventario_Mensual registrado para la Sede hasta el primer cambio del Administrador sobre la Propuesta_de_Inventario.
45. CUANDO un Administrador toca la acción Quitar de una Línea_de_Inventario, EL Panel_Admin DEBERÁ solicitar confirmación antes de retirar la Línea_de_Inventario.
46. CUANDO un Administrador cancela la confirmación de Quitar una Línea_de_Inventario, EL Panel_Admin DEBERÁ conservar la Línea_de_Inventario sin cambios.
47. EL Panel_Admin DEBERÁ mostrar las Líneas_de_Inventario de cada Inventario_Mensual y de cada Propuesta_de_Inventario ordenadas alfabéticamente por el nombre del Producto mostrado en cada Línea_de_Inventario.
48. MIENTRAS el Selector_de_Sede tiene seleccionada la opción Todas_las_Sedes, EL Panel_Admin DEBERÁ mostrar los Productos del detalle por Producto ordenados alfabéticamente por el nombre vigente del Producto en el Catálogo, dentro de Panadería y dentro de Asadero.
49. MIENTRAS el Selector_de_Sede tiene seleccionada la opción Todas_las_Sedes, EL Panel_Admin DEBERÁ mostrar las filas del resumen por Sede en el mismo orden del Selector_de_Sede: las Sedes activas primero y las Sedes inactivas al final, cada grupo ordenado alfabéticamente por el nombre de la Sede.
50. MIENTRAS el Selector_de_Sede tiene seleccionada la opción Todas_las_Sedes, EL Panel_Admin DEBERÁ incluir en el detalle por Producto únicamente los Productos que tienen al menos una Línea_de_Inventario en el Inventario_Mensual del mes escogido de alguna Sede.
51. MIENTRAS la Sede del Inventario_Mensual está activa, CUANDO un Administrador registra por primera vez el Inventario_Mensual del Mes_Actual o de un mes anterior, o agrega un Producto a un Inventario_Mensual, LA Plataforma_POS DEBERÁ guardar en cada Línea_de_Inventario creada una copia del nombre vigente del Producto en ese momento.
52. EL Panel_Admin DEBERÁ mostrar en cada Línea_de_Inventario de un Inventario_Mensual registrado el nombre del Producto guardado en la Línea_de_Inventario.
53. CUANDO un Administrador modifica el nombre de un Producto, LA Plataforma_POS DEBERÁ conservar sin cambios el nombre guardado en las Líneas_de_Inventario de los Inventarios_Mensuales de los meses anteriores al Mes_Actual.
54. MIENTRAS la Sede del Inventario_Mensual está activa, CUANDO un Administrador escribe en el campo de cantidad contada de una Línea_de_Inventario una cantidad igual a la cantidad contada anterior y sale del campo o confirma el valor, LA Plataforma_POS DEBERÁ guardar en el Inventario_Mensual el Administrador y la fecha y hora del guardado como última modificación.
55. MIENTRAS la Sede del Producto_de_Sede está activa, CUANDO un Administrador escribe en el campo de Costo un Costo igual al Costo anterior de un Producto_de_Sede que tiene Línea_de_Inventario en el Inventario_Mensual del Mes_Actual de esa Sede y sale del campo o confirma el valor, LA Plataforma_POS DEBERÁ guardar en ese Inventario_Mensual el Administrador y la fecha y hora del guardado como última modificación.
56. CUANDO un Administrador modifica el nombre de un Producto, LA Plataforma_POS DEBERÁ asignar el nuevo nombre a la Línea_de_Inventario de ese Producto en el Inventario_Mensual del Mes_Actual de cada Sede activa.
57. CUANDO un Administrador modifica el nombre de un Producto, LA Plataforma_POS DEBERÁ conservar sin cambios los Inventarios_Mensuales de las Sedes inactivas, incluidos el nombre guardado en las Líneas_de_Inventario y la última modificación.
58. MIENTRAS el Selector_de_Sede tiene una Sede específica seleccionada, CUANDO un Administrador escribe el Costo de un Producto en la sección Precios y sale del campo o confirma el valor, LA Plataforma_POS DEBERÁ guardar el Costo en ese momento, sin una acción Guardar.
59. CUANDO un Administrador entra y sale del campo de cantidad contada de una Línea_de_Inventario de un Inventario_Mensual registrado sin escribir en el campo, LA Plataforma_POS DEBERÁ conservar sin cambios el Inventario_Mensual, incluida la última modificación.
60. CUANDO un Administrador entra y sale del campo de cantidad contada de una Línea_de_Inventario de la Propuesta_de_Inventario sin escribir en el campo, LA Plataforma_POS DEBERÁ conservar el mes sin Inventario_Mensual registrado para la Sede.
61. CUANDO un Administrador entra y sale del campo de Costo de un Producto en la sección Precios sin escribir en el campo, LA Plataforma_POS DEBERÁ conservar sin cambios el Costo del Producto_de_Sede y los Inventarios_Mensuales de la Sede, incluida la última modificación.
62. SI falla el guardado automático o el reintento de guardado de una cantidad contada, por ejemplo por falta de conexión con la Base_de_Datos, ENTONCES EL Panel_Admin DEBERÁ conservar en el campo la cantidad contada escrita y mostrar un aviso de que el valor no se guardó con la acción Reintentar.
63. SI falla el guardado automático o el reintento de guardado de un Costo, por ejemplo por falta de conexión con la Base_de_Datos, ENTONCES EL Panel_Admin DEBERÁ conservar en el campo el Costo escrito y mostrar un aviso de que el valor no se guardó con la acción Reintentar.
64. MIENTRAS el Selector_de_Sede tiene seleccionada una Sede activa y el mes escogido en la sección Inventario no tiene Inventario_Mensual registrado para esa Sede, EL Panel_Admin DEBERÁ mostrar junto a la Propuesta_de_Inventario la marca "Sin inventario" y el total en $ 0.
65. MIENTRAS el Selector_de_Sede tiene seleccionada una Sede activa y el mes escogido en la sección Inventario no tiene Inventario_Mensual registrado para esa Sede, EL Panel_Admin DEBERÁ mostrar la Propuesta_de_Inventario sin nombre de Administrador ni fecha y hora de última modificación.
66. MIENTRAS la Sede del Inventario_Mensual está activa, CUANDO un Administrador cambia el nombre de un Producto que tiene Línea_de_Inventario en el Inventario_Mensual del Mes_Actual de esa Sede por un nombre distinto del nombre anterior, LA Plataforma_POS DEBERÁ guardar en ese Inventario_Mensual el Administrador que modificó el nombre del Producto y la fecha y hora del cambio de nombre como última modificación.
67. CUANDO un Administrador cambia el estado de una Sede de inactiva a activa, LA Plataforma_POS DEBERÁ asignar a cada Línea_de_Inventario del Inventario_Mensual del Mes_Actual de esa Sede el nombre vigente del Producto en el Catálogo, incluidos los nombres modificados mientras la Sede estaba inactiva.
68. CUANDO un Administrador toca la acción Reintentar del aviso de una cantidad contada no guardada, LA Plataforma_POS DEBERÁ volver a enviar la cantidad contada conservada en el campo y guardarla con el mismo efecto del guardado automático de la cantidad contada.
69. CUANDO un Administrador toca la acción Reintentar del aviso de un Costo no guardado, LA Plataforma_POS DEBERÁ volver a enviar el Costo conservado en el campo y guardarlo con el mismo efecto del guardado automático del Costo.
70. CUANDO LA Plataforma_POS completa el guardado de una cantidad contada o de un Costo reenviado con la acción Reintentar, EL Panel_Admin DEBERÁ retirar el aviso de que el valor no se guardó.
71. CUANDO un Administrador guarda la edición de un Producto sin cambiar el nombre del Producto, por ejemplo al cambiar solo la imagen o la Categoría, LA Plataforma_POS DEBERÁ conservar sin cambios los Inventarios_Mensuales de todas las Sedes, incluidos el nombre guardado en las Líneas_de_Inventario y la última modificación.

### Requisito 17: Selector de Sede en el Panel de Administración

**Historia de Usuario:** Como Administrador, quiero escoger primero la Sede o Todas_las_Sedes, para ver y gestionar la información sin mezclar Sedes.

#### Criterios de Aceptación

1. EL Panel_Admin DEBERÁ presentar en el Selector_de_Sede la opción Todas_las_Sedes y una tarjeta por cada Sede con nombre e ícono del Tipo_de_Sede, ubicando las Sedes inactivas al final con una marca de inactiva.
2. CUANDO un Administrador escoge una opción en el Selector_de_Sede desde la primera pantalla, EL Panel_Admin DEBERÁ mostrar la sección Resumen de la opción escogida.
3. CUANDO un Administrador escoge una opción en el Selector_de_Sede, EL Panel_Admin DEBERÁ aplicar la opción escogida a todas las secciones del Panel_Admin hasta que el Administrador escoja otra opción.
4. EL Panel_Admin DEBERÁ mostrar en el encabezado de cada sección la opción actual del Selector_de_Sede con un acceso para cambiar la opción.
5. MIENTRAS la sesión del Administrador está iniciada, EL Panel_Admin DEBERÁ conservar la opción actual del Selector_de_Sede al recargar la página.
6. MIENTRAS el Selector_de_Sede tiene seleccionada la opción Todas_las_Sedes, EL Panel_Admin DEBERÁ incluir la Sede en cada fila de los listados y el desglose por Sede de cada total, excepto en el detalle por Producto del Inventario_Mensual.
7. MIENTRAS el Selector_de_Sede tiene seleccionada la opción Todas_las_Sedes, EL Panel_Admin DEBERÁ solicitar la selección de una Sede específica antes de modificar Precios_de_Venta o Costos, habilitar o deshabilitar Productos, o registrar o editar un Inventario_Mensual.
8. EL Panel_Admin DEBERÁ ordenar las tarjetas de las Sedes del Selector_de_Sede alfabéticamente por el nombre de la Sede, dentro del grupo de Sedes activas y dentro del grupo de Sedes inactivas.

### Requisito 18: Resumen y reporte de Ventas

**Historia de Usuario:** Como Administrador, quiero ver las Ventas por Sede y consolidadas en un Rango_de_Fechas, para conocer el desempeño del negocio.

#### Criterios de Aceptación

1. EL Panel_Admin DEBERÁ usar como Rango_de_Fechas predeterminado el día actual en la Zona_Horaria_Operativa.
2. EL Panel_Admin DEBERÁ ofrecer accesos rápidos de Rango_de_Fechas para Hoy, Ayer, Últimos 7 días y Mes actual, además de la selección manual de fecha inicial y fecha final.
3. SI la fecha inicial es posterior a la fecha final, ENTONCES EL Panel_Admin DEBERÁ rechazar el Rango_de_Fechas y señalar las fechas.
4. LA Plataforma_POS DEBERÁ asignar cada Venta y cada Gasto a la fecha correspondiente a la fecha y hora de registro de la Venta o del Gasto en la Zona_Horaria_Operativa.
5. CUANDO un Administrador abre la sección Resumen, EL Panel_Admin DEBERÁ mostrar en tarjetas de resumen el Total de Ventas, la cantidad de Ventas, el total por cada Método_de_Pago y el total de Gastos vigentes de la opción del Selector_de_Sede y del Rango_de_Fechas.
6. CUANDO un Administrador abre la sección Resumen, EL Panel_Admin DEBERÁ mostrar un gráfico de barras con el Total de Ventas de cada día del Rango_de_Fechas.
7. LA Plataforma_POS DEBERÁ calcular los totales por Método_de_Pago de forma que la suma de esos totales sea igual al Total de Ventas de la misma opción del Selector_de_Sede y del mismo Rango_de_Fechas.
8. LA Plataforma_POS DEBERÁ calcular cada total consolidado de Todas_las_Sedes como la suma de los totales de cada Sede para el mismo Rango_de_Fechas.
9. CUANDO un Administrador abre la sección Ventas, EL Panel_Admin DEBERÁ listar las Ventas del Rango_de_Fechas con Número_de_Venta, fecha y hora, Sede, Cajero, Total y Método_de_Pago.
10. CUANDO un Administrador toca una Venta de la lista, EL Panel_Admin DEBERÁ mostrar las Líneas_de_Venta de la Venta.

### Requisito 19: Reportes de Gastos y de Turnos

**Historia de Usuario:** Como Administrador, quiero revisar los Gastos y los Turnos de cada Sede, para controlar el efectivo y las diferencias de caja.

#### Criterios de Aceptación

1. CUANDO un Administrador abre la sección Gastos, EL Panel_Admin DEBERÁ listar los Gastos del Rango_de_Fechas con fecha y hora, Sede, Cajero, descripción, monto y estado, y el total de Gastos vigentes.
2. EL Panel_Admin DEBERÁ identificar los Gastos anulados con una marca visual y excluir los Gastos anulados del total de Gastos.
3. CUANDO un Administrador abre la sección Turnos, EL Panel_Admin DEBERÁ listar los Turnos con apertura dentro del Rango_de_Fechas con Cajero, Sede, fecha y hora de apertura y de cierre, estado, Total de Ventas, total de Gastos, Efectivo_Esperado, Efectivo_Contado y Diferencia.
4. EL Panel_Admin DEBERÁ identificar la Diferencia de cada Turno cerrado como Sobrante, Faltante o Caja_Cuadrada con un color y un ícono distintivos.
5. CUANDO un Administrador abre el detalle de un Turno cerrado, EL Panel_Admin DEBERÁ mostrar el contenido del Reporte_de_Turno y ofrecer la acción Imprimir.
6. CUANDO un Administrador toca la acción Imprimir en el detalle de un Turno cerrado, EL Panel_Admin DEBERÁ enviar el Reporte_de_Turno a impresión en Formato_80mm.

### Requisito 20: Reporte de Ventas por Producto

**Historia de Usuario:** Como Administrador, quiero ver cuántas unidades se vendieron de cada Producto en un Rango_de_Fechas, para planear la producción y comparar Sedes.

#### Criterios de Aceptación

1. CUANDO un Administrador abre la sección Productos de los reportes, EL Panel_Admin DEBERÁ listar cada Producto vendido en el Rango_de_Fechas con unidades vendidas y valor vendido, ordenados de mayor a menor por unidades vendidas.
2. LA Plataforma_POS DEBERÁ calcular las unidades vendidas de un Producto como la suma de las cantidades de las Líneas_de_Venta del Producto en las Ventas del Rango_de_Fechas y de la opción del Selector_de_Sede.
3. LA Plataforma_POS DEBERÁ calcular el valor vendido de un Producto como la suma de los subtotales de las Líneas_de_Venta del Producto en las Ventas del Rango_de_Fechas y de la opción del Selector_de_Sede.
4. CUANDO un Administrador escoge ordenar por valor vendido o por nombre, EL Panel_Admin DEBERÁ ordenar la lista según el criterio escogido.
5. CUANDO un Administrador escribe un texto en la búsqueda del reporte, EL Panel_Admin DEBERÁ mostrar únicamente los Productos cuyo nombre contiene el texto, sin distinguir mayúsculas, minúsculas ni tildes.
6. MIENTRAS el Selector_de_Sede tiene seleccionada la opción Todas_las_Sedes, EL Panel_Admin DEBERÁ mostrar el ícono del Tipo_de_Sede junto a cada Producto y las unidades vendidas del Producto en cada Sede.

### Requisito 21: Aislamiento de datos y control de acceso

**Historia de Usuario:** Como dueño del negocio, quiero que cada Cajero acceda solo a la información de su Sede, para proteger los datos de todas las Sedes en la Base_de_Datos unificada.

#### Criterios de Aceptación

1. LA Base_de_Datos DEBERÁ aplicar Políticas_de_Acceso que limiten la lectura de cada Cajero a los datos de la Sede asignada, las Categorías, los Productos_Vendibles y la habilitación y el Precio_de_Venta de los Productos_de_Sede de esa Sede.
2. LA Base_de_Datos DEBERÁ aplicar Políticas_de_Acceso que limiten el acceso de cada Cajero a los Turnos, Ventas y Gastos registrados por el mismo Cajero.
3. LA Plataforma_POS DEBERÁ asignar la Sede de cada Turno, Venta y Gasto a partir de la Sede asignada en la Base_de_Datos al Cajero autenticado, sin aceptar una Sede enviada por el Entorno_Cajero.
4. SI un Cajero intenta leer o modificar información de otra Sede, ENTONCES LA Base_de_Datos DEBERÁ rechazar la operación.
5. SI un Cajero intenta crear, modificar o desactivar Sedes, Productos, Categorías, Precios_de_Venta, Costos, Usuarios o Inventarios_Mensuales, ENTONCES LA Base_de_Datos DEBERÁ rechazar la operación.
6. SI un Usuario inactivo o sin sesión iniciada intenta acceder a la información de la Base_de_Datos, ENTONCES LA Base_de_Datos DEBERÁ rechazar la operación.
7. LA Base_de_Datos DEBERÁ permitir a cada Administrador activo leer la información de todas las Sedes y gestionar Sedes, Catálogos, Precios_de_Venta, Costos, Usuarios y los Inventarios_Mensuales de las Sedes activas.
8. SI un Usuario intenta modificar o eliminar una Venta registrada, ENTONCES LA Base_de_Datos DEBERÁ rechazar la operación.
9. LA Plataforma_POS DEBERÁ registrar el Usuario responsable y la fecha y hora en cada Venta, Turno y Gasto.
10. LA Plataforma_POS DEBERÁ ejecutar las operaciones que requieren privilegios de administración de Supabase, como crear Usuarios o restablecer contraseñas, exclusivamente en el servidor, sin exponer credenciales privilegiadas en el navegador.
11. SI un Cajero intenta leer el Costo de un Producto_de_Sede o la información de un Inventario_Mensual, ENTONCES LA Base_de_Datos DEBERÁ rechazar la operación.

### Requisito 22: Diseño visual y experiencia de uso

**Historia de Usuario:** Como Usuario, quiero pantallas simples, visuales, con pocos elementos y poco texto, para operar la Plataforma_POS sin capacitación extensa.

#### Criterios de Aceptación

1. LA Plataforma_POS DEBERÁ aplicar en todas las pantallas la Paleta_de_Colores definida en el archivo docs/diseno/paleta.md.
2. LA Plataforma_POS DEBERÁ usar los Diseños_Stitch ubicados en docs/diseno/ como guía del estilo visual general de las pantallas.
3. LA Plataforma_POS DEBERÁ limitar el contenido de cada pantalla a los datos y las acciones definidos en este documento y a los controles de navegación entre pantallas, aunque la pantalla de referencia de los Diseños_Stitch incluya elementos adicionales.
4. LA Plataforma_POS DEBERÁ mantener una relación de contraste mínima de 4,5:1 entre el texto y el fondo.
5. SI un color de la Paleta_de_Colores no alcanza la relación de contraste de 4,5:1 en una combinación de texto y fondo, ENTONCES LA Plataforma_POS DEBERÁ usar la variante más cercana del mismo color que alcance esa relación.
6. EL Entorno_Cajero DEBERÁ funcionar en pantallas táctiles con un ancho mínimo de 768 px.
7. EL Panel_Admin DEBERÁ funcionar en pantallas con un ancho mínimo de 360 px, adaptando la disposición a teléfonos, tablets y computadores.
8. EL Entorno_Cajero DEBERÁ presentar cada Objetivo_Táctil con un tamaño mínimo de 48 × 48 px.
9. EL Panel_Admin DEBERÁ presentar cada Objetivo_Táctil con un tamaño mínimo de 44 × 44 px.
10. LA Plataforma_POS DEBERÁ presentar cada acción principal con un ícono y una etiqueta de máximo dos palabras.
11. LA Plataforma_POS DEBERÁ comunicar el Sobrante, el Faltante, la Caja_Cuadrada y los errores con un color y un ícono a la vez.
12. EL Entorno_Cajero DEBERÁ permitir registrar una Venta de un Producto pagada en Efectivo con monto exacto en un máximo de cinco toques desde la Cuadrícula_de_Productos, sin contar la confirmación del diálogo de impresión del navegador.
13. CUANDO un Cajero toca un Producto en la Cuadrícula_de_Productos, EL Entorno_Cajero DEBERÁ mostrar el Carrito actualizado en un máximo de 200 ms.
14. EL Entorno_Cajero DEBERÁ ofrecer un teclado numérico en pantalla para ingresar montos y cantidades.
15. LA Plataforma_POS DEBERÁ mostrar los montos en pesos colombianos con el signo $, punto como separador de miles y sin decimales (por ejemplo: $ 12.500).
16. LA Plataforma_POS DEBERÁ mostrar los textos de la interfaz en español.
