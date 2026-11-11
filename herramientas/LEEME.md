# Herramientas del Punto de Venta (POS)

Esta carpeta contiene los instaladores para dejar configurado cualquier computador de caja con Windows en 1 solo paso.

---

## 🚀 Instalador todo-en-uno (`instalar-punto.cmd`)

Configura en un solo proceso:
1. **El cajón monedero y la impresora térmica:** instala el agente en segundo plano con inicio automático y soporte RAW sin gastar papel.
2. **La App de Caja en pantalla completa (Modo Kiosko PWA):**
   - Inicia automáticamente cada vez que el computador se enciende o reinicia.
   - Abre en pantalla completa total (sin barras de navegador ni pestañas).
   - Activa impresión directa (`--kiosk-printing`) para imprimir los tickets sin diálogos innecesarios.
   - Crea un acceso directo en el **Escritorio** con el ícono del sistema.

### ¿Cómo usarlo?
1. Conecta la impresora térmica y el cajón monedero al computador.
2. Haz **doble clic en `instalar-punto.cmd`**.
3. Selecciona el número de la impresora cuando te lo pida.
4. ¡Listo! Todo queda configurado y funcionando.

---

## 🗑️ Desinstalador (`desinstalar-punto.cmd`)

Si necesitas quitar el Punto de Venta o el agente de este equipo:
1. Haz **doble clic en `desinstalar-punto.cmd`**.
2. Detiene los procesos y quita los accesos directos y servicios de Windows.

---

## 🖨️ Carpeta `cajon/`

Contiene los scripts individuales del agente del cajón por si solo deseas instalar el conector de la impresora sin la app en pantalla completa.
