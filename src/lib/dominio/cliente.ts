/** Cliente de la venta. Si no da sus datos: Consumidor Final (código de la DIAN). */

export const TIPOS_DOCUMENTO = [
  { valor: "CC", nombre: "Cédula" },
  { valor: "NIT", nombre: "NIT" },
  { valor: "CE", nombre: "Cédula de extranjería" },
  { valor: "PP", nombre: "Pasaporte" },
  { valor: "TI", nombre: "Tarjeta de identidad" },
] as const;

export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number]["valor"];

export type Cliente = { tipo: TipoDocumento; documento: string; nombre: string };

export const CONSUMIDOR_FINAL: Cliente = { tipo: "CC", documento: "222222222222", nombre: "Consumidor Final" };

export const esConsumidorFinal = (c: { documento: string } | null | undefined) =>
  !c || c.documento === CONSUMIDOR_FINAL.documento;

/** Valida y normaliza. Devuelve el cliente o los errores por campo. */
export function validarCliente(datos: { tipo: string; documento: string; nombre: string }):
  | { ok: true; cliente: Cliente }
  | { ok: false; errores: Partial<Record<keyof Cliente, string>> } {
  const errores: Partial<Record<keyof Cliente, string>> = {};
  const tipo = TIPOS_DOCUMENTO.find((t) => t.valor === datos.tipo)?.valor;
  const documento = datos.documento.replace(/[\s.]/g, "");
  const nombre = datos.nombre.trim().replace(/\s+/g, " ");

  if (!tipo) errores.tipo = "Escoge el tipo";
  if (!/^[0-9]{3,15}(-[0-9])?$/.test(documento)) {
    errores.documento = tipo === "NIT" ? "Solo números (con dígito de verificación: 900123456-7)" : "Solo números, de 3 a 15";
  }
  if (nombre.length < 1 || nombre.length > 100) errores.nombre = "Escribe el nombre";

  if (Object.keys(errores).length > 0 || !tipo) return { ok: false, errores };
  return { ok: true, cliente: { tipo, documento, nombre } };
}

export const textoCliente = (c: Cliente) => `${c.nombre} (${c.tipo === "CC" && esConsumidorFinal(c) ? "" : `${c.tipo} `}${c.documento})`;
