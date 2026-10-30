"use server";

import { revalidatePath } from "next/cache";
import { requerirAdmin } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import {
  esquemaCategoria,
  esquemaCrearProducto,
  esquemaEditarProducto,
  validarImagen,
} from "@/lib/dominio/producto";
import { mensajeDeError } from "@/lib/dominio/errores";
import { erroresPorCampo, exito, type EstadoFormulario } from "@/lib/formularios";
import type { TipoSede } from "@/lib/dominio/sede";

const texto = (f: FormData, k: string) => String(f.get(k) ?? "");
const archivo = (f: FormData, k: string) => {
  const v = f.get(k);
  return v instanceof File && v.size > 0 ? v : null;
};
const EXTENSION: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

async function subirImagen(supabase: Cliente, tipo: string, productoId: string, img: File) {
  const path = `${tipo}/${productoId}-${Date.now()}.${EXTENSION[img.type]}`;
  const { error } = await supabase.storage
    .from("productos")
    .upload(path, img, { contentType: img.type, upsert: false });
  return error ? null : path;
}

function errorProducto(error: { code?: string; message?: string }): EstadoFormulario {
  if (error.code === "23505") return { campos: { nombre: "Ya existe un producto con ese nombre" } };
  return { error: mensajeDeError(error) };
}

const refrescar = () => revalidatePath("/admin", "layout");

// ───────────────────────── Productos ─────────────────────────

export async function crearProducto(_: EstadoFormulario, f: FormData): Promise<EstadoFormulario> {
  await requerirAdmin();
  const datos = esquemaCrearProducto.safeParse({
    nombre: texto(f, "nombre"),
    categoriaId: texto(f, "categoriaId"),
    precioReferencia: texto(f, "precioReferencia"),
    tipo: texto(f, "tipo"),
  });
  const img = archivo(f, "imagen");
  const errorImg = validarImagen(img);
  if (!datos.success || errorImg) {
    const campos = datos.success ? {} : erroresPorCampo(datos.error.issues);
    if (errorImg) campos.imagen = errorImg;
    return { campos };
  }

  const d = datos.data;
  const supabase = await crearClienteServidor();
  const { data: creado, error } = await supabase
    .from("productos")
    .insert({ tipo: d.tipo, nombre: d.nombre, categoria_id: d.categoriaId, precio_referencia: d.precioReferencia })
    .select("id")
    .single();
  if (error) return errorProducto(error);

  if (img) {
    const path = await subirImagen(supabase, d.tipo, creado.id, img);
    if (!path) {
      refrescar();
      return { error: "Producto creado, pero la imagen no se pudo subir. Edítalo para intentar de nuevo" };
    }
    await supabase.from("productos").update({ imagen_path: path }).eq("id", creado.id);
  }

  refrescar();
  return exito();
}

export async function editarProducto(_: EstadoFormulario, f: FormData): Promise<EstadoFormulario> {
  await requerirAdmin();
  const datos = esquemaEditarProducto.safeParse({
    id: texto(f, "id"),
    nombre: texto(f, "nombre"),
    categoriaId: texto(f, "categoriaId"),
    precioReferencia: texto(f, "precioReferencia"),
    activo: f.get("activo") === "on",
    aplicarATodas: f.get("aplicarATodas") === "on",
    quitarImagen: f.get("quitarImagen") === "on",
  });
  const img = archivo(f, "imagen");
  const errorImg = validarImagen(img);
  if (!datos.success || errorImg) {
    const campos = datos.success ? {} : erroresPorCampo(datos.error.issues);
    if (errorImg) campos.imagen = errorImg;
    return { campos };
  }

  const d = datos.data;
  const supabase = await crearClienteServidor();
  const { data: actual, error: errorLeer } = await supabase
    .from("productos")
    .select("tipo, imagen_path")
    .eq("id", d.id)
    .single();
  if (errorLeer) return { error: mensajeDeError(errorLeer) };

  let imagenPath: string | null = actual.imagen_path;
  if (img) {
    const nuevo = await subirImagen(supabase, actual.tipo, d.id, img);
    if (!nuevo) return { campos: { imagen: "No se pudo subir la imagen" } };
    imagenPath = nuevo;
  } else if (d.quitarImagen) {
    imagenPath = null;
  }

  const { error } = await supabase
    .from("productos")
    .update({
      nombre: d.nombre,
      categoria_id: d.categoriaId,
      precio_referencia: d.precioReferencia,
      imagen_path: imagenPath,
      activo: d.activo,
    })
    .eq("id", d.id);
  if (error) return errorProducto(error);

  // Borra la imagen anterior si fue reemplazada o quitada
  if (actual.imagen_path && actual.imagen_path !== imagenPath) {
    await supabase.storage.from("productos").remove([actual.imagen_path]);
  }

  if (d.aplicarATodas) {
    const { error: errorAplicar } = await supabase.rpc("aplicar_precio_referencia", { p_producto: d.id });
    if (errorAplicar) {
      refrescar();
      return { error: "Se guardó, pero no se pudo aplicar el precio a las sedes" };
    }
  }

  refrescar();
  return exito();
}

