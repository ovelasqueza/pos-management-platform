import type { SupabaseClient } from "@supabase/supabase-js";
import { urlImagen } from "@/lib/supabase/storage";
import type { ProductoVendible } from "@/lib/dominio/carrito";

type FilaVendible = {
  id: string;
  nombre: string;
  categoria_id: string | null;
  categoria: string | null;
  imagen_path: string | null;
  precio_venta: number;
};

/** Productos vendibles de la sede del cajero (la RLS filtra la sede). Sirve en servidor y navegador. */
export async function cargarProductosVendibles(supabase: SupabaseClient): Promise<ProductoVendible[]> {
  const { data, error } = await supabase
    .from("productos_vendibles")
    .select("id, nombre, categoria_id, categoria, imagen_path, precio_venta")
    .returns<FilaVendible[]>();
  if (error) throw error;
  return data
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      categoriaId: p.categoria_id,
      categoria: p.categoria,
      imagenUrl: urlImagen(p.imagen_path),
      precio: p.precio_venta,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es-CO", { sensitivity: "base" }));
}
