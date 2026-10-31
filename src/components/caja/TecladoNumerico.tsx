"use client";

import { useRef } from "react";
import { Delete } from "lucide-react";
import { aplicarTecla } from "@/lib/dominio/cobro";
import { useTecladoFisico } from "./tecladoFisico";

const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "borrar"] as const;

type Props = {
  valor: string;
  onCambiar: (v: string) => void;
  /** Enter del teclado físico (p. ej. continuar o confirmar) */
  onEnter?: () => void;
};

/**
 * Teclado numérico táctil (teclas de 56 px).
 * También funciona con el teclado físico: dígitos, Retroceso, Supr (limpiar) y Enter.
 */
export function TecladoNumerico({ valor, onCambiar, onEnter }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useTecladoFisico(ref, (t) => {
    if (t === "enter") {
      if (!onEnter) return false;
      onEnter();
      return;
    }
    onCambiar(aplicarTecla(valor, t));
  });

  return (
    <div ref={ref} className="grid grid-cols-3 gap-2">
      {TECLAS.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onCambiar(t === "000" ? aplicarTecla(aplicarTecla(aplicarTecla(valor, "0"), "0"), "0") : aplicarTecla(valor, t))}
          aria-label={t === "borrar" ? "Borrar" : t}
          className="num flex min-h-14 items-center justify-center rounded-control border border-borde bg-superficie text-xl font-semibold active:bg-suave"
        >
          {t === "borrar" ? <Delete size={22} aria-hidden /> : t}
        </button>
      ))}
    </div>
  );
}

/** Muestra un monto grande en mono a partir del texto del teclado. */
export function PantallaMonto({ etiqueta, texto }: { etiqueta: string; texto: string }) {
  const valor = Number(texto || "0");
  return (
    <div className="rounded-tarjeta border border-borde-activo bg-superficie px-4 py-3 text-right">
      <p className="text-left text-sm text-texto-3">{etiqueta}</p>
      <p className="num text-4xl font-bold tracking-tight" aria-live="polite">
        $ {new Intl.NumberFormat("es-CO").format(valor)}
      </p>
    </div>
  );
}
