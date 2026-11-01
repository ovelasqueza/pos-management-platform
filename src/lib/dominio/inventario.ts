import { z } from "zod";
import { leerPesos } from "./dinero";

/** Lógica pura del inventario por fecha (spec 05). */

export type Unidad = "unidad" | "kilo" | "gramo" | "libra" | "litro" | "bulto" | "arroba" | "paquete" | "caja";

export const UNIDADES: { valor: Unidad; nombre: string; plural: string }[] = [
  { valor: "unidad", nombre: "unidad", plural: "unidades" },
  { valor: "kilo", nombre: "kilo", plural: "kilos" },
  { valor: "gramo", nombre: "gramo", plural: "gramos" },
  { valor: "libra", nombre: "libra", plural: "libras" },
  { valor: "litro", nombre: "litro", plural: "litros" },
  { valor: "bulto", nombre: "bulto", plural: "bultos" },
  { valor: "arroba", nombre: "arroba", plural: "arrobas" },
  { valor: "paquete", nombre: "paquete", plural: "paquetes" },
  { valor: "caja", nombre: "caja", plural: "cajas" },
];

export const esUnidad = (v: string): v is Unidad => UNIDADES.some((u) => u.valor === v);

export const nombreUnidad = (u: Unidad, cantidad = 1) => {
  const d = UNIDADES.find((x) => x.valor === u) ?? UNIDADES[0];
  return cantidad === 1 ? d.nombre : d.plural;
};

export const CANTIDAD_MAX = 999_999;

/**
 * Convierte lo escrito a cantidad. Acepta "9,5", "9.5", "9 1/2", "1/4" y vacío (= 0).
 * Productos de venta: solo enteros. Artículos: hasta 3 decimales. null si es inválido.
 */
export function leerCantidad(texto: string, soloEnteros: boolean): number | null {
  const t = texto.trim().replace(/\s+/g, " ");
  if (t === "") return 0;

  let valor: number;
  const fraccion = t.match(/^(?:(\d+) )?(\d+)\/(\d+)$/);
  if (fraccion) {
    const [, entero, num, den] = fraccion;
    if (Number(den) === 0) return null;
    valor = Number(entero ?? 0) + Number(num) / Number(den);
  } else {
    const normal = t.replace(",", ".");
    if (!/^\d+(\.\d+)?$/.test(normal)) return null;
    valor = Number(normal);
  }

  valor = Math.round(valor * 1000) / 1000;
  if (!Number.isFinite(valor) || valor < 0 || valor > CANTIDAD_MAX) return null;
  if (soloEnteros && !Number.isInteger(valor)) return null;
  if (!soloEnteros && fraccion === null && /[.,]\d{4,}$/.test(t)) return null;
  return valor;
}

/** Suma una fracción (+¼ +½ +¾) sin errores de coma flotante. */
export function sumarFraccion(actual: number, fraccion: number): number {
  return Math.min(CANTIDAD_MAX, Math.round((actual + fraccion) * 1000) / 1000);
}

const numero = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 });

/** Para el campo: 9.5 → "9,5"; 1200 → "1200" (sin miles, para editar). */
export const cantidadParaCampo = (v: number) => String(v).replace(".", ",");

const SIMBOLOS: Record<string, string> = { "0.25": "¼", "0.5": "½", "0.75": "¾" };

/** 9.5 + bulto → "9½ bultos"; 0.25 → "¼ bulto"; 1.125 → "1,125 bultos"; 2 → "2 bultos". */
export function cantidadConUnidad(cantidad: number, unidad: Unidad): string {
  const entero = Math.trunc(cantidad);
  const resto = Math.round((cantidad - entero) * 1000) / 1000;
  const simbolo = SIMBOLOS[String(resto)];
  const texto = simbolo ? `${entero === 0 ? "" : numero.format(entero)}${simbolo}` : numero.format(cantidad);
  return `${texto} ${nombreUnidad(unidad, cantidad <= 1 && cantidad > 0 ? 1 : cantidad)}`;
}

// ───────────────────────── Líneas y totales ─────────────────────────

export type LineaInventario = {
  id: string;
  productoId: string | null;
  articuloId: string | null;
  nombre: string;
  unidad: Unidad;
  cantidad: number;
  costo: number | null;
  valor: number | null;
};

export const esArticulo = (l: Pick<LineaInventario, "articuloId">) => l.articuloId !== null;

export type Totales = { productos: number; articulos: number; total: number; sinCosto: number };

/** Total = suma de líneas con costo; las que no tienen costo se cuentan aparte (aviso). */
export function calcularTotales(lineas: LineaInventario[]): Totales {
  const t: Totales = { productos: 0, articulos: 0, total: 0, sinCosto: 0 };
  for (const l of lineas) {
    if (l.costo === null) {
      t.sinCosto++;
      continue;
    }
    const v = l.valor ?? Math.round(l.cantidad * l.costo);
    if (esArticulo(l)) t.articulos += v;
    else t.productos += v;
  }
  t.total = t.productos + t.articulos;
  return t;
}

