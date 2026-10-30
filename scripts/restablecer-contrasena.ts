/**
 * Cambia la contraseña de un usuario (útil si el admin la olvidó y no puede entrar).
 * Uso: npm run restablecer-contrasena   (lee .env.local)
 */
import { createClient } from "@supabase/supabase-js";
import { normalizarUsuario } from "../src/lib/dominio/usuario";
import { preguntar, preguntarOculto } from "./consola";

const MINIMO = 8;
const MAXIMO = 72;

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SECRET_KEY;
  if (!url || !clave) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en .env.local");
    process.exit(1);
  }
  const supabase = createClient(url, clave, { auth: { persistSession: false } });

  console.log("Restablecer contraseña\n");
  const nombreUsuario = normalizarUsuario(await preguntar("Usuario: "));

  const { data: perfil, error } = await supabase
    .from("perfiles")
    .select("id, nombre_completo, rol")
    .eq("nombre_usuario", nombreUsuario)
    .maybeSingle<{ id: string; nombre_completo: string; rol: string }>();

  if (error) {
    console.error(`No se pudo consultar: ${error.message}`);
    process.exit(1);
  }
  if (!perfil) {
    const { data: admins } = await supabase.from("perfiles").select("nombre_usuario").eq("rol", "admin");
    console.error(`No existe el usuario "${nombreUsuario}".`);
    if (admins?.length) console.error(`Administradores: ${admins.map((a) => a.nombre_usuario).join(", ")}`);
    process.exit(1);
  }

  console.log(`${perfil.nombre_completo} (${perfil.rol})`);
  const contrasena = await preguntarOculto(`Nueva contraseña (mín. ${MINIMO}): `);
  const confirmar = await preguntarOculto("Repite la contraseña: ");

  if (contrasena !== confirmar) {
    console.error("Las contraseñas no coinciden");
    process.exit(1);
  }
  if (contrasena.length < MINIMO || contrasena.length > MAXIMO) {
    console.error(`La contraseña debe tener entre ${MINIMO} y ${MAXIMO} caracteres`);
    process.exit(1);
  }

  const { error: errorAuth } = await supabase.auth.admin.updateUserById(perfil.id, { password: contrasena });
  if (errorAuth) {
    console.error(`No se pudo cambiar: ${errorAuth.message}`);
    process.exit(1);
  }

  console.log(`\nListo. Ingresa con el usuario "${nombreUsuario}" y la nueva contraseña.`);
}

main();
