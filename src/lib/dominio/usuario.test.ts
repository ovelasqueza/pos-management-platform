import { describe, expect, it } from "vitest";
import { correoInterno, esquemaCrearUsuario } from "./usuario";

const SEDE = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";

describe("correoInterno", () => {
  it("normaliza a minúsculas y agrega el dominio interno", () => {
    expect(correoInterno("  Caja.Norte ")).toBe("caja.norte@pos.local");
  });
});

describe("esquemaCrearUsuario", () => {
  const base = { nombreCompleto: "Laura Mora", nombreUsuario: "laura", contrasena: "12345678" };

  it("acepta un cajero con sede", () => {
    const r = esquemaCrearUsuario.safeParse({ ...base, rol: "cajero", sedeId: SEDE });
    expect(r.success).toBe(true);
  });

  it("acepta un admin sin sede", () => {
    expect(esquemaCrearUsuario.safeParse({ ...base, rol: "admin" }).success).toBe(true);
  });

  it("rechaza cajero sin sede", () => {
    expect(esquemaCrearUsuario.safeParse({ ...base, rol: "cajero" }).success).toBe(false);
  });

  it("rechaza contraseña corta", () => {
    const r = esquemaCrearUsuario.safeParse({ ...base, contrasena: "1234567", rol: "admin" });
    expect(r.success).toBe(false);
  });

  it("rechaza usuarios con tildes, espacios o muy cortos", () => {
    for (const nombreUsuario of ["josé", "ana maria", "ab", "a".repeat(31)]) {
      const r = esquemaCrearUsuario.safeParse({ ...base, nombreUsuario, rol: "admin" });
      expect(r.success, nombreUsuario).toBe(false);
    }
  });

  it("normaliza el usuario a minúsculas", () => {
    const r = esquemaCrearUsuario.safeParse({ ...base, nombreUsuario: " Laura.M ", rol: "admin" });
    expect(r.success && r.data.nombreUsuario).toBe("laura.m");
  });
});
