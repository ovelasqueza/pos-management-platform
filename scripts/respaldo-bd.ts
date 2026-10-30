/**
 * Respaldo de la base de datos (solo lectura) a archivos JSON en respaldos/AAAA-MM-DD_HHMM/.
 * Uso: npm run respaldo-bd   (lee .env.local; necesita SUPABASE_SECRET_KEY)
 *
 * El plan gratuito de Supabase no hace copias automáticas: ejecutar al menos 1 vez por semana
 * y guardar la carpeta en otro lugar (USB, Google Drive).
 * Las fotos de productos no se respaldan aquí (siguen en Storage).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const TABLAS = [
  "sedes", "perfiles", "categorias", "productos", "productos_sede", "costos_producto_sede",
  "contadores_venta", "turnos", "ventas", "lineas_venta", "gastos",
];
const LOTE = 1000;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SECRET_KEY;
if (!url || !clave) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en .env.local");
  process.exit(1);
}
const s = createClient(url, clave, { auth: { persistSession: false } });

async function leerTodo(tabla: string): Promise<unknown[]> {
  const filas: unknown[] = [];
  for (let desde = 0; ; desde += LOTE) {
    const { data, error } = await s.from(tabla).select("*").range(desde, desde + LOTE - 1);
    if (error) throw new Error(`${tabla}: ${error.message}`);
    filas.push(...data);
    if (data.length < LOTE) return filas;
  }
}

async function main() {
  const marca = new Date().toLocaleString("sv-SE", { timeZone: "America/Bogota" }).slice(0, 16).replace(" ", "_").replace(":", "");
  const carpeta = join(process.cwd(), "respaldos", marca);
  mkdirSync(carpeta, { recursive: true });

  let total = 0;
  for (const tabla of TABLAS) {
    const filas = await leerTodo(tabla);
    writeFileSync(join(carpeta, `${tabla}.json`), JSON.stringify(filas, null, 1));
    total += filas.length;
    console.log(`${tabla.padEnd(22)} ${filas.length} filas`);
  }
  console.log(`\nRespaldo listo: ${carpeta} (${total} filas). Cópialo fuera de este equipo.`);
}

main().catch((e) => {
  console.error(`Error: ${e.message ?? e}`);
  process.exit(1);
});
