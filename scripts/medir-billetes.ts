/**
 * Muestra el tamaño (ancho x alto) de las imágenes WebP de public/billetes.
 * Uso: npx tsx scripts/medir-billetes.ts
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "public", "billetes");

function medir(b: Buffer): string {
  const tipo = b.toString("ascii", 12, 16);
  let w = 0;
  let h = 0;
  if (tipo === "VP8X") {
    w = 1 + b.readUIntLE(24, 3);
    h = 1 + b.readUIntLE(27, 3);
  } else if (tipo === "VP8 ") {
    w = b.readUInt16LE(26) & 0x3fff;
    h = b.readUInt16LE(28) & 0x3fff;
  } else if (tipo === "VP8L") {
    const v = b.readUInt32LE(21);
    w = (v & 0x3fff) + 1;
    h = ((v >> 14) & 0x3fff) + 1;
  } else return `formato desconocido (${tipo})`;
  return `${w}x${h} (proporción ${(w / h).toFixed(2)})`;
}

for (const f of readdirSync(dir).sort()) {
  console.log(`${f.padEnd(28)} ${medir(readFileSync(join(dir, f)))}`);
}
