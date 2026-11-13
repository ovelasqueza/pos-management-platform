import type { SupabaseClient } from "@supabase/supabase-js";
import { urlImagen } from "@/lib/supabase/storage";
import type { ProductoVendible } from "@/lib/dominio/carrito";
import type { ModalidadProducto } from "@/lib/dominio/producto";

type FilaVendible = {
  id: string;
  nombre: string;
  categoria_id: string | null;
  categoria: string | null;
  imagen_path: string | null;
  precio_venta: number;
  modalidad?: ModalidadProducto | null;
};

/** Productos vendibles de la sede del cajero (la RLS filtra la sede). Sirve en servidor y navegador. */
export async function cargarProductosVendibles(supabase: SupabaseClient): Promise<ProductoVendible[]> {
  let { data, error } = await supabase
    .from("productos_vendibles")
    .select("id, nombre, categoria_id, categoria, imagen_path, precio_venta, modalidad")
    .order("nombre", { ascending: true })
    .returns<FilaVendible[]>();

  // Respaldo si aún no se ha aplicado la migración de modalidad en BD
  if (error?.code === "42703") {
    ({ data, error } = await supabase
      .from("productos_vendibles")
      .select("id, nombre, categoria_id, categoria, imagen_path, precio_venta")
      .order("nombre", { ascending: true })
      .returns<FilaVendible[]>());
  }

  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    categoriaId: p.categoria_id,
    categoria: p.categoria,
    imagenUrl: urlImagen(p.imagen_path),
    precio: p.precio_venta,
    modalidad: p.modalidad ?? null,
  }));
}
