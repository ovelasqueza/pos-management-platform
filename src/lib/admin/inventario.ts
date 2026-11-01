import "server-only";
import { crearClienteServidor } from "@/lib/supabase/server";
import { esUnidad, lineaDesdeBD, type LineaInventario, type Unidad } from "@/lib/dominio/inventario";
import type { TipoSede } from "@/lib/dominio/sede";

export type Articulo = { id: string; nombre: string; unidad: Unidad; costo: number | null; activo: boolean };

export type ResumenInventario = {
  id: string;
  sedeId: string;
  fecha: string;
  nota: string | null;
  estado: "en_curso" | "finalizado";
  modificadoEn: string;
  modificadoPor: string | null;
  finalizadoEn: string | null;
  finalizadoPor: string | null;
  totalProductos: number;
  totalArticulos: number;
  total: number;
  lineas: number;
  sinCosto: number;
};

type FilaResumen = {
  id: string;
  sede_id: string;
  fecha: string;
  nota: string | null;
  estado: "en_curso" | "finalizado";
  modificado_en: string;
  modificado_por: string | null;
  finalizado_en: string | null;
  finalizado_por: string | null;
  total_productos: number | string;
  total_articulos: number | string;
  total: number | string;
  lineas: number;
  sin_costo: number;
};

const aResumen = (f: FilaResumen): ResumenInventario => ({
  id: f.id,
  sedeId: f.sede_id,
  fecha: f.fecha,
  nota: f.nota,
  estado: f.estado,
  modificadoEn: f.modificado_en,
  modificadoPor: f.modificado_por,
  finalizadoEn: f.finalizado_en,
  finalizadoPor: f.finalizado_por,
  totalProductos: Number(f.total_productos),
  totalArticulos: Number(f.total_articulos),
  total: Number(f.total),
  lineas: f.lineas,
  sinCosto: f.sin_costo,
});

const porNombre = (a: { nombre: string }, b: { nombre: string }) =>
  a.nombre.localeCompare(b.nombre, "es-CO", { sensitivity: "base" });

/** Inventarios del más reciente al más antiguo; sin sede = todos. */
export async function listarInventarios(sedeId?: string): Promise<ResumenInventario[]> {
  const supabase = await crearClienteServidor();
  let q = supabase.from("inventarios_resumen").select("*").order("fecha", { ascending: false });
  if (sedeId) q = q.eq("sede_id", sedeId);
  const { data, error } = await q.returns<FilaResumen[]>();
  if (error) throw new Error(`No se pudieron cargar los inventarios: ${error.message}`);
  return data.map(aResumen);
}

export async function obtenerInventario(
  id: string,
): Promise<{ resumen: ResumenInventario; lineas: LineaInventario[] } | null> {
  const supabase = await crearClienteServidor();
  const [r, l] = await Promise.all([
    supabase.from("inventarios_resumen").select("*").eq("id", id).maybeSingle<FilaResumen>(),
    supabase
      .from("lineas_inventario")
      .select("id, producto_id, articulo_id, nombre, unidad, cantidad, costo, valor")
      .eq("inventario_id", id),
  ]);
  if (r.error || l.error) throw new Error(`No se pudo cargar el inventario: ${(r.error ?? l.error)?.message}`);
  if (!r.data) return null;
  return { resumen: aResumen(r.data), lineas: l.data.map(lineaDesdeBD) };
}

/** Artículos de la sede: activos primero, alfabético. */
export async function listarArticulos(sedeId: string): Promise<Articulo[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("articulos_inventario")
    .select("id, nombre, unidad, costo, activo")
    .eq("sede_id", sedeId);
  if (error) throw new Error(`No se pudieron cargar las materias primas: ${error.message}`);
  return data
    .map((a) => ({ ...a, unidad: esUnidad(a.unidad) ? a.unidad : "unidad" }) as Articulo)
    .sort((a, b) => Number(b.activo) - Number(a.activo) || porNombre(a, b));
}

export type Candidato = { tipo: "producto" | "articulo"; id: string; nombre: string; detalle: string };

/** Lo que se puede agregar a un inventario: todo el catálogo de la sede y sus artículos. */
export async function listarCandidatos(sedeId: string, tipo: TipoSede): Promise<Candidato[]> {
  const supabase = await crearClienteServidor();
  const [p, a] = await Promise.all([
    supabase.from("productos").select("id, nombre, activo").eq("tipo", tipo),
    supabase.from("articulos_inventario").select("id, nombre, unidad, activo").eq("sede_id", sedeId),
  ]);
  if (p.error || a.error) throw new Error(`No se pudo cargar el catálogo: ${(p.error ?? a.error)?.message}`);
  return [
    ...p.data.map((x) => ({
      tipo: "producto" as const,
      id: x.id,
      nombre: x.nombre,
      detalle: x.activo ? "Producto" : "Producto inactivo",
    })),
    ...a.data.map((x) => ({
      tipo: "articulo" as const,
      id: x.id,
      nombre: x.nombre,
      detalle: `Materia prima · ${x.unidad}${x.activo ? "" : " · inactivo"}`,
    })),
  ].sort(porNombre);
}
