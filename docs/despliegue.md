# Publicar la app

## Etapa 1: Netlify (plan gratuito, para probar en un solo punto)

Se publica desde este equipo con la herramienta de Netlify, **sin subir el código a git**.

### Una sola vez

1. Crea una cuenta gratis en https://app.netlify.com
2. En la terminal del proyecto:

   ```
   npx netlify-cli login
   ```

   Se abre el navegador para autorizar.

3. Crea el sitio:

   ```
   npx netlify-cli sites:create --name pos-panaderia-trigo
   npx netlify-cli link --name pos-panaderia-trigo
   ```

   (El nombre es la dirección: `https://pos-panaderia-trigo.netlify.app`. Si está ocupado, usa otro.)

4. Variables de entorno (las mismas de `.env.local`). En el panel de Netlify: **Site configuration → Environment variables → Add variable**:

   | Variable | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | igual que en `.env.local` (sin `/rest/v1/`) |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | igual que en `.env.local` |
   | `SUPABASE_SECRET_KEY` | igual que en `.env.local` · marcar **"Contains secret values"** |

   No las pegues en ningún archivo del proyecto ni en chats.

### Cada vez que quieras publicar una versión

```
npx netlify-cli deploy --build --prod
```

Compila en este equipo y sube el resultado. Tarda 1–3 minutos.
Si tienes `npm run dev` abierto, ciérralo antes (comparten la carpeta `.next`).

### Prueba después de publicar

- [ ] Login de admin y de cajero
- [ ] Abrir turno, vender en Efectivo / QR / Tarjeta, imprimir ticket
- [ ] Gasto, cerrar turno, reporte y "Siguiente cajero"
- [ ] Subir una foto de producto
- [ ] Reportes del admin
- [ ] El turno no deja entrar desde otro equipo

### Dominio propio (opcional)

Netlify → **Domain management → Add a domain**. Sigue las instrucciones para el DNS; el HTTPS se activa solo.

## Cloudflare Workers (reemplaza a Netlify)

Se usa el adaptador `@opennextjs/cloudflare` (Next.js sobre Workers). Archivos: `wrangler.jsonc`, `open-next.config.ts`. Requiere `next` ≥ 16.4.5.

### Una sola vez

1. Crea una cuenta gratis en https://dash.cloudflare.com
2. En la terminal del proyecto: `npx wrangler login`
3. Las variables `NEXT_PUBLIC_*` se incrustan **al compilar**, y se leen de `.env.local` (o `.env.production`). No hay que subirlas a Cloudflare.
4. El secreto, una vez (pide el valor en la terminal):

   ```
   npx wrangler secret put SUPABASE_SECRET_KEY
   ```

   Si se hace antes del primer despliegue, Wrangler pide crear el Worker: acepta.

### Probar en local con el motor de Cloudflare (opcional)

Copia `.dev.vars.example` a `.dev.vars`, pon la clave y ejecuta `npm run preview`.

### Publicar una versión

```
npm run deploy
```

Compila, sube y muestra la dirección `https://pos-management-platform.<tu-cuenta>.workers.dev`. Si tienes `npm run dev` abierto, ciérralo antes (comparten `.next`).

### Después de publicar

- Agrega la nueva dirección a los orígenes del agente del cajón: `instalar.cmd -Origenes https://pos-management-platform.<tu-cuenta>.workers.dev` en cada caja (o la del dominio propio).
- En Supabase → Authentication → URL Configuration, agrega la nueva dirección si usas redirecciones.
- Repite la lista de pruebas de la Etapa 1.
- Dominio propio: Workers & Pages → tu Worker → Settings → Domains & Routes.

### Avisos

- El `proxy.ts` de Next 16 corre en runtime Node. OpenNext lo marca como **experimental** en Cloudflare: prueba bien login, sesión y la regla del turno por equipo.
- Región: Workers corre cerca del usuario, pero Supabase está en us-east-2. Si va lento, activa Smart Placement (`"placement": { "mode": "smart" }` en `wrangler.jsonc`).
- `next/image` usa el binding `IMAGES` de Cloudflare.

## Respaldo semanal de la base de datos

El plan gratuito de Supabase no guarda copias. Una vez por semana:

```
npm run respaldo-bd
```

Crea `respaldos/AAAA-MM-DD_HHMM/` con un archivo JSON por tabla. **Cópialo fuera de este equipo** (USB o Drive). La carpeta `respaldos/` no se sube a git.

Si la panadería cierra 7 días seguidos, Supabase pausa el proyecto: entra al panel y pulsa **Resume project**.

## Etapa 2: cuando haya ventas reales — Vercel Pro + Supabase Pro

1. Subir el código a git (GitHub) y conectarlo en Vercel.
2. Las mismas 3 variables de entorno.
3. Región de funciones: **Washington (iad1)**, cerca de Supabase (us-east-2).
4. Supabase → plan Pro (sin pausas, copias diarias).
5. Mover el dominio de Netlify a Vercel.

No hay que cambiar código: `netlify.toml` simplemente se ignora en Vercel.
