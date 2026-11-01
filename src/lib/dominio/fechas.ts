/** Fechas y rangos en America/Bogota (UTC−5 fijo, sin horario de verano). */

const ZONA = "America/Bogota";
const OFFSET = "-05:00";

const fechaHora = new Intl.DateTimeFormat("es-CO", {
  timeZone: ZONA,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

const soloHora = new Intl.DateTimeFormat("es-CO", {
  timeZone: ZONA,
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

const diaCorto = new Intl.DateTimeFormat("es-CO", { timeZone: "UTC", day: "numeric", month: "short" });
const isoLocal = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" });

export const formatearFechaHora = (iso: string | Date) => fechaHora.format(new Date(iso));
export const formatearHora = (iso: string | Date) => soloHora.format(new Date(iso));
/** "2026-10-28" → "28 oct" */
export const formatearDia = (fecha: string) => diaCorto.format(new Date(`${fecha}T00:00:00Z`));

const diaLargo = new Intl.DateTimeFormat("es-CO", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" });
/** "2026-10-31" → "sáb, 31 oct 2026" */
export const formatearFecha = (fecha: string) => diaLargo.format(new Date(`${fecha}T00:00:00Z`));

/** Fecha de hoy en Bogotá como "YYYY-MM-DD". */
export const hoyBogota = (ahora = new Date()) => isoLocal.format(ahora);

/** Suma días a una fecha "YYYY-MM-DD". */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export const esFecha = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

export type Rango = { desde: string; hasta: string };

export type Atajo = { nombre: string; rango: Rango };

export function atajos(ahora = new Date()): Atajo[] {
  const hoy = hoyBogota(ahora);
  return [
    { nombre: "Hoy", rango: { desde: hoy, hasta: hoy } },
    { nombre: "Ayer", rango: { desde: sumarDias(hoy, -1), hasta: sumarDias(hoy, -1) } },
    { nombre: "7 días", rango: { desde: sumarDias(hoy, -6), hasta: hoy } },
    { nombre: "Este mes", rango: { desde: `${hoy.slice(0, 8)}01`, hasta: hoy } },
  ];
}

/**
 * Lee ?desde=&hasta= de la URL. Por defecto, hoy.
 * Devuelve error si la fecha inicial es posterior a la final o el rango supera un año.
 */
export function leerRango(params: { desde?: unknown; hasta?: unknown }): Rango & { error?: string } {
  const hoy = hoyBogota();
  const desde = esFecha(params.desde) ? params.desde : hoy;
  const hasta = esFecha(params.hasta) ? params.hasta : desde;
  if (desde > hasta) return { desde, hasta, error: "La fecha inicial es posterior a la final" };
  if (Date.parse(hasta) - Date.parse(desde) > 366 * 86_400_000) {
    return { desde, hasta, error: "El rango no puede superar un año" };
  }
  return { desde, hasta };
}

/** Instantes [inicio, fin) del rango en Bogotá, para filtrar timestamptz. */
export function limitesRango({ desde, hasta }: Rango) {
  return { inicio: `${desde}T00:00:00${OFFSET}`, fin: `${sumarDias(hasta, 1)}T00:00:00${OFFSET}` };
}


const DIA_MS = 86_400_000;

/** Días del rango, contando ambos extremos. */
export const diasDelRango = ({ desde, hasta }: Rango) => Math.round((Date.parse(hasta) - Date.parse(desde)) / DIA_MS) + 1;

/**
 * Periodo anterior del mismo largo, para comparar de forma justa.
 * Si el rango incluye el momento actual, se corta "hasta esta hora" en ambos
 * (hoy hasta las 6 p. m. vs. ayer hasta las 6 p. m.). null si el rango aún no empieza.
 */
export function periodoAnterior(rango: Rango, ahora = new Date()) {
  const { inicio, fin } = limitesRango(rango);
  const ini = Date.parse(inicio);
  const finReal = Math.min(Date.parse(fin), ahora.getTime());
  if (finReal <= ini) return null;

  const dias = diasDelRango(rango);
  const largo = dias * DIA_MS;
  const parcial = finReal < Date.parse(fin);
  const base = dias === 1 ? (parcial ? "ayer" : "el día anterior") : `los ${dias} días anteriores`;

  return {
    inicio: new Date(ini - largo).toISOString(),
    fin: new Date(finReal - largo).toISOString(),
    etiqueta: `vs. ${base}${parcial ? " a esta hora" : ""}`,
  };
}

/** Variación porcentual redondeada; null si no hay base para comparar. */
export function variacion(actual: number, anterior: number): number | null {
  if (anterior <= 0) return null;
  return Math.round(((actual - anterior) / anterior) * 100);
}
