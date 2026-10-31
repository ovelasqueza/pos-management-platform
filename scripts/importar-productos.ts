/**
 * Importa productos desde el CSV del software anterior a un catálogo.
 *
 *   npm run importar-productos -- <archivo.csv>              → solo analiza (no escribe nada)
 *   npm run importar-productos -- <archivo.csv> --aplicar    → crea categorías y productos
 *
 * Opciones: --tipo=panaderia|asadero (por defecto panaderia) · --listar (en el análisis, muestra cada producto)
 *
 * Columnas usadas: "Nombre Producto", "Precio Venta", "Categoria", "Unidad de Medida".
 * Se ignoran: Costo (en el CSV es un valor de relleno; el costo real va por sede),
 * Inventario (el inventario mensual es independiente), impuestos y códigos.
 * Es idempotente: no duplica categorías ni productos que ya existan (mismo nombre).
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

type Fila = { linea: number; nombre: string; precio: number | null; categoria: string | null; unidad: string };

const args = process.argv.slice(2);
const archivo = args.find((a) => !a.startsWith("--"));
const aplicar = args.includes("--aplicar");
const tipo = (args.find((a) => a.startsWith("--tipo="))?.split("=")[1] ?? "panaderia") as "panaderia" | "asadero";

if (!archivo || !["panaderia", "asadero"].includes(tipo)) {
  console.error("Uso: npm run importar-productos -- <archivo.csv> [--tipo=panaderia|asadero] [--aplicar]");
  process.exit(1);
}

/** Lee el archivo como UTF-8; si trae caracteres inválidos, como Windows-1252. */
function leerTexto(ruta: string): string {
  const bytes = readFileSync(ruta);
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  return utf8.includes("\uFFFD") ? new TextDecoder("windows-1252").decode(bytes) : utf8;
}

/** CSV separado por ";" con comillas dobles opcionales. */
function parsearCSV(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ";") {
      fila.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(campo);
      if (fila.some((v) => v.trim() !== "")) filas.push(fila);
      fila = [];
      campo = "";
    } else campo += c;
  }
  if (campo || fila.length) {
    fila.push(campo);
    if (fila.some((v) => v.trim() !== "")) filas.push(fila);
  }
  return filas;
}

const limpiar = (v: string | undefined) => (v ?? "").replace(/\s+/g, " ").trim();
const clave = (v: string) => v.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// Decisiones del usuario (2026-10-28) para el CSV del software anterior:
// categorías en MAYÚSCULAS; "Cerveza" y "cervezas" se unen en "CERVEZAS".
const ALIAS_CATEGORIA: Record<string, string> = { CERVEZA: "CERVEZAS" };
// Correcciones puntuales de nombres que vienen dañados en el archivo.
const CORRECCION_NOMBRE: Record<string, string> = {
  "NIDO DE FRUTAS ?CHOCOLATE": "NIDO DE FRUTAS Y CHOCOLATE",
  // Asadero (2026-10-30): la medida venía en "ml"
  "GASEOSA 1.5 ML": "GASEOSA 1.5 LITROS",
  "GASEOSA 2.5 ML": "GASEOSA 2.5 LITROS",
};
// Asadero (2026-10-30): productos sin categoría o en una categoría equivocada
const CATEGORIA_POR_PRODUCTO: Record<string, string> = {
  "ALMUERZO CON CHULETA DE POLLO": "ALMUERZOS Y BANDEJAS",
  "BANDEJA CON CHULETA DE CERDO": "ALMUERZOS Y BANDEJAS",
  "PORCION CHULETA CERDO": "PORCIONES",
  MADURO: "PORCIONES",
};

function normalizarCategoria(v: string): string | null {
  // Quita símbolos sueltos al inicio (el CSV de asadero trae "¨Porciones")
  const c = limpiar(v).replace(/^[^\p{L}\p{N}]+/u, "").toLocaleUpperCase("es-CO");
  return c ? (ALIAS_CATEGORIA[c] ?? c) : null;
}

// Regla: nombres en MAYÚSCULAS (el CSV de asadero trae "GASEOSA 250 ml")
const normalizarNombre = (v: string) => {
  const n = limpiar(v).toLocaleUpperCase("es-CO");
  return CORRECCION_NOMBRE[n] ?? n;
};

function leerFilas(): Fila[] {
  const [encabezado, ...datos] = parsearCSV(leerTexto(archivo!));
  const col = (nombre: string) => {
    const i = encabezado.findIndex((h) => limpiar(h).toLowerCase() === nombre.toLowerCase());
    if (i < 0) throw new Error(`No se encontró la columna "${nombre}"`);
    return i;
  };
  const iNombre = col("Nombre Producto");
  const iPrecio = col("Precio Venta");
  const iCategoria = col("Categoria");
  const iUnidad = col("Unidad de Medida");

  return datos.map((d, n) => {
    const precioTexto = limpiar(d[iPrecio]).replace(",", ".");
    const precioNum = Number(precioTexto);
    const precio = precioTexto !== "" && Number.isFinite(precioNum) && Number.isInteger(precioNum) ? precioNum : null;
    const nombre = normalizarNombre(d[iNombre] ?? "");
    return {
      linea: n + 2,
      nombre,
      precio,
      categoria: CATEGORIA_POR_PRODUCTO[nombre] ?? normalizarCategoria(d[iCategoria] ?? ""),
      unidad: limpiar(d[iUnidad]).toLowerCase(),
    };
  });
}

