"use client";

import { useEffect } from "react";

/** Registra el service worker (solo en producción y con HTTPS o localhost). */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Sin service worker la app funciona igual; solo no muestra la pantalla "Sin conexión"
    });
  }, []);
  return null;
}
