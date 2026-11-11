"use server";

import { revalidatePath } from "next/cache";
import { requerirAdmin } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { esquemaCrearSede, esquemaEditarSede } from "@/lib/dominio/sede";
import { normalizarAnchoPapel } from "@/lib/impresion/papel";
import { mensajeDeError } from "@/lib/dominio/errores";
import { erroresPorCampo, exito, type EstadoFormulario } from "@/lib/formularios";

const texto = (f: FormData, k: string) => String(f.get(k) ?? "");

function errorNombre(error: { code?: string; message?: string }): EstadoFormulario {
  if (error.code === "23505") return { campos: { nombre: "Ya existe una sede con ese nombre" } };
  if (error.code === "PGRST204" || error.code === "42703") {
    return { error: "Falta ejecutar la migración en Supabase (ver supabase/migrations)" };
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
    ancho_papel: texto(f, "ancho_papel") || "80",
  });
  if (!datos.success) return { campos: erroresPorCampo(datos.error.issues) };

  const supabase = await crearClienteServidor();
  let { error } = await supabase.from("sedes").insert(datos.data);
  if (error) {
    const { ancho_papel: _omitir, ...sinAncho } = datos.data;
    void _omitir;
    ({ error } = await supabase.from("sedes").insert(sinAncho));
  }
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
    ancho_papel: texto(f, "ancho_papel") || "80",
  });
  if (!datos.success) return { campos: erroresPorCampo(datos.error.issues) };

  const { id, ...cambios } = datos.data;
  const supabase = await crearClienteServidor();
  let { error } = await supabase.from("sedes").update(cambios).eq("id", id);
  if (error) {
    const { ancho_papel: _omitir, ...sinAncho } = cambios;
    void _omitir;
    ({ error } = await supabase.from("sedes").update(sinAncho).eq("id", id));
  }
  if (error) return errorNombre(error);

  revalidatePath("/admin", "layout");
  return exito();
}

export async function cambiarAnchoPapelSede(id: string, ancho: number): Promise<EstadoFormulario> {
  await requerirAdmin();
  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("sedes")
    .update({ ancho_papel: normalizarAnchoPapel(ancho) })
    .eq("id", id);
  if (error && error.code !== "PGRST204" && error.code !== "42703") {
    return { error: mensajeDeError(error) };
  }

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
