"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requerirCajero } from "@/lib/sesion";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { COOKIE_DISPOSITIVO, DURACION_COOKIE, esDispositivoValido } from "@/lib/dispositivo";
import { nuevoUUID } from "@/lib/uuid";

export type ResultadoAbrirTurno = {
  ok: boolean;
  error?: string;
  ocupada?: boolean;
};

export async function abrirTurnoAction(): Promise<ResultadoAbrirTurno> {
  try {
    const cajero = await requerirCajero();
    const cookieStore = await cookies();
    let dispositivo = cookieStore.get(COOKIE_DISPOSITIVO)?.value;

    if (!esDispositivoValido(dispositivo)) {
      dispositivo = nuevoUUID();
      try {
        cookieStore.set(COOKIE_DISPOSITIVO, dispositivo, {
          path: "/",
          maxAge: DURACION_COOKIE,
          sameSite: "lax",
        });
      } catch {
        // Ignorar si el contexto no permite setear cookie
      }
    }

    const admin = crearClienteAdmin({
      "x-pos-dispositivo": dispositivo,
    });

    // 1. ¿Ya tiene turno abierto este cajero?
    const { data: existente } = await admin
      .from("turnos")
      .select("id")
      .eq("cajero_id", cajero.id)
      .is("cerrado_en", null)
      .maybeSingle();

    if (existente) {
      revalidatePath("/caja");
      return { ok: true };
    }

    // 2. ¿Caja ocupada por otro cajero en esta sede?
    const { data: ocupada } = await admin
      .from("turnos")
      .select("id")
      .eq("sede_id", cajero.sede.id)
      .is("cerrado_en", null)
      .maybeSingle();

    if (ocupada) {
      revalidatePath("/caja");
      return { ok: false, ocupada: true };
    }

    // 3. Crear el turno
    const { error } = await admin.from("turnos").insert({
      sede_id: cajero.sede.id,
      cajero_id: cajero.id,
      base: 0,
      dispositivo: dispositivo,
    });

    if (error) {
      // Si el error es por turno ya abierto (por concurrencia / unique index)
      if (error.code === "23505") {
        revalidatePath("/caja");
        return { ok: true };
      }
      return { ok: false, error: error.message || "No se pudo abrir el turno" };
    }

    revalidatePath("/caja");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error inesperado al abrir turno" };
  }
}
