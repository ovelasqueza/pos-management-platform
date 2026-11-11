import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";

/**
 * Cliente con la clave SECRETA. Salta la RLS: usar solo para auth.admin
 * (crear usuarios, cambiar contraseñas, bloquear sesiones) y siempre después
 * de verificar que quien llama es admin.
 */
export function crearClienteAdmin() {
  const clave = process.env.SUPABASE_SECRET_KEY;
  if (!clave) throw new Error("Falta configurar la variable SUPABASE_SECRET_KEY en Cloudflare (Workers > Configuración > Variables y secretos)");

  return createClient(SUPABASE_URL, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
