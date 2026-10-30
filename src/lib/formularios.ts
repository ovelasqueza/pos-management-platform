/** Resultado estándar de una Server Action de formulario. */
export type EstadoFormulario = {
  ok?: boolean;
  error?: string;
  campos?: Record<string, string>;
  /** Cambia en cada envío exitoso para que el cliente cierre el modal */
  marca?: number;
};

/** Convierte errores de zod en { campo: mensaje } (primer mensaje por campo). */
export function erroresPorCampo(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const issue of issues) {
    const clave = String(issue.path[0] ?? "formulario");
    campos[clave] ??= issue.message;
  }
  return campos;
}

export const exito = (): EstadoFormulario => ({ ok: true, marca: Date.now() });
