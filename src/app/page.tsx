import { redirect } from "next/navigation";
import { inicioDe, requerirUsuario } from "@/lib/sesion";

/** Envía a cada usuario a su ambiente. */
export default async function Inicio() {
  const perfil = await requerirUsuario();
  redirect(inicioDe(perfil));
}
