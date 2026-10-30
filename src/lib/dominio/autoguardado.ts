/**
 * Lógica pura del guardado automático de un campo (precio, costo, cantidad).
 * Sin React: decide qué hacer cuando el usuario sale del campo o pulsa Enter.
 */

export type EstadoAutoguardado = "inicial" | "guardando" | "guardado" | "error-red" | "invalido";

export type Decision<T> =
  | { tipo: "nada" } // no cambió: no se guarda ni cuenta como modificación
  | { tipo: "revertir" } // inválido: marcar en rojo y volver al valor anterior
  | { tipo: "guardar"; valor: T };

/**
 * @param texto lo escrito en el campo
 * @param guardado último valor confirmado por la BD (null = vacío, p. ej. sin costo)
 * @param leer convierte el texto en valor o null si es inválido
 * @param tocado si el usuario escribió algo en el campo
 */
export function decidir<T>(
  texto: string,
  guardado: T | null,
  leer: (t: string) => T | null,
  tocado: boolean,
): Decision<T> {
  if (!tocado) return { tipo: "nada" };
  const valor = leer(texto);
  if (valor === null) return { tipo: "revertir" };
  if (valor === guardado) return { tipo: "nada" };
  return { tipo: "guardar", valor };
}
