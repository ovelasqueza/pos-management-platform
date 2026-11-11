# Cajón sin papel

El agente del cajón es un programa pequeño que se instala **en el computador de cada caja**, el que tiene la impresora y el cajón conectados. Cuando el cajero toca **Cajón**, el agente le manda a la impresora la orden de abrir el cajón, sin imprimir nada.

Si el agente no está instalado o no responde, el botón **Cajón** abre el cajón como antes, imprimiendo cerca de 1 cm de papel.

## Instalar (una vez por caja)

1. Copia la carpeta `herramientas/cajon` al computador de la caja. Puede ser con una USB o descargándola de GitHub.
2. Haz **doble clic en `instalar.cmd`**. No necesita permisos de administrador (con administrador queda para todos los usuarios de Windows del equipo).
3. Escribe el **número de la impresora** que tiene el cajón conectado.
4. Cuando pregunte "¿Probar abrir el cajón ahora?", escribe **S**. El cajón debe abrir.
   - Si no abre, cierra la ventana y ejecuta en esa carpeta: `instalar.cmd -Pin 5`
5. Abre la app de caja y toca **Cajón**. Si Chrome pregunta si la página puede **acceder a dispositivos de tu red local**, elige **Permitir**.

Desde ese momento el agente arranca solo al encender o reiniciar el equipo. Queda en `C:\Users\Public\POS-Cajon` y lo vigila un proceso oculto que lo vuelve a levantar si se cierra por cualquier motivo (registro de Windows, carpeta Inicio y tarea programada; solo corre una copia a la vez).

## Si la app se abre desde otra dirección

El agente solo obedece a estas direcciones de la app:

- `https://pos.puntocloud.com.co`
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

- Revisa el registro del agente en `C:\Users\Public\POS-Cajon\agente.log` (o `%LOCALAPPDATA%\POS-Cajon\agente.log` si no hubo permiso para la anterior). Para abrirlo, pega esa ruta en la barra del Explorador de archivos.
- Si el botón sigue gastando papel, el agente no está respondiendo. Ejecuta `instalar.cmd` de nuevo y fíjate en el mensaje "OK: el agente está corriendo".
- Si Chrome bloqueó el permiso de red local, entra a `chrome://settings/content/localNetworkAccess` (o al candado de la barra de direcciones) y permítelo para la app.

## Seguridad

- El agente solo escucha dentro del mismo equipo (`127.0.0.1`, puerto 17777). No se puede usar desde otros equipos de la red.
- Solo responde a las direcciones de la app de la lista anterior.
- Puede abrir el cajón y enviar a la impresora los bytes de un recibo (`POST /imprimir`, máx. 64 KB, que esta app no usa todavía). Nada más.

## Varias apps en el mismo equipo

Un mismo equipo puede tener el POS y otra app, por ejemplo el inventario, usando un solo agente. Ejecuta el `instalar.cmd` de cada app: el instalador conserva las direcciones que ya estaban y suma las nuevas.

## Para desarrolladores (llevar el botón a otra app)

Esta información es para quien copie el botón a otro proyecto, sea una persona o un asistente de código.

1. **Copiar** la carpeta `herramientas/cajon` tal cual. En `instalar.ps1`, cambiar la lista `$Origenes` por las direcciones donde se abre la nueva app.
2. **Llamar al agente** desde el navegador (código del cliente):
   ```ts
   const r = await fetch("http://127.0.0.1:17777/abrir", { method: "POST", signal: AbortSignal.timeout(1500) });
   const abrio = r.ok && (await r.json()).ok === true;
   ```
   - Debe ser un `POST` **sin cuerpo y sin encabezados**. Así es una petición simple y no hay preflight.
   - Si falla (sin agente, sin respuesta o error), el `fetch` lanza o `ok` es `false`. Entonces se usa el plan B.
   - `GET /estado` responde `{ ok, impresora }` y sirve para saber si el agente está corriendo.
3. **Plan B** cuando el agente no responde:
   - En el POS: se imprime con `window.print()` una página casi vacía (1 mm, sin texto). El driver de la impresora está configurado para abrir el cajón al empezar a imprimir, así que el cajón abre gastando unos 1 cm de papel. Requiere la impresión directa de Chrome (`--kiosk-printing`).
   - En apps que no imprimen: se muestra un aviso de que el cajón no se pudo abrir.
4. **Evitar doble clic**: no llamar de nuevo mientras una llamada está en curso.

El agente manda `ESC p 0 25 250` (`1B 70 00 19 FA`) por la cola de Windows en modo RAW. Con `-Pin 5` manda `1B 70 01 19 FA`.

## Botón Cajón en la caja

El botón muestra el resultado: **Abriendo…**, **¡Abierto!** (con el agente, sin papel) o **Abierto (papel)** si el agente no respondió y se usó la página mínima.
