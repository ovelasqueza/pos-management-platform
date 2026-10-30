/** Cálculos de cobro y de cierre de turno (puros). */

export type MetodoPago = "efectivo" | "transferencia" | "tarjeta";

export const METODOS: { valor: MetodoPago; nombre: string }[] = [
  { valor: "efectivo", nombre: "Efectivo" },
  { valor: "transferencia", nombre: "QR" },
  { valor: "tarjeta", nombre: "Tarjeta" },
];

export const nombreMetodo = (m: MetodoPago) => METODOS.find((x) => x.valor === m)?.nombre ?? m;

/** Billetes para sumar rápido el efectivo recibido. */
export const BILLETES = [2_000, 5_000, 10_000, 20_000, 50_000, 100_000] as const;

export type EstadoEfectivo =
  | { completo: true; cambio: number }
  | { completo: false; falta: number };

export function calcularEfectivo(total: number, recibido: number): EstadoEfectivo {
  return recibido >= total ? { completo: true, cambio: recibido - total } : { completo: false, falta: total - recibido };
}

export type ClaseDiferencia = "cuadrada" | "sobrante" | "faltante";

export function clasificarDiferencia(diferencia: number): ClaseDiferencia {
  if (diferencia === 0) return "cuadrada";
  return diferencia > 0 ? "sobrante" : "faltante";
}

export const nombreDiferencia: Record<ClaseDiferencia, string> = {
  cuadrada: "Caja cuadrada",
  sobrante: "Sobrante",
  faltante: "Faltante",
};

/** Teclado numérico: aplica una tecla al texto actual (solo dígitos, máx. 9). */
export function aplicarTecla(actual: string, tecla: string): string {
  if (tecla === "borrar") return actual.slice(0, -1);
  if (tecla === "limpiar") return "";
  const nuevo = (actual === "0" ? "" : actual) + tecla;
  return /^\d{0,9}$/.test(nuevo) ? nuevo : actual;
}