async function main() {
  const filas = leerFilas();
  const problemas: string[] = [];
  const validas: Fila[] = [];
  const vistos = new Map<string, number>();

  for (const f of filas) {
    if (!f.nombre) {
      problemas.push(`línea ${f.linea}: sin nombre (omitida)`);
      continue;
    }
    if (f.nombre.length > 80) {
      problemas.push(`línea ${f.linea}: nombre de más de 80 caracteres (omitida): ${f.nombre}`);
      continue;
    }
    if (f.precio === null || f.precio < 1 || f.precio > 999_999_999) {
      problemas.push(`línea ${f.linea}: precio inválido "${f.precio ?? "vacío o decimal"}" (omitida): ${f.nombre}`);
      continue;
    }
    const k = clave(f.nombre);
    if (vistos.has(k)) {
      problemas.push(`línea ${f.linea}: duplicado de la línea ${vistos.get(k)} (omitida): ${f.nombre}`);
      continue;
    }
    vistos.set(k, f.linea);
    validas.push(f);
  }

  const conSigno = validas.filter((f) => f.nombre.includes("?") || f.categoria?.includes("?"));
  const noUnidad = validas.filter((f) => f.unidad && !["unidad", "und", "un", "u"].includes(f.unidad));
  const categorias = [...new Set(validas.map((f) => f.categoria).filter((c): c is string => Boolean(c)))].sort();
  const sinCategoria = validas.filter((f) => !f.categoria).length;

  console.log(`Archivo: ${archivo}`);
  console.log(`Catálogo destino: ${tipo}`);
  console.log(`Filas leídas: ${filas.length} · válidas: ${validas.length} · omitidas: ${filas.length - validas.length}`);
  console.log(`\nCategorías (${categorias.length}):`);
  for (const c of categorias) console.log(`  - ${c} (${validas.filter((f) => f.categoria === c).length})`);
  if (sinCategoria) console.log(`  - (sin categoría) (${sinCategoria})`);

  const precios = validas.map((f) => f.precio!).sort((a, b) => a - b);
  console.log(`\nPrecios: mín $${precios[0]} · máx $${precios.at(-1)}`);

  if (conSigno.length) {
    console.log(`\nCon "?" en el nombre (probablemente una Ñ o tilde perdida en el archivo) (${conSigno.length}):`);
    for (const f of conSigno) console.log(`  línea ${f.linea}: ${f.nombre}${f.categoria?.includes("?") ? ` [cat: ${f.categoria}]` : ""}`);
  }
  if (noUnidad.length) {
    console.log(`\nUnidad distinta de "unidad" (se importan igual, se venden por unidad) (${noUnidad.length}):`);
    for (const f of noUnidad) console.log(`  línea ${f.linea}: ${f.nombre} (${f.unidad})`);
  }
  if (problemas.length) {
    console.log(`\nOmitidas (${problemas.length}):`);
    for (const p of problemas) console.log(`  ${p}`);
  }

  if (!aplicar) {
    if (args.includes("--listar")) {
      console.log("\nProductos a importar:");
      for (const c of [...categorias, null]) {
        const grupo = validas.filter((f) => f.categoria === c);
        if (!grupo.length) continue;
        console.log(`\n  ${c ?? "(sin categoría)"}`);
        for (const f of grupo) console.log(`    ${f.nombre} · $${f.precio}`);
      }
    }
    console.log("\nSolo análisis: no se escribió nada. Para importar agrega --aplicar.");
    return;
  }

  // ───────────── Importación ─────────────
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secreta = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secreta) throw new Error("Faltan variables en .env.local");
  const s = createClient(url, secreta, { auth: { persistSession: false } });

  // Categorías: reutiliza las existentes (sin distinguir mayúsculas)
  const { data: existentesCat, error: e1 } = await s.from("categorias").select("id, nombre").eq("tipo", tipo);
  if (e1) throw e1;
  const idCategoria = new Map(existentesCat.map((c) => [clave(c.nombre), c.id as string]));
  const nuevasCat = categorias.filter((c) => !idCategoria.has(clave(c)));
  if (nuevasCat.length) {
    const { data, error } = await s
      .from("categorias")
      .insert(nuevasCat.map((nombre) => ({ tipo, nombre: nombre.slice(0, 40) })))
      .select("id, nombre");
    if (error) throw error;
    for (const c of data) idCategoria.set(clave(c.nombre), c.id);
  }

  // Productos: omite los que ya existen por nombre
  const { data: existentesProd, error: e2 } = await s.from("productos").select("nombre").eq("tipo", tipo);
  if (e2) throw e2;
  const yaExisten = new Set(existentesProd.map((p) => clave(p.nombre)));
  const nuevos = validas.filter((f) => !yaExisten.has(clave(f.nombre)));

  // Por lotes; el trigger de la BD los habilita en todas las sedes del tipo al precio de venta
  const LOTE = 100;
  for (let i = 0; i < nuevos.length; i += LOTE) {
    const { error } = await s.from("productos").insert(
      nuevos.slice(i, i + LOTE).map((f) => ({
        tipo,
        nombre: f.nombre,
        precio_referencia: f.precio,
        categoria_id: f.categoria ? (idCategoria.get(clave(f.categoria.slice(0, 40))) ?? null) : null,
      })),
    );
    if (error) throw error;
  }

  console.log(`\nListo: ${nuevasCat.length} categorías y ${nuevos.length} productos creados (${validas.length - nuevos.length} ya existían).`);
}

main().catch((e) => {
  console.error(`\nError: ${e.message ?? e}`);
  process.exit(1);
});
