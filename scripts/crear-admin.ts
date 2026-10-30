/**
 * Crea el primer administrador.
 * Uso: npm run crear-admin   (lee .env.local)
 */
import { createClient } from "@supabase/supabase-js";
import { correoInterno, esquemaCrearUsuario } from "../src/lib/dominio/usuario";
import { preguntar, preguntarOculto } from "./consola";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SECRET_KEY;
  if (!url || !clave) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en .env.local");
    process.exit(1);
  }

  console.log("Crear administrador\n");
  const nombreCompleto = await preguntar("Nombre completo: ");
  const nombreUsuario = await preguntar("Usuario: ");
  const contrasena = await preguntarOculto("Contraseña (mín. 8): ");
  const confirmar = await preguntarOculto("Repite la contraseña: ");

  if (contrasena !== confirmar) {
    console.error("Las contraseñas no coinciden");
    process.exit(1);
  }

  const datos = esquemaCrearUsuario.safeParse({ nombreCompleto, nombreUsuario, contrasena, rol: "admin" });
  if (!datos.success) {
    console.error(datos.error.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n"));
    process.exit(1);
  }

  const supabase = createClient(url, clave, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.admin.createUser({
    email: correoInterno(datos.data.nombreUsuario),
    password: datos.data.contrasena,
    email_confirm: true,
    app_metadata: {
      rol: "admin",
      nombre_usuario: datos.data.nombreUsuario,
      nombre_completo: datos.data.nombreCompleto,
    },
  });

  if (error) {
    console.error(`No se pudo crear: ${error.message}`);
    if (/Database error/i.test(error.message)) {
      console.error("¿Ejecutaste supabase/migrations/20261028140000_corregir_perfil_auth.sql? (ver docs/bd/README.md)");
    }
    process.exit(1);
  }

  // El trigger de la BD debe haber creado el perfil
  const { data: perfil } = await supabase.from("perfiles").select("id").eq("id", data.user.id).maybeSingle();
  if (!perfil) {
    await supabase.auth.admin.deleteUser(data.user.id);
    console.error("Se creó el usuario pero no su perfil; se deshizo. Revisa las migraciones (npm run verificar-bd).");
    process.exit(1);
  }

  console.log(`\nListo. Ingresa con el usuario "${datos.data.nombreUsuario}".`);
}

main();
