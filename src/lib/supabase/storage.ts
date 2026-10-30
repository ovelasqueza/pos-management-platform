import { SUPABASE_URL } from "./config";

/** URL pública de una imagen del bucket "productos". */
export const urlImagen = (path: string | null) =>
  path ? `${SUPABASE_URL}/storage/v1/object/public/productos/${path}` : null;
