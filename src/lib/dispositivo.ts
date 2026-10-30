/**
 * Identificador del equipo (navegador). Lo crea el proxy en una cookie de larga duración
 * y se envía a Supabase en el encabezado "x-pos-dispositivo" para amarrar el turno al equipo.
 */
export const COOKIE_DISPOSITIVO = "pos_dispositivo";
export const ENCABEZADO_DISPOSITIVO = "x-pos-dispositivo";
export const DURACION_COOKIE = 60 * 60 * 24 * 365 * 10; // 10 años

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const esDispositivoValido = (v: string | undefined | null): v is string => Boolean(v && UUID.test(v));

/** Lee el identificador desde document.cookie (solo navegador). */
export function dispositivoNavegador(): string | null {
  if (typeof document === "undefined") return null;
  const valor = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${COOKIE_DISPOSITIVO}=`))
    ?.split("=")[1];
  return esDispositivoValido(valor) ? valor : null;
}

/** Encabezados para el cliente de Supabase. */
export function encabezadosDispositivo(id: string | null | undefined): Record<string, string> {
  return esDispositivoValido(id) ? { [ENCABEZADO_DISPOSITIVO]: id } : {};
}
