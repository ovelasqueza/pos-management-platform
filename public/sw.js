/*
 * Service worker de la PWA:
 * 1. Guarda en caché local permanente las imágenes de billetes, monedas, íconos y
 *    las fotos de productos de Supabase Storage (/storage/v1/object/public/productos/).
 *    Como cada foto subida lleva marca de tiempo única en el nombre, una URL nunca cambia
 *    de contenido: se descarga UNA sola vez y luego sale directo de memoria/disco (0 peticiones a Supabase).
 * 2. NO guarda datos de ventas, turnos ni sesiones: las operaciones siguen yendo en línea.
 * 3. Muestra la pantalla "Sin conexión" si se cae el internet al navegar.
 */
const VERSION = "v2";
const CACHE_APP = `ventas-app-${VERSION}`;
const CACHE_FOTOS = "ventas-fotos-v1";
const OFFLINE = "/offline.html";

const ESTATICOS_CAJA = [
  OFFLINE,
  "/iconos/icono-192.png",
  "/iconos/favicon-32.png",
  "/billetes/2000_new.webp",
  "/billetes/5000_new.webp",
  "/billetes/10000_new.webp",
  "/billetes/20000_new.webp",
  "/billetes/50000_new.webp",
  "/billetes/100000_new.webp",
  "/billetes/moneda-50.webp",
  "/billetes/moneda-100.webp",
  "/billetes/moneda-200.webp",
  "/billetes/moneda-500.webp",
  "/billetes/moneda-1000.webp",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE_APP)
      .then((c) => c.addAll(ESTATICOS_CAJA))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(
          claves
            .filter((k) => k !== CACHE_APP && k !== CACHE_FOTOS)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function esImagenCacheable(url) {
  // Imágenes locales de billetes, monedas e íconos
  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/billetes/") || url.pathname.startsWith("/iconos/"))
  ) {
    return CACHE_APP;
  }
  // Fotos públicas de productos en Supabase Storage (inmutables por timestamp en el nombre)
  if (url.pathname.includes("/storage/v1/object/public/productos/")) {
    return CACHE_FOTOS;
  }
  return null;
}

self.addEventListener("fetch", (evento) => {
  const req = evento.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const nombreCache = esImagenCacheable(url);

  // Estrategia Cache-First para fotos de productos, billetes, monedas e íconos:
  // se pide a la red UNA sola vez y queda guardada en el equipo.
  if (nombreCache) {
    evento.respondWith(
      caches.open(nombreCache).then(async (cache) => {
        const guardada = await cache.match(req);
        if (guardada) return guardada;
        const respuesta = await fetch(req);
        if (respuesta && (respuesta.status === 200 || respuesta.type === "opaque")) {
          cache.put(req, respuesta.clone()).catch(() => {});
        }
        return respuesta;
      }),
    );
    return;
  }

  // Navegaciones: si no hay red, muestra la pantalla "Sin conexión"
  if (req.mode === "navigate") {
    evento.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
  }
});
