/** Caja mayor (spec 06): reparto de gastos, envío al cerrar y etiquetas. Puro. */
import { nombreMetodo, type MetodoPago } from "./cobro";
import { formatearPesos } from "./dinero";

export type OrigenGasto = "caja" | "mayor" | "ambas";

export const ORIGENES: { valor: OrigenGasto; nombre: string }[] = [
  { valor: "caja", nombre: "Cajón" },
  { valor: "mayor", nombre: "Caja mayor" },
  { valor: "ambas", nombre: "Ambas" },
];

export type SaldoCajaMayor = Record<MetodoPago, number> & { total: number };

export const SALDO_VACIO: SaldoCajaMayor = { efectivo: 0, transferencia: 0, tarjeta: 0, total: 0 };

export type PartesMayor = Record<MetodoPago, number>;

export const SIN_PARTES: PartesMayor = { efectivo: 0, transferencia: 0, tarjeta: 0 };

export const sumaPartes = (p: PartesMayor) => p.efectivo + p.transferencia + p.tarjeta;

/** Partes de la caja mayor con las que se puede pagar un gasto (la tarjeta no sirve para pagar gastos). */
export const PARTES_PARA_GASTOS: { valor: MetodoPago; nombre: string }[] = [
  { valor: "efectivo", nombre: "Efectivo" },
  { valor: "transferencia", nombre: "QR" },
];

export type Reparto =
  | { ok: true; montoCaja: number; mayor: PartesMayor }
  | { ok: false; error: string };

/**
 * Cuánto sale del cajón y cuánto de cada parte de la caja mayor.
 * "mayor": las partes deben sumar el monto. "ambas": las partes suman más de 0 y menos que el monto.
 */
export function repartirGasto(monto: number, origen: OrigenGasto, partes: PartesMayor): Reparto {
  if (origen === "caja") return { ok: true, montoCaja: monto, mayor: { ...SIN_PARTES } };
  if (Object.values(partes).some((v) => !Number.isInteger(v) || v < 0)) return { ok: false, error: "Revisa los valores" };
  const suma = sumaPartes(partes);
  if (suma === 0) return { ok: false, error: "Escribe cuánto sale de caja mayor" };
  if (origen === "mayor") {
    if (suma < monto) return { ok: false, error: `Faltan ${formatearPesos(monto - suma)}` };
    if (suma > monto) return { ok: false, error: `Sobran ${formatearPesos(suma - monto)}` };
    return { ok: true, montoCaja: 0, mayor: { ...partes } };
  }
  if (suma >= monto) return { ok: false, error: "Debe ser menos que el monto" };
  return { ok: true, montoCaja: monto - suma, mayor: { ...partes } };
}

/** Primera parte que no alcanza con el saldo, o null. */
export function parteSinSaldo(partes: PartesMayor, saldo: SaldoCajaMayor): MetodoPago | null {
  return (["efectivo", "transferencia", "tarjeta"] as const).find((p) => partes[p] > saldo[p]) ?? null;
}

/** Origen de un gasto guardado. */
export function origenDeGasto(g: { monto: number; monto_mayor?: number | null }): OrigenGasto {
  const mayor = g.monto_mayor ?? 0;
  if (mayor <= 0) return "caja";
  return mayor >= g.monto ? "mayor" : "ambas";
}

/**
 * Un gasto como viene de la tabla (mayor_efectivo…), de un reporte (mayor: {...})
 * o de un reporte anterior al ajuste (una sola parte_mayor).
 */
export type GastoConOrigen = {
  monto: number;
  monto_caja?: number | null;
  monto_mayor?: number | null;
  mayor?: Partial<PartesMayor> | null;
  mayor_efectivo?: number | null;
  mayor_transferencia?: number | null;
  mayor_tarjeta?: number | null;
  parte_mayor?: MetodoPago | null;
};

export function partesDeGasto(g: GastoConOrigen): PartesMayor {
  if (g.mayor) {
    return { efectivo: Number(g.mayor.efectivo ?? 0), transferencia: Number(g.mayor.transferencia ?? 0), tarjeta: Number(g.mayor.tarjeta ?? 0) };
  }
  if (g.mayor_efectivo != null || g.mayor_transferencia != null || g.mayor_tarjeta != null) {
    return { efectivo: g.mayor_efectivo ?? 0, transferencia: g.mayor_transferencia ?? 0, tarjeta: g.mayor_tarjeta ?? 0 };
  }
  const p = { ...SIN_PARTES };
  if (g.parte_mayor && g.monto_mayor) p[g.parte_mayor] = g.monto_mayor;
  return p;
}

/** "Cajón", "Caja mayor · QR $ 5.000", "Cajón $ 6.000 + Caja mayor · Efectivo $ 2.000 + QR $ 2.000". */
export function describirOrigen(g: GastoConOrigen): string {
  const origen = origenDeGasto(g);
  if (origen === "caja") return "Cajón";
  const p = partesDeGasto(g);
  const partes = (["efectivo", "transferencia", "tarjeta"] as const)
    .filter((k) => p[k] > 0)
    .map((k) => `${nombreMetodo(k)} ${formatearPesos(p[k])}`)
    .join(" + ");
  if (origen === "mayor") return `Caja mayor · ${partes}`;
  const cajon = g.monto_caja ?? g.monto - (g.monto_mayor ?? 0);
  return `Cajón ${formatearPesos(cajon)} + Caja mayor · ${partes}`;
}
/** Efectivo que se envía a la caja mayor al cerrar: entre 0 y lo contado. */
export function envioValido(contado: number, aMayor: number): boolean {
  return Number.isInteger(aMayor) && aMayor >= 0 && aMayor <= contado;
}

export const quedaEnCaja = (contado: number, aMayor: number) => contado - aMayor;

/** Base fija en cajón / caja menor al cerrar turno ($ 100.000). */
export const BASE_CAJA_MENOR = 100_000;

/** Calcula la base que queda en cajón y lo que se transfiere a caja mayor al cerrar. */
export function calcularCierreBase(contado: number, base: number = BASE_CAJA_MENOR): { baseCaja: number; aMayor: number } {
  const c = Math.max(0, Math.floor(contado));
  const baseCaja = Math.min(c, base);
  const aMayor = Math.max(0, c - base);
  return { baseCaja, aMayor };
}

export type TipoMovimiento = "cierre_turno" | "gasto" | "anulacion_gasto" | "admin";

export const nombreMovimiento: Record<TipoMovimiento, string> = {
  cierre_turno: "Cierre de turno",
  gasto: "Gasto",
  anulacion_gasto: "Gasto anulado",
  admin: "Admin",
};

/** Normaliza lo que devuelve caja_mayor_saldo() (los bigint pueden llegar como texto). */
export function leerSaldo(x: unknown): SaldoCajaMayor {
  const o = (x ?? {}) as Record<string, unknown>;
  const n = (v: unknown) => Number(v ?? 0) || 0;
  return { efectivo: n(o.efectivo), transferencia: n(o.transferencia), tarjeta: n(o.tarjeta), total: n(o.total) };
}
