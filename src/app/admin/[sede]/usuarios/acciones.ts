"use server";

import { revalidatePath } from "next/cache";
import { requerirAdmin } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import {
  correoInterno,
  esquemaContrasena,
  esquemaCrearUsuario,
  esquemaEditarUsuario,
} from "@/lib/dominio/usuario";
import { mensajeDeError } from "@/lib/dominio/errores";
import { erroresPorCampo, exito, type EstadoFormulario } from "@/lib/formularios";

const texto = (f: FormData, k: string) => String(f.get(k) ?? "");
// Bloqueo "permanente" en Auth para usuarios inactivos (100 años)
const BLOQUEO = "876000h";

async function sedeActiva(sedeId: string): Promise<boolean> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("sedes").select("activa").eq("id", sedeId).maybeSingle();
  return Boolean(data?.activa);
}

export async function crearUsuario(_: EstadoFormulario, f: FormData): Promise<EstadoFormulario> {
  try {
    await requerirAdmin();
    const datos = esquemaCrearUsuario.safeParse({
      nombreCompleto: texto(f, "nombreCompleto"),
      nombreUsuario: texto(f, "nombreUsuario"),
      contrasena: texto(f, "contrasena"),
      rol: texto(f, "rol"),
      sedeId: texto(f, "sedeId") || undefined,
    });
    if (!datos.success) return { campos: erroresPorCampo(datos.error.issues) };

    const d = datos.data;
    const sedeId = d.rol === "cajero" ? d.sedeId : null;
    if (sedeId && !(await sedeActiva(sedeId))) {
      return { campos: { sedeId: "Escoge una sede activa" } };
    }

    // El trigger de la BD crea el perfil a partir de app_metadata.
    const admin = crearClienteAdmin();
    const { data: creado, error } = await admin.auth.admin.createUser({
      email: correoInterno(d.nombreUsuario),
      password: d.contrasena,
      email_confirm: true,
      app_metadata: {
        rol: d.rol,
        nombre_usuario: d.nombreUsuario,
        nombre_completo: d.nombreCompleto,
        sede_id: sedeId ?? "",
      },
    });

    if (error) {
      if (error.code === "email_exists" || error.status === 422) {
        return { campos: { nombreUsuario: "Ese usuario ya existe" } };
      }
      if (error.code === "weak_password") return { campos: { contrasena: "Contraseña muy débil" } };
      return { error: `No se pudo crear el usuario: ${error.message}` };
    }

    // Seguridad: si por algún motivo no se creó el perfil, se deshace el usuario de Auth.
    const { data: perfil } = await admin.from("perfiles").select("id").eq("id", creado.user.id).maybeSingle();
    if (!perfil) {
      await admin.auth.admin.deleteUser(creado.user.id);
      return { error: "No se pudo crear el perfil del usuario" };
    }

    revalidatePath("/admin", "layout");
    return exito();
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Error inesperado al crear el usuario";
    return { error: mensaje };
  }
}

export async function editarUsuario(_: EstadoFormulario, f: FormData): Promise<EstadoFormulario> {
  try {
    const admin = await requerirAdmin();
    const datos = esquemaEditarUsuario.safeParse({
      id: texto(f, "id"),
      nombreCompleto: texto(f, "nombreCompleto"),
      activo: f.get("activo") === "on",
      rol: texto(f, "rol"),
      sedeId: texto(f, "sedeId") || undefined,
    });
    if (!datos.success) return { campos: erroresPorCampo(datos.error.issues) };

    const d = datos.data;
    if (d.id === admin.id && (!d.activo || d.rol !== "admin")) {
      return { error: "No puedes desactivarte ni quitarte el rol de administrador" };
    }

    // Las reglas (sede activa, último admin, turno abierto) las valida la BD.
    const supabase = await crearClienteServidor();
    const { data: anterior } = await supabase.from("perfiles").select("activo").eq("id", d.id).single();
    const { error } = await supabase
      .from("perfiles")
      .update({
        nombre_completo: d.nombreCompleto,
        rol: d.rol,
        sede_id: d.rol === "cajero" ? d.sedeId : null,
        activo: d.activo,
      })
      .eq("id", d.id);
    if (error) return { error: mensajeDeError(error) };

    // Al desactivar se bloquea en Auth (no puede iniciar sesión ni refrescar el token).
    if (anterior && anterior.activo !== d.activo) {
      const { error: errorAuth } = await crearClienteAdmin().auth.admin.updateUserById(d.id, {
        ban_duration: d.activo ? "none" : BLOQUEO,
      });
      if (errorAuth) {
        return { error: "Se guardó, pero no se pudo actualizar el acceso. Intenta de nuevo" };
      }
    }

    revalidatePath("/admin", "layout");
    return exito();
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Error inesperado al editar el usuario";
    return { error: mensaje };
  }
}

export async function restablecerContrasena(_: EstadoFormulario, f: FormData): Promise<EstadoFormulario> {
  try {
    await requerirAdmin();
    const datos = esquemaContrasena.safeParse({ id: texto(f, "id"), contrasena: texto(f, "contrasena") });
    if (!datos.success) return { campos: erroresPorCampo(datos.error.issues) };

    const { error } = await crearClienteAdmin().auth.admin.updateUserById(datos.data.id, {
      password: datos.data.contrasena,
    });
    if (error) return { error: "No se pudo cambiar la contraseña" };
    return exito();
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Error inesperado al cambiar la contraseña";
    return { error: mensaje };
  }
}
