import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Solo desarrollo: permite abrir `next dev` desde otros dispositivos de la red local
  allowedDevOrigins: ["192.168.1.36"],
  // cacheComponents desactivado: todas las pantallas dependen de la sesión
  // (son dinámicas), así que el modelo clásico es más simple aquí.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
  experimental: {
    // Imágenes de productos hasta 2 MB + margen del multipart
    serverActions: { bodySizeLimit: "3mb" },
  },
};

export default nextConfig;