const porNombre = (a: { nombre: string }, b: { nombre: string }) =>
  a.nombre.localeCompare(b.nombre, "es-CO", { sensitivity: "base" });

/** Dos grupos (Productos, Artículos), cada uno en orden alfabético. */
export function agruparLineas(lineas: LineaInventario[]) {
  return {
    productos: lineas.filter((l) => !esArticulo(l)).sort(porNombre),
    articulos: lineas.filter(esArticulo).sort(porNombre),
  };
}

/** Lee la línea que devuelve la BD (privado.linea_json). */
export function lineaDesdeBD(f: {
  id: string;
  producto_id: string | null;
  articulo_id: string | null;
  nombre: string;
  unidad: string;
  cantidad: number | string;
  costo: number | null;
  valor: number | string | null;
}): LineaInventario {
  return {
    id: f.id,
    productoId: f.producto_id,
    articuloId: f.articulo_id,
    nombre: f.nombre,
    unidad: esUnidad(f.unidad) ? f.unidad : "unidad",
    cantidad: Number(f.cantidad),
    costo: f.costo,
    valor: f.valor === null ? null : Number(f.valor),
  };
}

// ───────────────────────── Formularios ─────────────────────────

const costoOpcional = z.string().transform((v, ctx) => {
  if (v.trim() === "") return null;
  const n = leerPesos(v);
  if (n === null) {
    ctx.addIssue({ code: "custom", message: "Entero mayor que 0, máximo $ 999.999.999" });
    return z.NEVER;
  }
  return n;
});

const camposArticulo = {
  nombre: z
    .string()
    .transform((v) => v.trim().replace(/\s+/g, " ").toUpperCase())
    .pipe(z.string().min(1, "Escribe el nombre").max(80, "Máximo 80 caracteres")),
  unidad: z.enum(UNIDADES.map((u) => u.valor) as [Unidad, ...Unidad[]], "Escoge la unidad"),
};

export const esquemaCrearArticulo = z.object({ ...camposArticulo, sedeId: z.uuid(), costo: costoOpcional });
export const esquemaEditarArticulo = z.object({ ...camposArticulo, id: z.uuid() });

export const esquemaDatosInventario = z.object({
  fecha: z.iso.date("Escoge la fecha"),
  nota: z
    .string()
    .trim()
    .max(120, "Máximo 120 caracteres")
    .transform((v) => (v === "" ? null : v)),
});

// ───────────────────────── CSV para Excel ─────────────────────────

/** Celda CSV: entre comillas si trae `;`, comillas o saltos de línea. */
function celda(v: string | number | null): string {
  const t = v === null ? "" : String(v);
  return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

const cantidadCsv = (v: number) => String(v).replace(".", ",");

/**
 * CSV que Excel en español abre directo: separador `;`, coma decimal, BOM UTF-8 (tildes).
 * Valores en pesos enteros sin separador de miles, para que Excel los pueda sumar.
 */
export function armarCsvInventario(datos: {
  sede: string;
  nit: string | null;
  fecha: string;
  estado: "en_curso" | "finalizado";
  nota: string | null;
  lineas: LineaInventario[];
}): string {
  const { productos, articulos } = agruparLineas(datos.lineas);
  const t = calcularTotales(datos.lineas);
  const filas: (string | number | null)[][] = [
    ["Inventario", datos.sede],
    ...(datos.nit ? [["NIT", datos.nit]] : []),
    ["Fecha", datos.fecha],
    ["Estado", datos.estado === "finalizado" ? "Finalizado" : "EN CURSO"],
    ...(datos.nota ? [["Nota", datos.nota]] : []),
    [],
    ["Grupo", "Nombre", "Unidad", "Cantidad", "Costo unitario", "Valor"],
    ...[...productos, ...articulos].map((l) => [
      esArticulo(l) ? "Materia prima" : "Producto",
      l.nombre,
      nombreUnidad(l.unidad, l.cantidad),
      cantidadCsv(l.cantidad),
      l.costo,
      l.costo === null ? "sin costo" : (l.valor ?? Math.round(l.cantidad * l.costo)),
    ]),
    [],
    ["", "", "", "", "Productos", t.productos],
    ["", "", "", "", "Materias primas", t.articulos],
    ["", "", "", "", "TOTAL", t.total],
    ...(t.sinCosto ? [["", "", "", "", "Líneas sin costo (no suman)", t.sinCosto]] : []),
  ];
  return "\uFEFF" + filas.map((f) => f.map(celda).join(";")).join("\r\n") + "\r\n";
}

/** "inventario-panaderia-centro-2026-10-31.csv" */
export function nombreArchivoCsv(sede: string, fecha: string): string {
  const base = sede
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `inventario-${base || "sede"}-${fecha}.csv`;
}
