import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";

const MOTIVOS = new Set(["inactivo", "sede-inactiva", "turno-cerrado", "otro-equipo"]);

/** Cierra la sesión y vuelve a /login (con el motivo, si aplica). */
async function salir(request: NextRequest) {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();

  const motivo = request.nextUrl.searchParams.get("motivo");
  const destino = motivo && MOTIVOS.has(motivo) ? `/login?motivo=${motivo}` : "/login";
  // Location relativa: request.url puede traer "localhost" aunque se entre por la IP de la red,
  // y el otro dispositivo terminaría en su propio localhost.
  return new NextResponse(null, { status: 303, headers: { Location: destino } });
}

export const GET = salir;
export const POST = salir;
