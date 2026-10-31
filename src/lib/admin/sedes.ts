import "server-only";
import { cache } from "react";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ordenarSedes, type TipoSede } from "@/lib/dominio/sede";

export type Sede = {
  id: string;
  nombre: string;
  tipo: TipoSede;
  ciudad: string | null;
  direccion: string | null;
  telefono: string | null;
  activa: boolean;
};

export const TODAS = "todas";

/** Todas las sedes en el orden del selector (activas primero, alfabético). */
export const listarSedes = cache(async (): Promise<Sede[]> => {
  const supabase = await crearClienteServidor();
  let { data, error } = await supabase.from("sedes").select("id, nombre, tipo, ciudad, direccion, telefono, activa");
  // Respaldo mientras no se ejecute la migración 10 (columna ciudad)
  if (error?.code === "42703") {
    ({ data, error } = await supabase.from("sedes").select("id, nombre, tipo, direccion, telefono, activa"));
  }
  if (error) throw new Error(`No se pudieron cargar las sedes: ${error.message}`);
  return ordenarSedes((data as Omit<Sede, "ciudad">[] as Sede[]).map((s) => ({ ...s, ciudad: s.ciudad ?? null })));
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
