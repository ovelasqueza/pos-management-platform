/**
 * Reduce una foto en el navegador antes de subirla (p. ej. fotos de celular de 5 MB).
 * No recorta: conserva la forma y limita el lado más largo a LADO px; la guarda en WebP.
 * Resultado típico: 40–80 KB, con buena calidad para las tarjetas de producto.
 */

const LADO = 600;
const CALIDAD = 0.8;
/** Tamaño máximo del archivo original que se acepta para reducir */
export const ORIGINAL_MAX_BYTES = 25 * 1024 * 1024;

export async function reducirFoto(archivo: File): Promise<File> {
  if (!archivo.type.startsWith("image/")) throw new Error("El archivo no es una imagen");
  if (archivo.size > ORIGINAL_MAX_BYTES) throw new Error("La foto es demasiado grande (máx. 25 MB)");

  let bitmap: ImageBitmap;
  try {
    // imageOrientation respeta la rotación de las fotos de celular (EXIF)
    bitmap = await createImageBitmap(archivo, { imageOrientation: "from-image" });
  } catch {
    throw new Error("No se pudo leer la foto. Usa JPG, PNG o WebP");
  }

  // Sin recortar: conserva la forma (alargada o ancha) y limita el lado más largo a LADO px
  const escala = Math.min(1, LADO / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);
  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la foto");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();

  const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/webp", CALIDAD));
  // Navegadores sin WebP en canvas: JPEG
  const final = blob?.type === "image/webp" ? blob : await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/jpeg", CALIDAD));
  if (!final) throw new Error("No se pudo procesar la foto");

  const extension = final.type === "image/webp" ? "webp" : "jpg";
  const base = archivo.name.replace(/\.[^.]+$/, "") || "foto";
  return new File([final], `${base}.${extension}`, { type: final.type });
}
