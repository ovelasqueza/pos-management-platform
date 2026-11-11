"use client";

import { useSyncExternalStore } from "react";

/** Anchos de papel soportados por la impresora térmica. */
export const ANCHOS_PAPEL = [80, 58] as const;
export type AnchoPapel = (typeof ANCHOS_PAPEL)[number];

export const ANCHO_PAPEL_POR_DEFECTO: AnchoPapel = 80;

const CLAVE = "pos:ancho-papel";
const EVENTO = "pos:ancho-papel-cambio";

export function normalizarAnchoPapel(valor: unknown): AnchoPapel {
  return String(valor).trim() === "58" ? 58 : ANCHO_PAPEL_POR_DEFECTO;
}

/** Lee el ancho elegido en este equipo. */
export function leerAnchoPapel(): AnchoPapel {
  if (typeof window === "undefined") return ANCHO_PAPEL_POR_DEFECTO;
  try {
    return normalizarAnchoPapel(window.localStorage.getItem(CLAVE));
  } catch {
    return ANCHO_PAPEL_POR_DEFECTO;
  }
}

/** Guarda el ancho para este equipo y avisa a las demás pantallas abiertas. */
export function guardarAnchoPapel(ancho: AnchoPapel): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLAVE, String(ancho));
  } catch {
    // Sin almacenamiento disponible: se mantiene el valor por defecto en esta sesión.
  }
  window.dispatchEvent(new Event(EVENTO));
}

function suscribir(alCambiar: () => void): () => void {
  window.addEventListener(EVENTO, alCambiar);
  window.addEventListener("storage", alCambiar);
  return () => {
    window.removeEventListener(EVENTO, alCambiar);
    window.removeEventListener("storage", alCambiar);
  };
}

/** Ancho de papel reactivo: cambia a la vez en tickets, reportes y vista previa. */
export function useAnchoPapel(): AnchoPapel {
  return useSyncExternalStore(suscribir, leerAnchoPapel, () => ANCHO_PAPEL_POR_DEFECTO);
}