/** Sube o reemplaza solo la foto de un producto (desde la miniatura de la tabla). */
export async function cambiarImagenProducto(f: FormData): Promise<EstadoFormulario> {
  await requerirAdmin();
  const id = texto(f, "id");
  const img = archivo(f, "imagen");
  if (!img) return { error: "Escoge una imagen" };
  const errorImg = validarImagen(img);
  if (errorImg) return { error: errorImg };

  const supabase = await crearClienteServidor();
  const { data: actual, error: errorLeer } = await supabase.from("productos").select("tipo, imagen_path").eq("id", id).single();
  if (errorLeer) return { error: mensajeDeError(errorLeer) };

  const path = await subirImagen(supabase, actual.tipo, id, img);
  if (!path) return { error: "No se pudo subir la imagen" };

  const { error } = await supabase.from("productos").update({ imagen_path: path }).eq("id", id);
  if (error) return { error: mensajeDeError(error) };
  if (actual.imagen_path) await supabase.storage.from("productos").remove([actual.imagen_path]);

  refrescar();
  return exito();
}

export async function cambiarEstadoProducto(id: string, activo: boolean): Promise<EstadoFormulario> {
  await requerirAdmin();
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("productos").update({ activo }).eq("id", id);
  if (error) return { error: mensajeDeError(error) };
  refrescar();
  return exito();
}

export async function eliminarProducto(id: string): Promise<EstadoFormulario> {
  await requerirAdmin();
  const supabase = await crearClienteServidor();
  const { data: actual } = await supabase.from("productos").select("imagen_path").eq("id", id).single();
  const { error } = await supabase.from("productos").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") return { error: "Tiene ventas o inventarios. Desactívalo en vez de eliminarlo" };
    return { error: mensajeDeError(error) };
  }
  if (actual?.imagen_path) await supabase.storage.from("productos").remove([actual.imagen_path]);
  refrescar();
  return exito();
}

// ───────────────────────── Categorías ─────────────────────────

export async function crearCategoria(tipo: TipoSede, nombre: string): Promise<EstadoFormulario> {
  await requerirAdmin();
  const datos = esquemaCategoria.safeParse({ nombre });
  if (!datos.success) return { error: datos.error.issues[0]?.message };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("categorias").insert({ tipo, nombre: datos.data.nombre });
  if (error) return { error: error.code === "23505" ? "Ya existe esa categoría" : mensajeDeError(error) };
  refrescar();
  return exito();
}

export async function renombrarCategoria(id: string, nombre: string): Promise<EstadoFormulario> {
  await requerirAdmin();
  const datos = esquemaCategoria.safeParse({ nombre });
  if (!datos.success) return { error: datos.error.issues[0]?.message };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("categorias").update({ nombre: datos.data.nombre }).eq("id", id);
  if (error) return { error: error.code === "23505" ? "Ya existe esa categoría" : mensajeDeError(error) };
  refrescar();
  return exito();
}

export async function eliminarCategoria(id: string): Promise<EstadoFormulario> {
  await requerirAdmin();
  const supabase = await crearClienteServidor();
  const { count } = await supabase
    .from("productos")
    .select("id", { count: "exact", head: true })
    .eq("categoria_id", id);
  if (count && count > 0) {
    return { error: `Tiene ${count} producto${count === 1 ? "" : "s"}. Cámbialos de categoría primero` };
  }
  const { error } = await supabase.from("categorias").delete().eq("id", id);
  if (error) return { error: mensajeDeError(error) };
  refrescar();
  return exito();
}
