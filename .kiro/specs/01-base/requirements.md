# Requirements: 01 Base (proyecto, acceso, sedes, usuarios)

Contexto general en `.kiro/steering/product.md`.

## R1. Inicio de sesión

1. CUANDO un usuario activo ingresa usuario y contraseña correctos, el sistema DEBE iniciar sesión y llevarlo a su ambiente: cajero → `/caja`, admin → `/admin`.
2. SI las credenciales son incorrectas, el sistema DEBE mostrar "Usuario o contraseña incorrectos" sin decir cuál falló.
3. SI el usuario está inactivo, el sistema DEBE rechazar el ingreso con "Usuario inactivo".
4. La sesión DEBE mantenerse al recargar la página.
5. CUANDO el usuario toca Salir, el sistema DEBE cerrar sesión y volver a `/login`.
6. SI un usuario fue desactivado con sesión abierta, su siguiente operación DEBE fallar y llevarlo a `/login`.

## R2. Acceso por rol

1. Un cajero NO DEBE poder abrir rutas de `/admin`, y un admin NO DEBE poder abrir `/caja`.
2. Un cajero cuya sede está inactiva NO DEBE poder ingresar a la caja; ve "Sede inactiva".
3. Las reglas de acceso DEBEN aplicarse en la base de datos (RLS), no solo en la interfaz.

## R3. Selector de sede (admin)

1. CUANDO el admin ingresa, el sistema DEBE mostrar las sedes como tarjetas (nombre, tipo, estado) más la opción "Todas las sedes".
2. Orden: activas primero, luego inactivas; alfabético dentro de cada grupo.
3. La sede escogida DEBE quedar visible en la barra superior del admin y poder cambiarse desde ahí sin volver a la pantalla inicial.

## R4. Sedes

1. El admin DEBE poder crear una sede con nombre (único), tipo (Panadería o Asadero), dirección y teléfono opcionales.
2. El tipo de sede NO DEBE poder cambiarse después de creada.
3. El admin DEBE poder editar nombre, dirección y teléfono, y activar/desactivar la sede.
4. SI la sede tiene turnos abiertos, el sistema NO DEBE permitir desactivarla y DEBE indicar qué cajeros los tienen.
5. Al crear una sede, DEBEN habilitarse automáticamente los productos activos de su catálogo con el precio de referencia (ver spec 02).

## R5. Usuarios

1. El admin DEBE poder crear usuarios con nombre completo, nombre de usuario (único, sin espacios), contraseña (mín. 8), rol y, si es cajero, una sede activa.
2. El admin DEBE poder editar nombre, rol, sede, activar/desactivar y restablecer la contraseña.
3. SI el cajero tiene un turno abierto, el sistema NO DEBE permitir cambiarle sede o rol ni desactivarlo.
4. El sistema NO DEBE permitir desactivar ni quitar el rol al último admin activo.
5. El primer admin se crea con un script de configuración (`npm run crear-admin`).
6. La lista de usuarios DEBE filtrarse por la sede escogida en el selector (en "Todas", se ven todos).
