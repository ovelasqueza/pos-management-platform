import { describe, expect, it } from "vitest";
import { esquemaCrearSede, ordenarSedes, ubicacionSede } from "./sede";

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
  it("convierte opcionales vacíos en null y asigna papel de 80 mm por defecto", () => {
    const r = esquemaCrearSede.parse({ nombre: " Norte ", nit: " 900.123.456-7 ", tipo: "asadero", ciudad: " ", direccion: "", telefono: "  " });
    expect(r).toEqual({
      nombre: "Norte",
      nit: "900123456-7",
      tipo: "asadero",
      ciudad: null,
      direccion: null,
      telefono: null,
      ancho_papel: 80,
    });
  });
  it("permite configurar papel de 58 mm o 80 mm por sede", () => {
    const r = esquemaCrearSede.parse({
      nombre: "Sur",
      nit: "",
      tipo: "panaderia",
      ciudad: "",
      direccion: "",
      telefono: "",
      ancho_papel: "58",
    });
    expect(r.ancho_papel).toBe(58);
  });
  it("exige nombre y tipo válido", () => {
    expect(esquemaCrearSede.safeParse({ nombre: "", nit: "", tipo: "asadero", ciudad: "", direccion: "", telefono: "" }).success).toBe(false);
    expect(esquemaCrearSede.safeParse({ nombre: "X", nit: "", tipo: "bar", ciudad: "", direccion: "", telefono: "" }).success).toBe(false);
  });
});

describe("NIT de la sede", () => {
  const base = { nombre: "X", tipo: "asadero", ciudad: "", direccion: "", telefono: "" };
  it("es opcional y rechaza letras", () => {
    expect(esquemaCrearSede.parse({ ...base, nit: "" }).nit).toBeNull();
    expect(esquemaCrearSede.parse({ ...base, nit: "16789012" }).nit).toBe("16789012");
    expect(esquemaCrearSede.safeParse({ ...base, nit: "90012A" }).success).toBe(false);
  });
});

describe("ubicacionSede", () => {
  it("une ciudad y dirección con lo que exista", () => {
    expect(ubicacionSede({ ciudad: "Palmira", direccion: "Barrio La Rivera" })).toBe("Palmira · Barrio La Rivera");
    expect(ubicacionSede({ ciudad: "Cali", direccion: null })).toBe("Cali");
    expect(ubicacionSede({ ciudad: null, direccion: "Antonio Nariño" })).toBe("Antonio Nariño");
    expect(ubicacionSede({ ciudad: null, direccion: null })).toBeNull();
  });
});
