import { describe, expect, it } from "vitest";
import { esquemaCrearSede, ordenarSedes } from "./sede";

describe("ordenarSedes", () => {
  it("pone activas primero y ordena alfabético ignorando tildes y mayúsculas", () => {
    const r = ordenarSedes([
      { nombre: "Zona Sur", activa: true },
      { nombre: "Álamos", activa: false },
      { nombre: "chapinero", activa: true },
      { nombre: "Bosa", activa: false },
      { nombre: "Ávila", activa: true },
    ]);
    expect(r.map((s) => s.nombre)).toEqual(["Ávila", "chapinero", "Zona Sur", "Álamos", "Bosa"]);
  });
});

describe("esquemaCrearSede", () => {
  it("convierte opcionales vacíos en null", () => {
    const r = esquemaCrearSede.parse({ nombre: " Norte ", tipo: "asadero", direccion: "", telefono: "  " });
    expect(r).toEqual({ nombre: "Norte", tipo: "asadero", direccion: null, telefono: null });
  });
  it("exige nombre y tipo válido", () => {
    expect(esquemaCrearSede.safeParse({ nombre: "", tipo: "asadero", direccion: "", telefono: "" }).success).toBe(false);
    expect(esquemaCrearSede.safeParse({ nombre: "X", tipo: "bar", direccion: "", telefono: "" }).success).toBe(false);
  });
});
