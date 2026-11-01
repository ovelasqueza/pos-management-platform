import { describe, expect, it } from "vitest";
import {
  agruparLineas,
  armarCsvInventario,
  calcularTotales,
  cantidadConUnidad,
  esquemaCrearArticulo,
  leerCantidad,
  nombreArchivoCsv,
  sumarFraccion,
  type LineaInventario,
} from "./inventario";

const linea = (p: Partial<LineaInventario>): LineaInventario => ({
  id: "x",
  productoId: null,
  articuloId: "a",
  nombre: "HARINA",
  unidad: "bulto",
  cantidad: 0,
  costo: null,
  valor: null,
  ...p,
});

describe("leerCantidad", () => {
  it("acepta coma, punto, fracciones y vacío = 0", () => {
    expect(leerCantidad("9,5", false)).toBe(9.5);
    expect(leerCantidad("9.5", false)).toBe(9.5);
    expect(leerCantidad("9 1/2", false)).toBe(9.5);
    expect(leerCantidad("3/4", false)).toBe(0.75);
    expect(leerCantidad("0,250", false)).toBe(0.25);
    expect(leerCantidad("  ", false)).toBe(0);
  });
  it("productos de venta solo en enteros", () => {
    expect(leerCantidad("30", true)).toBe(30);
    expect(leerCantidad("2,5", true)).toBeNull();
    expect(leerCantidad("1/2", true)).toBeNull();
  });
  it("rechaza negativos, letras, más de 3 decimales y más de 999.999", () => {
    expect(leerCantidad("-1", false)).toBeNull();
    expect(leerCantidad("abc", false)).toBeNull();
    expect(leerCantidad("1,2345", false)).toBeNull();
    expect(leerCantidad("1000000", false)).toBeNull();
    expect(leerCantidad("1/0", false)).toBeNull();
  });
});

describe("fracciones", () => {
  it("suma ¼ ½ ¾ sin errores de coma flotante", () => {
    expect(sumarFraccion(9, 0.5)).toBe(9.5);
    expect(sumarFraccion(0.1, 0.25)).toBe(0.35);
    expect(sumarFraccion(9.75, 0.25)).toBe(10);
  });
  it("muestra la cantidad con su unidad", () => {
    expect(cantidadConUnidad(9.5, "bulto")).toBe("9½ bultos");
    expect(cantidadConUnidad(0.25, "bulto")).toBe("¼ bulto");
    expect(cantidadConUnidad(1, "kilo")).toBe("1 kilo");
    expect(cantidadConUnidad(1.125, "libra")).toBe("1,125 libras");
    expect(cantidadConUnidad(0, "caja")).toBe("0 cajas");
  });
});

describe("totales y grupos", () => {
  const lineas = [
    linea({ nombre: "LEVADURA", cantidad: 2, costo: null }),
    linea({ nombre: "HARINA", cantidad: 9.5, costo: 95000, valor: 902500 }),
    linea({ nombre: "PAN", productoId: "p", articuloId: null, unidad: "unidad", cantidad: 30, costo: 200, valor: 6000 }),
  ];
  it("las líneas sin costo no suman y se cuentan", () => {
    expect(calcularTotales(lineas)).toEqual({ productos: 6000, articulos: 902500, total: 908500, sinCosto: 1 });
  });
  it("separa productos y materias primas en orden alfabético", () => {
    const g = agruparLineas(lineas);
    expect(g.productos.map((l) => l.nombre)).toEqual(["PAN"]);
    expect(g.articulos.map((l) => l.nombre)).toEqual(["HARINA", "LEVADURA"]);
  });
});

describe("materias primas", () => {
  it("nombre en mayúsculas y costo opcional", () => {
    const r = esquemaCrearArticulo.parse({ sedeId: "00000000-0000-4000-8000-000000000001", nombre: " harina  de trigo ", unidad: "bulto", costo: "" });
    expect(r).toEqual({ sedeId: "00000000-0000-4000-8000-000000000001", nombre: "HARINA DE TRIGO", unidad: "bulto", costo: null });
    expect(esquemaCrearArticulo.safeParse({ sedeId: "00000000-0000-4000-8000-000000000001", nombre: "X", unidad: "tonelada", costo: "" }).success).toBe(false);
  });
});

describe("CSV", () => {
  it("separa con ; usa coma decimal, comillas cuando hace falta y BOM", () => {
    const csv = armarCsvInventario({
      sede: "Panadería",
      nit: "900123456-7",
      fecha: "2026-10-31",
      estado: "en_curso",
      nota: null,
      lineas: [linea({ nombre: 'HARINA "ESPECIAL"; 50KG', cantidad: 9.5, costo: 95000, valor: 902500 })],
    });
    expect(csv.startsWith("\uFEFFInventario;Panadería\r\nNIT;900123456-7\r\n")).toBe(true);
    expect(csv).toContain("Estado;EN CURSO");
    expect(csv).toContain('Materia prima;"HARINA ""ESPECIAL""; 50KG";bultos;9,5;95000;902500');
    expect(csv).toContain(";;;;TOTAL;902500");
  });
  it("nombre de archivo sin tildes ni espacios", () => {
    expect(nombreArchivoCsv("Panadería Trigo, Pan y Café", "2026-10-31")).toBe("inventario-panaderia-trigo-pan-y-cafe-2026-10-31.csv");
  });
});
