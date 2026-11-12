import { describe, expect, it } from "vitest";
import { armarCsvProductosSede, nombreArchivoCsvProductos } from "./catalogoExportar";

describe("catalogoExportar", () => {
  it("genera el nombre de archivo csv limpio", () => {
    const nombre = nombreArchivoCsvProductos("ASADERO LA ESTACIÓN DEL POLLO", "2026-11-12");
    expect(nombre).toBe("productos-asadero-la-estacion-del-pollo-2026-11-12.csv");
  });

  it("separa activos y desactivados en secciones distintas con BOM y punto y coma", () => {
    const csv = armarCsvProductosSede({
      sede: "ASADERO BRASAS DE LOS MANGOS",
      fecha: "2026-11-12",
      filas: [
        {
          nombre: 'POLLO "ESPECIAL" ASADO',
          categoria: "POLLOS",
          precioVenta: 38000,
          costo: 25000,
          habilitado: true,
          activo: true,
        },
        {
          nombre: "GASEOSA 1.5",
          categoria: "BEBIDAS",
          precioVenta: 6000,
          costo: null,
          habilitado: false,
          activo: true,
        },
        {
          nombre: "PRODUCTO OBSOLETO",
          categoria: null,
          precioVenta: 5000,
          costo: 3000,
          habilitado: true,
          activo: false,
        },
      ],
    });

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("PRODUCTOS POR SEDE;ASADERO BRASAS DE LOS MANGOS");
    expect(csv).toContain("Total productos activos;1");
    expect(csv).toContain("Total productos desactivados;2");

    expect(csv).toContain("--- PRODUCTOS ACTIVOS ---");
    expect(csv).toContain('"POLLO ""ESPECIAL"" ASADO";POLLOS;38000;25000;Activo');

    expect(csv).toContain("--- PRODUCTOS DESACTIVADOS ---");
    expect(csv).toContain("GASEOSA 1.5;BEBIDAS;6000;;Desactivado en esta sede");
    expect(csv).toContain("PRODUCTO OBSOLETO;Sin categoría;5000;3000;Inactivo general");
  });
});
