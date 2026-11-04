/**
 * Agente del cajón (herramientas/cajon): programa pequeño que corre en el equipo de la caja,
 * escucha solo en 127.0.0.1 y manda a la impresora el comando de apertura sin imprimir nada.
 */
const AGENTE_CAJON = "http://127.0.0.1:17777";

/**
 * Abre el cajón con el agente. Devuelve false si el agente no está instalado,
 * no respondió a tiempo o no pudo abrir (la caja usa entonces la impresión mínima).
 */
export async function abrirCajonSinPapel(): Promise<boolean> {
  try {
    // POST sin cuerpo ni encabezados: petición simple, sin preflight
    const r = await fetch(`${AGENTE_CAJON}/abrir`, { method: "POST", signal: AbortSignal.timeout(1500) });
    if (!r.ok) return false;
    const d = (await r.json()) as { ok?: boolean };
    return d.ok === true;
  } catch {
    return false;
  }
}
