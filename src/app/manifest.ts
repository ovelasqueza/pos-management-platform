import type { MetadataRoute } from "next";
import { MARCA } from "@/lib/marca";

/** Manifiesto de la PWA: permite instalar la app en el escritorio, tablet o celular. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: MARCA.nombre,
    short_name: MARCA.corto,
    description: MARCA.descripcion,
    lang: "es-CO",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f8fafc",
    theme_color: "#059669",
    icons: [
      { src: "/iconos/icono-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/iconos/icono-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/iconos/icono-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
