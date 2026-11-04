# Cajón sin papel

El agente del cajón es un programa pequeño que se instala **en el computador de cada caja**, el que tiene la impresora y el cajón conectados. Cuando el cajero toca **Cajón**, el agente le manda a la impresora la orden de abrir el cajón, sin imprimir nada.

Si el agente no está instalado o no responde, el botón **Cajón** abre el cajón como antes, imprimiendo cerca de 1 cm de papel.

## Instalar (una vez por caja)

1. Copia la carpeta `herramientas/cajon` al computador de la caja. Puede ser con una USB o descargándola de GitHub.
2. Haz **doble clic en `instalar.cmd`**. No necesita permisos de administrador.
3. Escribe el **número de la impresora** que tiene el cajón conectado.
4. Cuando pregunte "¿Probar abrir el cajón ahora?", escribe **S**. El cajón debe abrir.
   - Si no abre, cierra la ventana y ejecuta en esa carpeta: `instalar.cmd -Pin 5`
5. Abre la app de caja y toca **Cajón**. Si Chrome pregunta si la página puede **acceder a dispositivos de tu red local**, elige **Permitir**.

Desde ese momento el agente arranca solo cada vez que se inicia sesión en Windows.

## Si la app se abre desde otra dirección

El agente solo obedece a estas direcciones de la app:

- `https://harmonious-griffin-48958c.netlify.app`
- `http://localhost:3000`
- `http://127.0.0.1:3000`
- `http://192.168.1.36:3000`

Si la caja abre la app desde otra dirección, por ejemplo un dominio propio, instala así:

```
instalar.cmd -Origenes https://mi-dominio.com
```

## Cambiar la impresora

Ejecuta `instalar.cmd` otra vez y elige la impresora nueva.

## Desinstalar

Haz doble clic en `desinstalar.cmd`.

## Si no funciona

- Revisa el registro del agente en `%LOCALAPPDATA%\POS-Cajon\agente.log`. Para abrirlo, pega esa ruta en la barra del Explorador de archivos.
- Si el botón sigue gastando papel, el agente no está respondiendo. Ejecuta `instalar.cmd` de nuevo y fíjate en el mensaje "OK: el agente está corriendo".
- Si Chrome bloqueó el permiso de red local, entra a `chrome://settings/content/localNetworkAccess` (o al candado de la barra de direcciones) y permítelo para la app.

## Seguridad

- El agente solo escucha dentro del mismo equipo (`127.0.0.1`, puerto 17777). No se puede usar desde otros equipos de la red.
- Solo responde a las direcciones de la app de la lista anterior.
- Lo único que puede hacer es abrir el cajón.
