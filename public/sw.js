/*
 * Service worker mínimo de la PWA.
 * - NO guarda datos de la app (ventas, productos, sesión): todo sigue yendo en línea a Supabase.
 * - Solo guarda la pantalla "Sin conexión" para mostrarla si se cae el internet al navegar.
 * Al cambiar este archivo, sube VERSION para que los equipos tomen la nueva versión.
 */
const VERSION = "v1";
const CACHE = `ventas-${VERSION}`;
const OFFLINE = "/offline.html";

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll([OFFLINE, "/iconos/icono-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evento) => {
  // Solo navegaciones (abrir/recargar una página). Lo demás pasa directo a la red.
  if (evento.request.mode !== "navigate") return;
  evento.respondWith(fetch(evento.request).catch(() => caches.match(OFFLINE)));
});
