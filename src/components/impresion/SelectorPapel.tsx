"use client";

import { Printer } from "lucide-react";
import { ANCHOS_PAPEL, guardarAnchoPapel, useAnchoPapel } from "@/lib/impresion/papel";

type Props = {
  /** "oscuro" para la cabecera verde de la caja; "claro" para las pantallas de administración. */
  variante?: "oscuro" | "claro";
  className?: string;
};

/** Selector del ancho del rollo de la impresora. Se guarda por equipo. */
export function SelectorPapel({ variante = "oscuro", className = "" }: Props) {
  const ancho = useAnchoPapel();
  const oscuro = variante === "oscuro";

  return (
    <div
      className={`flex min-h-12 items-center gap-1 rounded-tarjeta p-1 ${
        oscuro ? "bg-white/15 text-white" : "border border-borde bg-superficie text-texto-2"
      } ${className}`}
      role="group"
      aria-label="Ancho del papel de impresión"
      title="Ancho del rollo de la impresora"
    >
      <Printer size={18} className="ml-1 shrink-0" aria-hidden />
      {ANCHOS_PAPEL.map((a) => {
        const activo = ancho === a;
        return (
          <button
            key={a}
            type="button"
            onClick={() => guardarAnchoPapel(a)}
            aria-pressed={activo}
            aria-label={`Usar papel de ${a} milímetros`}
            className={`min-h-9 rounded px-2 text-xs font-bold ${
              activo
                ? oscuro
                  ? "bg-white text-primario-activo"
                  : "bg-primario text-white"
                : oscuro
                  ? "hover:bg-white/20"
                  : "hover:bg-suave"
            }`}
          >
            {a} mm
          </button>
        );
      })}
    </div>
  );
}
