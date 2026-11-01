"use server";

import { revalidatePath } from "next/cache";
import { requerirAdmin } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { mensajeDeError } from "@/lib/dominio/errores";
import { esquemaCrearArticulo, esquemaDatosInventario, esquemaEditarArticulo } from "@/lib/dominio/inventario";
import { erroresPorCampo, exito, type EstadoFormulario } from "@/lib/formularios";

const texto = (f: FormData, k: string) => String(f.get(k) ?? "");
const refrescar = () => revalidatePath("/admin", "layout");

type Resultado = { error?: string };

// ─────────────── Materias primas (en la BD: articulos_inventario) ───────────────

function errorArticulo(error: { code?: string; message?: string }): EstadoFormulario {
  if (error.code === "23505") return { campos: { nombre: "Ya existe una materia prima con ese nombre en esta sede" } };
  return { error: mensajeDeError(error) };
}

export async function crearArticulo(_: EstadoFormulario, f: FormData): Promise<EstadoFormulario> {
  await requerirAdmin();
  const datos = esquemaCrearArticulo.safeParse({
    sedeId: texto(f, "sedeId"),
    nombre: texto(f, "nombre"),
    unidad: texto(f, "unidad"),
    costo: texto(f, "costo"),
  });
  if (!datos.success) return { campos: erroresPorCampo(datos.error.issues) };

  const { sedeId, ...resto } = datos.data;
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("articulos_inventario").insert({ sede_id: sedeId, ...resto });
  if (error) return errorArticulo(error);
  refrescar();
  return exito();
}

export async function editarArticulo(_: EstadoFormulario, f: FormData): Promise<EstadoFormulario> {
  await requerirAdmin();
  const datos = esquemaEditarArticulo.safeParse({
    id: texto(f, "id"),
    nombre: texto(f, "nombre"),
    unidad: texto(f, "unidad"),
  });
  if (!datos.success) return { campos: erroresPorCampo(datos.error.issues) };

  const { id, ...cambios } = datos.data;
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("articulos_inventario").update(cambios).eq("id", id);
  if (error) return errorArticulo(error);
  refrescar();
  return exito();
}

export async function cambiarEstadoArticulo(id: string, activo: boolean): Promise<Resultado> {
  await requerirAdmin();
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("articulos_inventario").update({ activo }).eq("id", id);
  if (error) return { error: mensajeDeError(error) };
  refrescar();
  return {};
}

// ───────────────────────── Inventarios ─────────────────────────

/** Crea el inventario y devuelve su id para abrirlo. */
export async function crearInventario(sedeId: string, fecha: string, nota: string): Promise<Resultado & { id?: string }> {
  await requerirAdmin();
  const datos = esquemaDatosInventario.safeParse({ fecha, nota });
  if (!datos.success) return { error: datos.error.issues[0]?.message };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("inv_crear", {
    p_sede: sedeId,
    p_fecha: datos.data.fecha,
    p_nota: datos.data.nota,
  });
  if (error) return { error: mensajeDeError(error, "No se pudo crear el inventario") };
  refrescar();
  return { id: data as string };
}

export async function editarDatosInventario(id: string, fecha: string, nota: string): Promise<Resultado> {
  await requerirAdmin();
  const datos = esquemaDatosInventario.safeParse({ fecha, nota });
  if (!datos.success) return { error: datos.error.issues[0]?.message };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("inv_editar", { p_inventario: id, p_fecha: datos.data.fecha, p_nota: datos.data.nota });
  if (error) return { error: mensajeDeError(error) };
  refrescar();
  return {};
}

async function ejecutar(rpc: string, id: string, porDefecto: string): Promise<Resultado> {
  await requerirAdmin();
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc(rpc, { p_inventario: id });
  if (error) return { error: mensajeDeError(error, porDefecto) };
  refrescar();
  return {};
}

export const actualizarCostos = async (id: string) => ejecutar("inv_actualizar_costos", id, "No se pudieron actualizar los costos");
export const finalizarInventario = async (id: string) => ejecutar("inv_finalizar", id, "No se pudo finalizar");
export const reabrirInventario = async (id: string) => ejecutar("inv_reabrir", id, "No se pudo abrir para editar");
export const borrarInventario = async (id: string) => ejecutar("inv_borrar", id, "No se pudo borrar");
