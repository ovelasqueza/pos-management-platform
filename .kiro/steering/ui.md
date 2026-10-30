---
inclusion: always
---

# Guía visual

Referencia: `docs/diseno/` (exportes de Stitch). Son **guía de estilo**, no especificación. Los HTML traen elementos que NO van en v1 (stock, mesas, impuestos, WhatsApp, DIAN, metas, Excel, desglose por billetes en auditoría). No copiarlos.

Todos los `DESIGN *.md` son idénticos; usar solo `docs/diseno/DESIGN login.md` como fuente de tokens. No cargar los `.html` completos en contexto salvo que haga falta revisar una pantalla puntual.

## Tokens

| Uso | Valor |
|---|---|
| Fondo app | `#f8fafc` |
| Superficie / tarjetas | `#ffffff` |
| Borde | `#e2e8f0` (activo `#cbd5e1`) |
| Texto principal | `#0f172a` |
| Texto secundario | `#334155` / meta `#64748b` |
| Primario (cobrar, confirmar) | `#059669`, presionado `#047857` |
| Advertencia | `#d97706` |
| Error / quitar | `#dc2626` |

- Fuentes: **Hanken Grotesk** (texto), **JetBrains Mono** (precios, cantidades, números).
- Radios: 4 px controles, 8 px tarjetas, 12 px modales.
- Sin sombras salvo modales: `0 8px 24px -4px rgba(15,23,42,.08)` + borde `#cbd5e1`.
- Total a pagar: 40 px bold mono.

## Reglas de interfaz

- Botones táctiles mínimo **48×48 px** en caja; botón Cobrar 56 px de alto.
- Caja en escritorio/tablet: productos a la izquierda (~60%), carrito a la derecha (~40%). En móvil: carrito fijo abajo.
- Un ícono + una o dos palabras por botón. Nada de párrafos.
- Confirmar solo acciones destructivas o de dinero (cerrar turno, anular gasto).
- Errores en una línea, junto al campo.
- Formato de dinero: `$ 12.500` (es-CO, sin decimales).
- Accesibilidad: contraste AA, foco visible, `aria-label` en botones de solo ícono.
