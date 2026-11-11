"use client";

import { useState } from "react";
import { ImageIcon } from "lucide-react";

/** Foto del producto o, si no tiene, un cuadro neutro con un ícono tenue (sin texto). */
export function MiniaturaProducto({
  url,
  tamano = 48,
}: {
  nombre?: string;
  url: string | null;
  tamano?: number;
}) {
  const [falloUrl, setFalloUrl] = useState<string | null>(null);
  const estilo = { width: tamano, height: tamano };

  if (url && falloUrl !== url) {
    // object-contain: la foto se ve completa (alargada o ancha), sin recortes.
    // Se sirve desde la caché local del Service Worker tras la primera carga.
    return (
      // eslint-disable-next-line @next/next/no-img-element -- imágenes de Storage cacheadas localmente
      <img
        src={url}
        alt=""
        width={tamano}
        height={tamano}
        decoding="async"
        draggable={false}
        onError={() => setFalloUrl(url)}
        style={estilo}
        className="shrink-0 select-none rounded-tarjeta bg-white object-contain"
      />
    );
  }
  return (
    <span aria-hidden style={estilo} className="flex shrink-0 items-center justify-center rounded-tarjeta bg-suave text-borde-activo">
      <ImageIcon size={Math.round(tamano * 0.45)} strokeWidth={1.5} />
    </span>
  );
}
