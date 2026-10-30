const formato = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 0,
});

/** Formatea pesos colombianos enteros: 12500 → "$ 12.500" */
export function formatearPesos(valor: number): string {
  const signo = valor < 0 ? "-" : "";
  return `${signo}$ ${formato.format(Math.abs(Math.trunc(valor)))}`;
}

export const MAXIMO_PESOS = 999_999_999;

/**
 * Convierte el texto de un campo de dinero a entero.
 * Acepta separadores de miles ("12.500", "12 500"). Devuelve null si no es
 * un entero válido dentro de [minimo, MAXIMO_PESOS].
 */
export function leerPesos(texto: string, minimo = 1): number | null {
  const limpio = texto.trim().replace(/[$\s.]/g, "");
  if (!/^\d+$/.test(limpio)) return null;
  const valor = Number(limpio);
  if (!Number.isSafeInteger(valor) || valor < minimo || valor > MAXIMO_PESOS) {
    return null;
  }
  return valor;
}
