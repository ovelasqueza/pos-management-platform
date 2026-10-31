"use server";

import { revalidatePath } from "next/cache";
import { requerirAdmin } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { esquemaCrearSede, esquemaEditarSede } from "@/lib/dominio/sede";
import { mensajeDeError } from "@/lib/dominio/errores";
import { erroresPorCampo, exito, type EstadoFormulario } from "@/lib/formularios";

const texto = (f: FormData, k: string) => String(f.get(k) ?? "");

function errorNombre(error: { code?: string; message?: string }): EstadoFormulario {
  if (error.code === "23505") return { campos: { nombre: "Ya existe una sede con ese nombre" } };
  if (error.code === "PGRST204" || error.code === "42703") {
    return { error: "Falta ejecutar la migración del NIT (ver docs/bd/README.md)" };
  }
  return { error: mensajeDeError(error) };
}

export async function crearSede(_: EstadoFormulario, f: FormData): Promise<EstadoFormulario> {
  await requerirAdmin();
  const datos = esquemaCrearSede.safeParse({
    nombre: texto(f, "nombre"),
    nit: texto(f, "nit"),
    tipo: texto(f, "tipo"),
    ciudad: texto(f, "ciudad"),
    direccion: texto(f, "direccion"),
    telefono: texto(f, "telefono"),
  });
  if (!datos.success) return { campos: erroresPorCampo(datos.error.issues) };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("sedes").insert(datos.data);
  if (error) return errorNombre(error);

  revalidatePath("/admin", "layout");
  return exito();
}

export async function editarSede(_: EstadoFormulario, f: FormData): Promise<EstadoFormulario> {
  await requerirAdmin();
  const datos = esquemaEditarSede.safeParse({
    id: texto(f, "id"),
    nombre: texto(f, "nombre"),
    nit: texto(f, "nit"),
    ciudad: texto(f, "ciudad"),
    direccion: texto(f, "direccion"),
    telefono: texto(f, "telefono"),
  });
  if (!datos.success) return { campos: erroresPorCampo(datos.error.issues) };

  const { id, ...cambios } = datos.data;
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("sedes").update(cambios).eq("id", id);
  if (error) return errorNombre(error);

  revalidatePath("/admin", "layout");
  return exito();
}

export async function cambiarEstadoSede(id: string, activa: boolean): Promise<EstadoFormulario> {
  await requerirAdmin();
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("sedes").update({ activa }).eq("id", id);
  if (error) return { error: mensajeDeError(error) };

  revalidatePath("/admin", "layout");
  return exito();
}
