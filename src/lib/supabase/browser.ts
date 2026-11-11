import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";
import { ENCABEZADO_DISPOSITIVO, dispositivoNavegador, encabezadosDispositivo } from "@/lib/dispositivo";

const TIMEOUT_PETICION_MS = 12_000;

/**
 * Fetch con timeout automático e inyección garantizada del identificador de equipo
 * en cada petición para que ninguna operación de caja se quede colgada ni pierda el encabezado.
 */
const fetchConGarantia: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers);
  const id = dispositivoNavegador();
  if (id && !headers.has(ENCABEZADO_DISPOSITIVO)) {
    headers.set(ENCABEZADO_DISPOSITIVO, id);
  }
  const signal = init?.signal ?? (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? AbortSignal.timeout(TIMEOUT_PETICION_MS) : undefined);
  return fetch(input, { ...init, headers, signal });
};

/** Cliente para Client Components (caja y campos con guardado automático). Envía el equipo. */
export function crearClienteNavegador() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      headers: encabezadosDispositivo(dispositivoNavegador()),
      fetch: fetchConGarantia,
    },
  });
}
