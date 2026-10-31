import { z } from "zod";

export type TipoSede = "panaderia" | "asadero";

export const TIPOS_SEDE: { valor: TipoSede; nombre: string }[] = [
  { valor: "panaderia", nombre: "Panadería" },
  { valor: "asadero", nombre: "Asadero" },
];

export const nombreTipo = (tipo: TipoSede) => (tipo === "panaderia" ? "Panadería" : "Asadero");

const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .transform((v) => (v === "" ? null : v));

/** NIT opcional: se quitan espacios y puntos; solo números con dígito de verificación opcional. */
const nit = z
  .string()
  .transform((v) => v.replace(/[\s.]/g, ""))
  .refine((v) => v === "" || /^[0-9]{3,15}(-[0-9])?$/.test(v), "Solo números (ej.: 900123456-7)")
  .transform((v) => (v === "" ? null : v));

const camposEditables = {
  nombre: z.string().trim().min(1, "Escribe el nombre").max(80, "Máximo 80 caracteres"),
  nit,
  ciudad: opcional(60),
  direccion: opcional(150),
  telefono: opcional(30),
};

/** "Palmira · Barrio La Rivera" (solo lo que exista); null si no hay ninguno. */
export function ubicacionSede(s: { ciudad?: string | null; direccion: string | null }): string | null {
  return [s.ciudad, s.direccion].filter(Boolean).join(" · ") || null;
}

export const esquemaCrearSede = z.object({
  ...camposEditables,
  tipo: z.enum(["panaderia", "asadero"], "Escoge el tipo"),
});

export const esquemaEditarSede = z.object({ id: z.uuid(), ...camposEditables });

/** Activas primero; dentro de cada grupo, alfabético (es-CO, sin tildes). */
export function ordenarSedes<T extends { nombre: string; activa: boolean }>(sedes: T[]): T[] {
  return [...sedes].sort(
    (a, b) =>
      Number(b.activa) - Number(a.activa) ||
      a.nombre.localeCompare(b.nombre, "es-CO", { sensitivity: "base" }),
  );
}
