import "server-only";
import { crearClienteServidor } from "@/lib/supabase/server";
import { urlImagen } from "@/lib/supabase/storage";
import type { TipoSede } from "@/lib/dominio/sede";

export type Categoria = { id: string; nombre: string; productos: number };

export type Producto = {
  id: string;
  nombre: string;
  categoriaId: string | null;
  categoria: string | null;
  precioReferencia: number;
  imagenUrl: string | null;
  activo: boolean;
};

const porNombre = (a: { nombre: string }, b: { nombre: string }) =>
  a.nombre.localeCompare(b.nombre, "es-CO", { sensitivity: "base" });

export async function listarCategorias(tipo: TipoSede): Promise<Categoria[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("categorias")
    .select("id, nombre, productos(count)")
    .eq("tipo", tipo)
    .returns<{ id: string; nombre: string; productos: { count: number }[] }[]>();
  if (error) throw new Error(`No se pudieron cargar las categorías: ${error.message}`);
  return data
    .map((c) => ({ id: c.id, nombre: c.nombre, productos: c.productos[0]?.count ?? 0 }))
    .sort(porNombre);
}

export async function listarProductos(tipo: TipoSede): Promise<Producto[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("productos")
    .select("id, nombre, categoria_id, precio_referencia, imagen_path, activo, categoria:categorias(nombre)")
    .eq("tipo", tipo)
    .returns<
      {
        id: string;
        nombre: string;
        categoria_id: string | null;
        precio_referencia: number;
        imagen_path: string | null;
        activo: boolean;
        categoria: { nombre: string } | null;
      }[]
    >();
  if (error) throw new Error(`No se pudieron cargar los productos: ${error.message}`);
  return data
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      categoriaId: p.categoria_id,
      categoria: p.categoria?.nombre ?? null,
      precioReferencia: p.precio_referencia,
      imagenUrl: urlImagen(p.imagen_path),
      activo: p.activo,
    }))
    .sort((a, b) => Number(b.activo) - Number(a.activo) || porNombre(a, b));
}

export type FilaProductoSede = {
  productoId: string;
  nombre: string;
  categoriaId: string | null;
  categoria: string | null;
  imagenUrl: string | null;
  precioReferencia: number;
  activo: boolean;
  habilitado: boolean;
  precioVenta: number;
  costo: number | null;
};

/** Productos del catálogo de una sede con sus datos, habilitación, precio de venta y costo. */
export async function listarProductosSede(sedeId: string): Promise<FilaProductoSede[]> {
  const supabase = await crearClienteServidor();
  const [precios, costos] = await Promise.all([
    supabase
      .from("productos_sede")
      .select(
        "producto_id, habilitado, precio_venta, producto:productos(nombre, activo, categoria_id, precio_referencia, imagen_path, categoria:categorias(nombre))",
      )
      .eq("sede_id", sedeId)
      .returns<
        {
          producto_id: string;
          habilitado: boolean;
          precio_venta: number;
          producto: {
            nombre: string;
            activo: boolean;
            categoria_id: string | null;
            precio_referencia: number;
            imagen_path: string | null;
            categoria: { nombre: string } | null;
          };
        }[]
      >(),
    supabase.from("costos_producto_sede").select("producto_id, costo").eq("sede_id", sedeId),
  ]);
  if (precios.error) throw new Error(`No se pudieron cargar los productos: ${precios.error.message}`);
  if (costos.error) throw new Error(`No se pudieron cargar los costos: ${costos.error.message}`);

  const costoDe = new Map(costos.data.map((c) => [c.producto_id as string, c.costo as number]));

  return precios.data
    .map((p) => ({
      productoId: p.producto_id,
      nombre: p.producto.nombre,
      categoriaId: p.producto.categoria_id,
      categoria: p.producto.categoria?.nombre ?? null,
      imagenUrl: urlImagen(p.producto.imagen_path),
      precioReferencia: p.producto.precio_referencia,
      activo: p.producto.activo,
      habilitado: p.habilitado,
      precioVenta: p.precio_venta,
      costo: costoDe.get(p.producto_id) ?? null,
    }))
    .sort((a, b) => Number(b.activo) - Number(a.activo) || porNombre(a, b));
}
