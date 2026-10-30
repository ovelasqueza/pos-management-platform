import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";
import { COOKIE_DISPOSITIVO, encabezadosDispositivo } from "@/lib/dispositivo";

/**
 * Cliente para Server Components y Server Actions, con la sesión del usuario
 * (aplica RLS). Crear uno nuevo por petición.
 */
export async function crearClienteServidor() {
  const almacen = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: encabezadosDispositivo(almacen.get(COOKIE_DISPOSITIVO)?.value) },
    cookies: {
      getAll: () => almacen.getAll(),
      setAll(lista) {
        try {
          lista.forEach(({ name, value, options }) => almacen.set(name, value, options));
        } catch {
          // Llamado desde un Server Component: no puede escribir cookies.
          // El proxy (src/proxy.ts) se encarga de refrescar la sesión.
        }
      },
    },
  });
}
