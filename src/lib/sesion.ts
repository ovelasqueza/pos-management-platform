import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { normalizarAnchoPapel, type AnchoPapel } from "@/lib/impresion/papel";

export type Perfil = {
  id: string;
  nombreCompleto: string;
  nombreUsuario: string;
  rol: "cajero" | "admin";
  activo: boolean;
  sede: { id: string; nombre: string; tipo: "panaderia" | "asadero"; activa: boolean; anchoPapel: AnchoPapel } | null;
};

type FilaPerfil = {
  id: string;
  nombre_completo: string;
  nombre_usuario: string;
  rol: "cajero" | "admin";
  activo: boolean;
  sede: { id: string; nombre: string; tipo: "panaderia" | "asadero"; activa: boolean; ancho_papel?: number | null } | null;
};

/**
 * Perfil del usuario de la petición (una sola consulta por render gracias a cache).
 * Devuelve null si no hay sesión válida.
 */
export const obtenerPerfil = cache(async (): Promise<Perfil | null> => {
  const supabase = await crearClienteServidor();
  const { data: auth } = await supabase.auth.getClaims();
  const uid = auth?.claims?.sub;
  if (!uid) return null;

  const inicial = await supabase
    .from("perfiles")
    .select("id, nombre_completo, nombre_usuario, rol, activo, sede:sedes(id, nombre, tipo, activa, ancho_papel)")
    .eq("id", uid)
    .maybeSingle<FilaPerfil>();
  let data = inicial.data;
  if (inicial.error) {
    ({ data } = await supabase
      .from("perfiles")
      .select("id, nombre_completo, nombre_usuario, rol, activo, sede:sedes(id, nombre, tipo, activa)")
      .eq("id", uid)
      .maybeSingle<FilaPerfil>());
  }
  if (!data) return null;

  return {
    id: data.id,
    nombreCompleto: data.nombre_completo,
    nombreUsuario: data.nombre_usuario,
    rol: data.rol,
    activo: data.activo,
    sede: data.sede
      ? {
          id: data.sede.id,
          nombre: data.sede.nombre,
          tipo: data.sede.tipo,
          activa: data.sede.activa,
          anchoPapel: normalizarAnchoPapel(data.sede.ancho_papel),
        }
      : null,
  };
});

/** Ruta de inicio según el rol. */
export function inicioDe(perfil: Perfil): string {
  return perfil.rol === "admin" ? "/admin" : "/caja";
}

/** Exige un usuario activo; si no, lo saca a /login. */
export async function requerirUsuario(): Promise<Perfil> {
  const perfil = await obtenerPerfil();
  if (!perfil) redirect("/salir");
  if (!perfil.activo) redirect("/salir?motivo=inactivo");
  return perfil;
}

export async function requerirAdmin(): Promise<Perfil> {
  const perfil = await requerirUsuario();
  if (perfil.rol !== "admin") redirect(inicioDe(perfil));
  return perfil;
}

export async function requerirCajero(): Promise<Perfil & { sede: NonNullable<Perfil["sede"]> }> {
  const perfil = await requerirUsuario();
  if (perfil.rol !== "cajero") redirect(inicioDe(perfil));
  if (!perfil.sede?.activa) redirect("/salir?motivo=sede-inactiva");
  return perfil as Perfil & { sede: NonNullable<Perfil["sede"]> };
}
