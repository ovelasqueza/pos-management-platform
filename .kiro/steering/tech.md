---
inclusion: always
---

# Stack y convenciones

## Stack

- Next.js (App Router) + React + TypeScript `strict`
- Tailwind CSS 4 con tokens en `src/app/globals.css` (`@theme`)
- Supabase: Postgres, Auth, RLS, Storage (imágenes de productos)
- `@supabase/supabase-js` + `@supabase/ssr`
- `zod` para validar formularios
- `lucide-react` para íconos
- Vitest para lógica pura; pruebas SQL con `supabase test db` (pgTAP) solo para RLS y funciones de dinero
- Versiones exactas en `package.json` (`save-exact=true`)

No agregar librerías fuera de esta lista sin preguntar.

## Estructura

```
src/
  app/
    login/
    caja/            # ambiente cajero
    admin/           # ambiente admin
  lib/
    supabase/        # clientes browser y server
    dominio/         # lógica pura (cálculos de dinero, validaciones) + tests
  components/
    ui/              # botones, inputs, modal, etc.
supabase/
  migrations/
  tests/
```

## Reglas técnicas

- **Dinero en la base de datos**: abrir/cerrar turno, registrar venta y gasto son funciones RPC de Postgres (una transacción). Los totales se calculan en la BD con precios de la BD, nunca con valores del navegador.
- **RLS en todas las tablas**. El cajero solo ve datos de su sede y su turno. El costo de productos no es visible para cajeros.
- La clave secreta de Supabase solo en servidor (crear usuarios con `auth.admin`).
- Login por nombre de usuario: se mapea a un correo interno `usuario@pos.local` en Supabase Auth.
- Número de venta consecutivo por sede.
- Venta idempotente: el cliente envía un `uuid` por cobro para no duplicar si se reintenta.
- Impresión: `window.print()` con CSS de 80 mm.
- Código, tablas y columnas en español, `snake_case` en SQL, `camelCase` en TS.

## Comandos

- `npm run dev` / `npm run build` / `npm run lint`
- `npm test` (Vitest)
- `npx supabase start` / `npx supabase db reset` / `npx supabase test db`
