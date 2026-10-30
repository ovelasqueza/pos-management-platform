"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { crearClienteServidor } from "@/lib/supabase/server";
import { correoInterno, esquemaLogin } from "@/lib/dominio/usuario";
import { COOKIE_DISPOSITIVO } from "@/lib/dispositivo";

const MENSAJE_OTRO_EQUIPO = "Tienes un turno abierto en otro equipo. Ciérralo allí o pide al administrador que lo cierre";

export type EstadoLogin = { error?: string; usuario?: string };

export async function iniciarSesion(_previo: EstadoLogin, formulario: FormData): Promise<EstadoLogin> {
  const datos = esquemaLogin.safeParse({
    usuario: formulario.get("usuario"),
    contrasena: formulario.get("contrasena"),
  });
  const usuario = String(formulario.get("usuario") ?? "");
  if (!datos.success) return { error: "Escribe tu usuario y contraseña", usuario };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: correoInterno(datos.data.usuario),
    password: datos.data.contrasena,
  });

  if (error) {
    // Los usuarios desactivados quedan bloqueados (ban) en Auth.
    if (error.code === "user_banned") return { error: "Usuario inactivo", usuario };
    return { error: "Usuario o contraseña incorrectos", usuario };
  }

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol, activo")
    .eq("id", data.user.id)
    .maybeSingle<{ rol: "admin" | "cajero"; activo: boolean }>();

  if (!perfil?.activo) {
    await supabase.auth.signOut();
    return { error: perfil ? "Usuario inactivo" : "Usuario o contraseña incorrectos", usuario };
  }

  // Un cajero con turno abierto solo puede entrar desde el equipo donde lo abrió
  if (perfil.rol === "cajero") {
    const equipo = (await cookies()).get(COOKIE_DISPOSITIVO)?.value ?? null;
    const { data: turno } = await supabase
      .from("turnos")
      .select("dispositivo")
      .eq("cajero_id", data.user.id)
      .is("cerrado_en", null)
      .maybeSingle<{ dispositivo: string | null }>();
    if (turno?.dispositivo && turno.dispositivo !== equipo) {
      await supabase.auth.signOut();
      return { error: MENSAJE_OTRO_EQUIPO, usuario };
    }
  }

  redirect(perfil.rol === "admin" ? "/admin" : "/caja");
}
