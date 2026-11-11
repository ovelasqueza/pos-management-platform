import { describe, expect, it } from "vitest";
import { ANCHO_PAPEL_POR_DEFECTO, normalizarAnchoPapel } from "./papel";

describe("normalizarAnchoPapel", () => {
  it("acepta 58 y 80 como número o texto", () => {
    expect(normalizarAnchoPapel(58)).toBe(58);
    expect(normalizarAnchoPapel("58")).toBe(58);
    expect(normalizarAnchoPapel(" 58 ")).toBe(58);
    expect(normalizarAnchoPapel(80)).toBe(80);
    expect(normalizarAnchoPapel("80")).toBe(80);
  });

  it("usa 80 por defecto para valores inválidos o vacíos", () => {
    expect(normalizarAnchoPapel(null)).toBe(ANCHO_PAPEL_POR_DEFECTO);
    expect(normalizarAnchoPapel(undefined)).toBe(ANCHO_PAPEL_POR_DEFECTO);
    expect(normalizarAnchoPapel("")).toBe(ANCHO_PAPEL_POR_DEFECTO);
    expect(normalizarAnchoPapel("otro")).toBe(ANCHO_PAPEL_POR_DEFECTO);
  });
});
