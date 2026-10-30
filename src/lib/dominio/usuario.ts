import { z } from "zod";

export const DOMINIO_CORREO_INTERNO = "pos.local";

/** Normaliza el nombre de usuario: minúsculas y sin espacios alrededor. */
export function normalizarUsuario(nombre: string): string {
  return nombre.trim().toLowerCase();
}

/** Supabase Auth necesita un correo: "Caja.Norte" → "caja.norte@pos.local" */
export function correoInterno(nombreUsuario: string): string {
  return `${normalizarUsuario(nombreUsuario)}@${DOMINIO_CORREO_INTERNO}`;
}

const nombreUsuario = z
  .string()
  .transform(normalizarUsuario)
  .pipe(
    z
      .string()
      .regex(/^[a-z0-9._-]{3,30}$/, "3 a 30 caracteres: letras sin tilde, números, . - _"),
  );

const contrasena = z.string().min(8, "Mínimo 8 caracteres").max(72, "Máximo 72 caracteres");

const nombreCompleto = z
  .string()
  .trim()
  .min(1, "Escribe el nombre")
  .max(80, "Máximo 80 caracteres");

export const esquemaLogin = z.object({
  usuario: z.string().trim().min(1, "Escribe tu usuario"),
  contrasena: z.string().min(1, "Escribe tu contraseña"),
});

const rolYSede = z.discriminatedUnion("rol", [
  z.object({ rol: z.literal("admin") }),
  z.object({ rol: z.literal("cajero"), sedeId: z.uuid("Escoge una sede") }),
]);

export const esquemaCrearUsuario = z
  .object({ nombreCompleto, nombreUsuario, contrasena })
  .and(rolYSede);

export const esquemaEditarUsuario = z
  .object({ id: z.uuid(), nombreCompleto, activo: z.boolean() })
  .and(rolYSede);

export const esquemaContrasena = z.object({ id: z.uuid(), contrasena });

export type DatosCrearUsuario = z.infer<typeof esquemaCrearUsuario>;
export type DatosEditarUsuario = z.infer<typeof esquemaEditarUsuario>;
