import { describe, expect, it } from "vitest";
import { formatearPesos, leerPesos } from "./dinero";

describe("formatearPesos", () => {
  it("usa punto de miles y sin decimales", () => {
    expect(formatearPesos(12500)).toBe("$ 12.500");
    expect(formatearPesos(0)).toBe("$ 0");
    expect(formatearPesos(1_000_000)).toBe("$ 1.000.000");
  });
  it("muestra negativos con signo", () => {
    expect(formatearPesos(-3500)).toBe("-$ 3.500");
  });
});

describe("leerPesos", () => {
  it("acepta enteros con o sin separadores", () => {
    expect(leerPesos("12500")).toBe(12500);
    expect(leerPesos("12.500")).toBe(12500);
    expect(leerPesos("$ 12.500")).toBe(12500);
  });
  it("rechaza vacío, decimales, negativos y letras", () => {
    for (const t of ["", " ", "12,5", "-100", "abc", "1e3"]) {
      expect(leerPesos(t)).toBeNull();
    }
  });
  it("respeta mínimo y máximo", () => {
    expect(leerPesos("0")).toBeNull();
    expect(leerPesos("0", 0)).toBe(0);
    expect(leerPesos("999999999")).toBe(999_999_999);
    expect(leerPesos("1000000000")).toBeNull();
  });
});
