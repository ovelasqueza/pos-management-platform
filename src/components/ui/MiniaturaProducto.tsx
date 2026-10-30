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
  const estilo = { width: tamano, height: tamano };
  if (url) {
    // object-contain: la foto se ve completa (alargada o ancha), sin recortes
    // eslint-disable-next-line @next/next/no-img-element -- imágenes de Storage, ya reducidas al subir
    return <img src={url} alt="" style={estilo} className="shrink-0 rounded-tarjeta bg-white object-contain" />;
  }
  return (
    <span aria-hidden style={estilo} className="flex shrink-0 items-center justify-center rounded-tarjeta bg-suave text-borde-activo">
      <ImageIcon size={Math.round(tamano * 0.45)} strokeWidth={1.5} />
    </span>
  );
}
