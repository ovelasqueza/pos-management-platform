import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";
import { dispositivoNavegador, encabezadosDispositivo } from "@/lib/dispositivo";

/** Cliente para Client Components (caja y campos con guardado automático). Envía el equipo. */
export function crearClienteNavegador() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: encabezadosDispositivo(dispositivoNavegador()) },
  });
}
