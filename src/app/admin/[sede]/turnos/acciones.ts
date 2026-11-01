"use server";

import { revalidatePath } from "next/cache";
import { requerirAdmin } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { mensajeDeError } from "@/lib/dominio/errores";
import type { DatosReporte } from "@/lib/dominio/documentos";

/**
 * Cierre de un turno abierto por el admin (mismos cálculos que el cajero).
 * aMayor: efectivo contado que va a la caja mayor (spec 06).
 */
export async function cerrarTurnoAdmin(
  turnoId: string,
  contado: number,
  aMayor = 0,
): Promise<{ reporte?: DatosReporte; error?: string }> {
  await requerirAdmin();
  if (!Number.isInteger(contado) || contado < 0) return { error: "Escribe el efectivo contado" };
  if (!Number.isInteger(aMayor) || aMayor < 0 || aMayor > contado) return { error: "A caja mayor no puede ser más que lo contado" };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("cerrar_turno", { p_turno: turnoId, p_contado: contado, p_a_mayor: aMayor });
  if (error) return { error: mensajeDeError(error, "No se pudo cerrar el turno") };

  revalidatePath("/admin", "layout");
  return { reporte: data as DatosReporte };
}
