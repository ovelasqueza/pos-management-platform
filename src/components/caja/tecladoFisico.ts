"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Teclado físico para los teclados numéricos en pantalla.
 * Dígitos (fila superior o teclado numérico), Retroceso = borrar, Supr = limpiar, Enter = continuar.
 */
export type TeclaFisica = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "borrar" | "limpiar" | "enter";

const escribiendoEnCampo = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

/**
 * Traduce la tecla si corresponde al teclado de `contenedor`; si no, null.
 * Se ignora cuando el usuario escribe en un campo de texto, usa atajos (Ctrl/Alt),
 * el contenedor no está visible (p. ej. dentro de una ventana cerrada)
 * o hay una ventana abierta que no lo contiene.
 */
export function leerTeclaFisica(e: KeyboardEvent, contenedor: HTMLElement | null): TeclaFisica | null {
  if (!contenedor || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return null;
  if (escribiendoEnCampo(e.target)) return null;
  if (contenedor.getClientRects().length === 0) return null;
  const abierto = document.querySelector("dialog[open]");
  if (abierto && !abierto.contains(contenedor)) return null;

  if (/^[0-9]$/.test(e.key)) return e.key as TeclaFisica;
  if (e.key === "Backspace") return "borrar";
  if (e.key === "Delete") return "limpiar";
  if (e.key === "Enter") return "enter";
  return null;
}

/** Escucha el teclado físico mientras el componente esté montado. */
export function useTecladoFisico(contenedor: RefObject<HTMLElement | null>, alTeclear: (t: TeclaFisica) => boolean | void) {
  const ultimo = useRef(alTeclear);
  useEffect(() => {
    ultimo.current = alTeclear;
  });

  useEffect(() => {
    const manejar = (e: KeyboardEvent) => {
      const t = leerTeclaFisica(e, contenedor.current);
      if (!t) return;
      // false = la tecla no se usó (deja el comportamiento normal del navegador)
      if (ultimo.current(t) === false) return;
      e.preventDefault(); // evita, p. ej., que Enter también pulse el botón con el foco
    };
    window.addEventListener("keydown", manejar);
    return () => window.removeEventListener("keydown", manejar);
  }, [contenedor]);
}
