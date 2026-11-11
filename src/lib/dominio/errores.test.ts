import { describe, expect, it } from "vitest";
import { codigoDeError, esCodigo, esErrorDeRed, esErrorDeSesion, mensajeDeError } from "./errores";

describe("errores de dominio y red", () => {
  it("detecta códigos de negocio en mensajes de PostgreSQL", () => {
    expect(codigoDeError({ message: "TURNO_CERRADO" })).toBe("TURNO_CERRADO");
    expect(codigoDeError({ message: "CAJA_OCUPADA: María" })).toBe("CAJA_OCUPADA");
    expect(esCodigo({ message: "PRECIOS_ACTUALIZADOS" }, "PRECIOS_ACTUALIZADOS")).toBe(true);
    expect(mensajeDeError({ message: "TURNO_CERRADO" })).toBe("El turno está cerrado");
  });

  it("detecta errores de red, caídas y timeouts para reintentar o encolar ventas", () => {
    expect(esErrorDeRed({ message: "TypeError: Failed to fetch" })).toBe(true);
    expect(esErrorDeRed({ name: "TimeoutError", message: "The operation timed out" })).toBe(true);
    expect(esErrorDeRed({ name: "AbortError", message: "signal is aborted" })).toBe(true);
    expect(esErrorDeRed({ message: "503 Service Unavailable" })).toBe(true);
    expect(esErrorDeRed({ message: "TURNO_CERRADO" })).toBe(false);
  });

  it("detecta errores de sesión o JWT vencido en turnos 24/7", () => {
    expect(esErrorDeSesion({ code: "PGRST301", message: "JWT expired" })).toBe(true);
    expect(esErrorDeSesion({ message: "Invalid token: token is expired" })).toBe(true);
    expect(esErrorDeSesion({ message: "TURNO_CERRADO" })).toBe(false);
  });
});
