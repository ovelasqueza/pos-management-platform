"use server";

import { revalidatePath } from "next/cache";
import { requerirAdmin } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { mensajeDeError } from "@/lib/dominio/errores";
import { MAXIMO_PESOS } from "@/lib/dominio/dinero";
import type { MetodoPago } from "@/lib/dominio/cobro";

export type Operacion = "sumar" | "quitar" | "fijar";

const PARTES: MetodoPago[] = ["efectivo", "transferencia", "tarjeta"];

/** Movimiento manual del admin en la caja mayor de una sede. */
export async function moverCajaMayor(datos: {
  sedeId: string;
  parte: MetodoPago;
  operacion: Operacion;
  monto: number;
  descripcion: string;
}): Promise<{ error?: string; campo?: "monto" | "descripcion" }> {
  await requerirAdmin();
  const { sedeId, parte, operacion, monto } = datos;
  const descripcion = datos.descripcion.trim();
  if (!PARTES.includes(parte)) return { error: "Escoge la parte" };
  const minimo = operacion === "fijar" ? 0 : 1;
  if (!Number.isInteger(monto) || monto < minimo || monto > MAXIMO_PESOS) return { error: "Escribe un monto válido", campo: "monto" };
  if (descripcion.length < 1 || descripcion.length > 120) return { error: "Escribe una descripción", campo: "descripcion" };

  const supabase = await crearClienteServidor();
  const { error } =
    operacion === "fijar"
      ? await supabase.rpc("caja_mayor_fijar", { p_sede: sedeId, p_parte: parte, p_saldo: monto, p_descripcion: descripcion })
      : await supabase.rpc("caja_mayor_ajustar", {
          p_sede: sedeId,
          p_parte: parte,
          p_monto: operacion === "sumar" ? monto : -monto,
          p_descripcion: descripcion,
        });
  if (error) {
    const msg = mensajeDeError(error, "No se pudo guardar");
    return { error: msg, campo: msg.includes("caja mayor") ? "monto" : undefined };
  }
  revalidatePath("/admin", "layout");
  return {};
}
