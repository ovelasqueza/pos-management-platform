"use server";

import { revalidatePath } from "next/cache";
import { requerirAdmin } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { mensajeDeError } from "@/lib/dominio/errores";
import type { DatosReporte } from "@/lib/dominio/documentos";

/** Cierre de un turno abierto por el admin (mismos cálculos que el cajero). */
export async function cerrarTurnoAdmin(
  turnoId: string,
  contado: number,
): Promise<{ reporte?: DatosReporte; error?: string }> {
  await requerirAdmin();
  if (!Number.isInteger(contado) || contado < 0) return { error: "Escribe el efectivo contado" };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("cerrar_turno", { p_turno: turnoId, p_contado: contado });
  if (error) return { error: mensajeDeError(error, "No se pudo cerrar el turno") };

  revalidatePath("/admin", "layout");
  return { reporte: data as DatosReporte };
}
