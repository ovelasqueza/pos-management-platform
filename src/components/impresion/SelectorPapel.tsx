"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";
import { ANCHOS_PAPEL, guardarAnchoPapel, type AnchoPapel } from "@/lib/impresion/papel";
import { useAnchoPapel } from "@/lib/impresion/useAnchoPapel";
import { cambiarAnchoPapelSede } from "@/app/admin/acciones-sedes";

type Props = {
  /** "oscuro" para la cabecera verde; "claro" para las pantallas de administración. */
  variante?: "oscuro" | "claro";
  /** Si el admin tiene una sede seleccionada, cambiar el papel también actualiza esa sede. */
  sedeId?: string;
  anchoSede?: AnchoPapel;
  className?: string;
};

/** Selector del ancho del rollo de la impresora (solo visible para el administrador). */
export function SelectorPapel({ variante = "oscuro", sedeId, anchoSede, className = "" }: Props) {
  const anchoLocal = useAnchoPapel();
  const ancho = anchoSede ?? anchoLocal;
  const oscuro = variante === "oscuro";

  useEffect(() => {
    if (anchoSede) guardarAnchoPapel(anchoSede);
  }, [anchoSede]);

  function elegir(nuevo: AnchoPapel) {
    guardarAnchoPapel(nuevo);
    if (sedeId) {
      void cambiarAnchoPapelSede(sedeId, nuevo);
    }
  }

  return (
    <div
      className={`flex min-h-12 items-center gap-1 rounded-tarjeta p-1 ${
        oscuro ? "bg-white/15 text-white" : "border border-borde bg-superficie text-texto-2"
      } ${className}`}
      role="group"
      aria-label="Ancho del papel de impresión"
      title={sedeId ? "Ancho del rollo de impresora de esta sede" : "Ancho del rollo de la impresora"}
    >
      <Printer size={18} className="ml-1 shrink-0" aria-hidden />
      {ANCHOS_PAPEL.map((a) => {
        const activo = ancho === a;
        return (
          <button
            key={a}
            type="button"
            onClick={() => elegir(a)}
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
