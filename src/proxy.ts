import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import { COOKIE_DISPOSITIVO, DURACION_COOKIE, esDispositivoValido } from "@/lib/dispositivo";

/**
 * Refresca la sesión de Supabase en cada petición y hace redirecciones
 * optimistas. La autorización real está en los layouts (lib/sesion.ts) y en la RLS.
 * También asegura que el navegador tenga su identificador de equipo (cookie pos_dispositivo).
 */
export async function proxy(request: NextRequest) {
  // Identificador de equipo: se crea una vez y se conserva 10 años
  const existente = request.cookies.get(COOKIE_DISPOSITIVO)?.value;
  const dispositivoNuevo = esDispositivoValido(existente) ? null : crypto.randomUUID();
  if (dispositivoNuevo) request.cookies.set(COOKIE_DISPOSITIVO, dispositivoNuevo);

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(lista, headers) {
        lista.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        lista.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // getClaims valida el JWT y refresca el token si hace falta.
  const { data } = await supabase.auth.getClaims();
  const autenticado = Boolean(data?.claims?.sub);
  const ruta = request.nextUrl.pathname;
  const esLogin = ruta === "/login";

  let final = response;
  if (ruta !== "/salir") {
    if (!autenticado && !esLogin) final = redirigirConCookies(request, response, "/login");
    else if (autenticado && esLogin) final = redirigirConCookies(request, response, "/");
  }

  if (dispositivoNuevo) {
    // No es httpOnly: el navegador lo lee para enviarlo a Supabase en cada operación de caja
    final.cookies.set(COOKIE_DISPOSITIVO, dispositivoNuevo, {
      path: "/",
      maxAge: DURACION_COOKIE,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
    });
  }
  return final;
}

function redirigirConCookies(request: NextRequest, base: NextResponse, destino: string) {
  const url = request.nextUrl.clone();
  url.pathname = destino;
  url.search = "";
  const redireccion = NextResponse.redirect(url);
  base.cookies.getAll().forEach((c) => redireccion.cookies.set(c));
  return redireccion;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
