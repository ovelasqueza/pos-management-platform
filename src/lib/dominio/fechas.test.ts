import { describe, expect, it } from "vitest";
import { diasDelRango, periodoAnterior, variacion } from "./fechas";

// 29 oct 2026, 6:00 p. m. en Bogotá (UTC−5) = 23:00 UTC
const ahora = new Date("2026-10-29T23:00:00Z");

describe("periodoAnterior", () => {
  it("hoy se compara con ayer hasta la misma hora", () => {
    expect(periodoAnterior({ desde: "2026-10-29", hasta: "2026-10-29" }, ahora)).toEqual({
      inicio: "2026-10-28T05:00:00.000Z", // 28 oct 00:00 Bogotá
      fin: "2026-10-28T23:00:00.000Z", // 28 oct 6:00 p. m. Bogotá
      etiqueta: "vs. ayer a esta hora",
    });
  });

  it("un día cerrado se compara con el día anterior completo", () => {
    expect(periodoAnterior({ desde: "2026-10-28", hasta: "2026-10-28" }, ahora)).toEqual({
      inicio: "2026-10-27T05:00:00.000Z",
      fin: "2026-10-28T05:00:00.000Z",
      etiqueta: "vs. el día anterior",
    });
  });

  it("7 días que incluyen hoy se comparan con los 7 anteriores hasta la misma hora", () => {
    const p = periodoAnterior({ desde: "2026-10-23", hasta: "2026-10-29" }, ahora);
    expect(p?.inicio).toBe("2026-10-16T05:00:00.000Z");
    expect(p?.fin).toBe("2026-10-22T23:00:00.000Z");
    expect(p?.etiqueta).toBe("vs. los 7 días anteriores a esta hora");
  });

  it("un rango futuro no tiene comparación", () => {
    expect(periodoAnterior({ desde: "2026-10-30", hasta: "2026-10-30" }, ahora)).toBeNull();
  });
});

describe("diasDelRango y variacion", () => {
  it("cuenta ambos extremos", () => {
    expect(diasDelRango({ desde: "2026-10-01", hasta: "2026-10-31" })).toBe(31);
    expect(diasDelRango({ desde: "2026-10-29", hasta: "2026-10-29" })).toBe(1);
  });

  it("calcula el porcentaje y no divide por cero", () => {
    expect(variacion(1_200, 1_000)).toBe(20);
    expect(variacion(800, 1_000)).toBe(-20);
    expect(variacion(500, 0)).toBeNull();
  });
});
