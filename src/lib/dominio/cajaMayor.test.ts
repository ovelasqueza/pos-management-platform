import { describe, expect, it } from "vitest";
import {
  SALDO_VACIO,
  SIN_PARTES,
  calcularCierreBase,
  describirOrigen,
  envioValido,
  leerSaldo,
  origenDeGasto,
  parteSinSaldo,
  partesDeGasto,
  quedaEnCaja,
  repartirGasto,
} from "./cajaMayor";

const partes = (efectivo: number, transferencia: number, tarjeta: number) => ({ efectivo, transferencia, tarjeta });

describe("repartirGasto", () => {
  it("caja: todo sale del cajón", () => {
    expect(repartirGasto(10000, "caja", partes(5, 5, 5))).toEqual({ ok: true, montoCaja: 10000, mayor: SIN_PARTES });
  });
  it("caja mayor: las partes deben sumar el monto", () => {
    expect(repartirGasto(10000, "mayor", partes(6000, 3000, 1000))).toEqual({ ok: true, montoCaja: 0, mayor: partes(6000, 3000, 1000) });
    expect(repartirGasto(10000, "mayor", partes(6000, 0, 0))).toEqual({ ok: false, error: "Faltan $ 4.000" });
    expect(repartirGasto(10000, "mayor", partes(6000, 5000, 0))).toEqual({ ok: false, error: "Sobran $ 1.000" });
    expect(repartirGasto(10000, "mayor", SIN_PARTES).ok).toBe(false);
  });
  it("ambas: el resto sale del cajón y las dos partes son > 0", () => {
    expect(repartirGasto(10000, "ambas", partes(2000, 2000, 0))).toEqual({ ok: true, montoCaja: 6000, mayor: partes(2000, 2000, 0) });
    expect(repartirGasto(10000, "ambas", SIN_PARTES).ok).toBe(false);
    expect(repartirGasto(10000, "ambas", partes(5000, 5000, 0)).ok).toBe(false);
  });
  it("detecta la parte sin saldo", () => {
    const saldo = { ...SALDO_VACIO, efectivo: 5000, transferencia: 1000, total: 6000 };
    expect(parteSinSaldo(partes(5000, 1000, 0), saldo)).toBeNull();
    expect(parteSinSaldo(partes(0, 1001, 0), saldo)).toBe("transferencia");
  });
});

describe("origen del gasto", () => {
  it("se deduce de monto_mayor", () => {
    expect(origenDeGasto({ monto: 5000 })).toBe("caja");
    expect(origenDeGasto({ monto: 5000, monto_mayor: 5000 })).toBe("mayor");
    expect(origenDeGasto({ monto: 5000, monto_mayor: 2000 })).toBe("ambas");
  });
  it("lee las partes de la tabla, del reporte y de reportes anteriores", () => {
    expect(partesDeGasto({ monto: 3, monto_mayor: 3, mayor_efectivo: 1, mayor_transferencia: 2, mayor_tarjeta: 0 })).toEqual(partes(1, 2, 0));
    expect(partesDeGasto({ monto: 3, monto_mayor: 3, mayor: { tarjeta: 3 } })).toEqual(partes(0, 0, 3));
    expect(partesDeGasto({ monto: 3, monto_mayor: 3, parte_mayor: "transferencia" })).toEqual(partes(0, 3, 0));
  });
  it("texto corto con las partes", () => {
    expect(describirOrigen({ monto: 5000, monto_mayor: 0 })).toBe("Cajón");
    expect(describirOrigen({ monto: 5000, monto_mayor: 5000, parte_mayor: "transferencia" })).toBe("Caja mayor · QR $ 5.000");
    expect(
      describirOrigen({ monto: 10000, monto_caja: 6000, monto_mayor: 4000, mayor: { efectivo: 3000, transferencia: 1000, tarjeta: 0 } }),
    ).toBe("Cajón $ 6.000 + Caja mayor · Efectivo $ 3.000 + QR $ 1.000");
  });
});

describe("envío al cerrar", () => {
  it("entre 0 y lo contado", () => {
    expect(envioValido(50000, 0)).toBe(true);
    expect(envioValido(50000, 50000)).toBe(true);
    expect(envioValido(50000, 50001)).toBe(false);
    expect(envioValido(50000, -1)).toBe(false);
    expect(quedaEnCaja(50000, 30000)).toBe(20000);
  });
  it("calcularCierreBase mantiene 100.000 permanente y envía lo contado a caja mayor", () => {
    expect(calcularCierreBase(350000)).toEqual({ baseCaja: 100000, aMayor: 350000 });
    expect(calcularCierreBase(100000)).toEqual({ baseCaja: 100000, aMayor: 100000 });
    expect(calcularCierreBase(60000)).toEqual({ baseCaja: 100000, aMayor: 60000 });
    expect(calcularCierreBase(0)).toEqual({ baseCaja: 100000, aMayor: 0 });
  });
});

describe("leerSaldo", () => {
  it("acepta números como texto y faltantes", () => {
    expect(leerSaldo({ efectivo: "100", transferencia: 5, total: "105" })).toEqual({
      efectivo: 100,
      transferencia: 5,
      tarjeta: 0,
      total: 105,
    });
    expect(leerSaldo(null).total).toBe(0);
  });
});
