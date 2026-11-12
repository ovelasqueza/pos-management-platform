import { hoyBogota } from "./fechas";

export type FilaExportarProductoSede = {
  nombre: string;
  categoria: string | null;
  precioVenta: number;
  costo: number | null;
  habilitado: boolean;
  activo: boolean;
};

/** Celda CSV: entre comillas si trae `;`, comillas o saltos de línea. */
function celda(v: string | number | null): string {
  const t = v === null ? "" : String(v);
  return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

/** Nombre de archivo seguro: "productos-asadero-la-estacion-del-pollo-2026-11-12.csv" */
export function nombreArchivoCsvProductos(sede: string, fecha = hoyBogota()): string {
  const base = sede
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `productos-${base || "sede"}-${fecha}.csv`;
}

/**
 * Genera el CSV compatible con Excel en español:
 * - Separador `;`
 * - BOM UTF-8 (\uFEFF) para que Excel respete acentos y caracteres especiales sin importar la versión de Windows.
 * - Productos separados por Activos y Desactivados.
 * - Valores numéricos puros (sin '$') para que Excel pueda sumar y calcular automáticamente.
 */
export function armarCsvProductosSede(datos: {
  sede: string;
  filas: FilaExportarProductoSede[];
  fecha?: string;
}): string {
  const fecha = datos.fecha ?? hoyBogota();
  const activos = datos.filas
    .filter((f) => f.habilitado && f.activo)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const desactivados = datos.filas
    .filter((f) => !f.habilitado || !f.activo)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  const lineas: (string | number | null)[][] = [
    ["PRODUCTOS POR SEDE", datos.sede],
    ["Fecha de exportación", fecha],
    ["Total productos activos", activos.length],
    ["Total productos desactivados", desactivados.length],
    [],
    ["--- PRODUCTOS ACTIVOS ---"],
    ["Producto", "Categoría", "Precio venta", "Costo", "Estado"],
    ...activos.map((p) => [
      p.nombre,
      p.categoria ?? "Sin categoría",
      p.precioVenta,
      p.costo ?? "",
      "Activo",
    ]),
    [],
    ["--- PRODUCTOS DESACTIVADOS ---"],
    ["Producto", "Categoría", "Precio venta", "Costo", "Estado"],
    ...desactivados.map((p) => [
      p.nombre,
      p.categoria ?? "Sin categoría",
      p.precioVenta,
      p.costo ?? "",
      !p.activo ? "Inactivo general" : "Desactivado en esta sede",
    ]),
  ];

  return "\uFEFF" + lineas.map((f) => f.map(celda).join(";")).join("\r\n") + "\r\n";
}
