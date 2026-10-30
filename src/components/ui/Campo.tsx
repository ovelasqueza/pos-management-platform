"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { CircleAlert } from "lucide-react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  etiqueta: string;
  error?: string;
  icono?: ReactNode;
  /** Oculta la etiqueta visualmente (sigue disponible para lectores de pantalla) */
  etiquetaOculta?: boolean;
};

export function Campo({
  etiqueta,
  error,
  icono,
  etiquetaOculta,
  className = "",
  id,
  ...resto
}: Props) {
  const idGenerado = useId();
  const idCampo = id ?? idGenerado;
  const idError = `${idCampo}-error`;

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={idCampo}
        className={
          etiquetaOculta ? "sr-only" : "text-sm font-semibold text-texto-2"
        }
      >
        {etiqueta}
      </label>
      <div className="relative">
        {icono && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-texto-3">
            {icono}
          </span>
        )}
        <input
          id={idCampo}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? idError : undefined}
          className={`min-h-12 w-full rounded-control border bg-superficie px-4 text-base placeholder:text-texto-3 focus:outline-none focus:ring-1 ${
            error
              ? "border-peligro focus:border-peligro focus:ring-peligro"
              : "border-borde-activo focus:border-primario focus:ring-primario"
          } ${icono ? "pl-10" : ""} ${className}`}
          {...resto}
        />
      </div>
      {error && (
        <p id={idError} className="flex items-center gap-1 text-sm text-peligro">
          <CircleAlert size={16} aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}
