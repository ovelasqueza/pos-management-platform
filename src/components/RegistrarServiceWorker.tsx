"use client";

import { useEffect } from "react";

/** Registra el service worker para guardar en caché local las fotos de productos y billetes. */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Sin service worker la app funciona igual
    });
  }, []);
  return null;
}
