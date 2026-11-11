"use client";

import { useSyncExternalStore } from "react";
import { ANCHO_PAPEL_POR_DEFECTO, leerAnchoPapel, suscribirAnchoPapel, type AnchoPapel } from "./papel";

/** Ancho de papel reactivo: cambia a la vez en tickets, reportes y vista previa. */
export function useAnchoPapel(): AnchoPapel {
  return useSyncExternalStore(suscribirAnchoPapel, leerAnchoPapel, () => ANCHO_PAPEL_POR_DEFECTO);
}
