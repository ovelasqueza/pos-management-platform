import { z } from "zod";
import { leerPesos } from "./dinero";

export const IMAGEN_MAX_BYTES = 2 * 1024 * 1024;
export const IMAGEN_TIPOS = ["image/jpeg", "image/png", "image/webp"] as const;

export const MODALIDADES_PRODUCTO = ["mesa", "llevar"] as const;
export type ModalidadProducto = (typeof MODALIDADES_PRODUCTO)[number];

const precio = z
  .string()
  .transform((v, ctx) => {
    const n = leerPesos(v);
    if (n === null) {
      ctx.addIssue({ code: "custom", message: "Entero mayor que 0, máximo $ 999.999.999" });
      return z.NEVER;
    }
    return n;
  });

const camposProducto = {
  nombre: z.string().trim().min(1, "Escribe el nombre").max(80, "Máximo 80 caracteres"),
  categoriaId: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.uuid().nullable()),
  precioReferencia: precio,
  modalidad: z
    .string()
    .optional()
    .transform((v) => (v === "mesa" || v === "llevar" ? v : null)),
};

export const esquemaCrearProducto = z.object({
  ...camposProducto,
  tipo: z.enum(["panaderia", "asadero"]),
});

export const esquemaEditarProducto = z.object({
  ...camposProducto,
  id: z.uuid(),
  activo: z.boolean(),
  aplicarATodas: z.boolean(),
  quitarImagen: z.boolean(),
});

export const esquemaCategoria = z.object({
  nombre: z.string().trim().min(1, "Escribe el nombre").max(40, "Máximo 40 caracteres"),
});

/** Devuelve el mensaje de error o null si la imagen es válida (o no hay imagen). */
export function validarImagen(archivo: File | null): string | null {
  if (!archivo || archivo.size === 0) return null;
  if (!(IMAGEN_TIPOS as readonly string[]).includes(archivo.type)) return "Solo JPG, PNG o WebP";
  if (archivo.size > IMAGEN_MAX_BYTES) return "Máximo 2 MB";
  return null;
}

/** "Pan de bono" → "PB"; "Café" → "CA" */
export function iniciales(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter((p) => p.length > 2 || /^\d/.test(p));
  const base = palabras.length >= 2 ? palabras[0][0] + palabras[1][0] : nombre.trim().slice(0, 2);
  return base.toUpperCase();
}

/** Para búsquedas: minúsculas y sin tildes. */
export function normalizarTexto(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}
