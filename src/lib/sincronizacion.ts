import "server-only";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";

export const CANAL_SINCRONIZACION_CAJA = "pos-sync";
export const EVENTO_ACTUALIZAR_CAJA = "actualizar";

/**
 * Envía un aviso instantáneo por Supabase Realtime Broadcast a todas las cajas abiertas
 * cuando el administrador cambia productos, precios, fotos, papel (80/58 mm) o cierra un turno.
 * No usa polling ni consultas adicionales en reposo.
 */
export async function notificarCajasAbiertas(tipo: "catalogo" | "recargar" = "catalogo"): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            topic: CANAL_SINCRONIZACION_CAJA,
            event: EVENTO_ACTUALIZAR_CAJA,
            payload: { tipo, ts: Date.now() },
          },
        ],
      }),
    });
  } catch {
    // Si falla el aviso en tiempo real, la caja sigue operando con normalidad
  }
}
