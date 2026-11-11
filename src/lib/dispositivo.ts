import { nuevoUUID } from "./uuid";

/**
 * Identificador del equipo (navegador). Lo crea el proxy en una cookie de larga duración
 * y se envía a Supabase en el encabezado "x-pos-dispositivo" para amarrar el turno al equipo.
 */
export const COOKIE_DISPOSITIVO = "pos_dispositivo";
export const ENCABEZADO_DISPOSITIVO = "x-pos-dispositivo";
export const DURACION_COOKIE = 60 * 60 * 24 * 365 * 10; // 10 años
const CLAVE_STORAGE = "pos:dispositivo";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const esDispositivoValido = (v: string | undefined | null): v is string => Boolean(v && UUID.test(v));

function fijarCookieNavegador(id: string) {
  try {
    const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE_DISPOSITIVO}=${id}; Path=/; Max-Age=${DURACION_COOKIE}; SameSite=Lax${secure}`;
  } catch {
    // ignorar si el navegador restringe cookies
  }
}

/** Lee el identificador desde document.cookie o localStorage (y los mantiene sincronizados). */
export function dispositivoNavegador(): string | null {
  if (typeof document === "undefined") return null;
  const enCookie = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${COOKIE_DISPOSITIVO}=`))
    ?.split("=")[1];

  if (esDispositivoValido(enCookie)) {
    try {
      localStorage.setItem(CLAVE_STORAGE, enCookie);
    } catch {
      // ignorar
    }
    return enCookie;
  }

  try {
    const enStorage = localStorage.getItem(CLAVE_STORAGE);
    if (esDispositivoValido(enStorage)) {
      fijarCookieNavegador(enStorage);
      return enStorage;
    }
  } catch {
    // ignorar
  }

  const nuevo = nuevoUUID();
  fijarCookieNavegador(nuevo);
  try {
    localStorage.setItem(CLAVE_STORAGE, nuevo);
  } catch {
    // ignorar
  }
  return nuevo;
}

/** Encabezados para el cliente de Supabase. */
export function encabezadosDispositivo(id: string | null | undefined): Record<string, string> {
  return esDispositivoValido(id) ? { [ENCABEZADO_DISPOSITIVO]: id } : {};
}
