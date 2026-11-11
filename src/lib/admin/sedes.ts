import "server-only";
import { cache } from "react";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ordenarSedes, type TipoSede } from "@/lib/dominio/sede";
import { normalizarAnchoPapel, type AnchoPapel } from "@/lib/impresion/papel";

export type Sede = {
  id: string;
  nombre: string;
  nit: string | null;
  tipo: TipoSede;
  ciudad: string | null;
  direccion: string | null;
  telefono: string | null;
  ancho_papel: AnchoPapel;
  activa: boolean;
};

export const TODAS = "todas";

/** Todas las sedes en el orden del selector (activas primero, alfabético). */
export const listarSedes = cache(async (): Promise<Sede[]> => {
  const supabase = await crearClienteServidor();
  let { data, error } = await supabase
    .from("sedes")
    .select("id, nombre, nit, tipo, ciudad, direccion, telefono, ancho_papel, activa");
  // Respaldo mientras no se ejecute la migración de ancho_papel o nit
  if (error?.code === "42703" || error?.code === "PGRST204") {
    ({ data, error } = await supabase.from("sedes").select("id, nombre, nit, tipo, ciudad, direccion, telefono, activa"));
  }
  if (error?.code === "42703" || error?.code === "PGRST204") {
    ({ data, error } = await supabase.from("sedes").select("id, nombre, tipo, ciudad, direccion, telefono, activa"));
  }
  if (error) throw new Error(`No se pudieron cargar las sedes: ${error.message}`);
  return ordenarSedes(
    (data as Partial<Sede>[] as Sede[]).map((s) => ({
      ...s,
      nit: s.nit ?? null,
      ancho_papel: normalizarAnchoPapel(s.ancho_papel),
    })),
  );
});

/**
 * Resuelve el segmento [sede] de la URL: "todas" → null; un id válido → la sede.
 * Devuelve undefined si no existe.
 */
export async function resolverSede(segmento: string): Promise<Sede | null | undefined> {
  if (segmento === TODAS) return null;
  const sedes = await listarSedes();
  return sedes.find((s) => s.id === segmento);
}
