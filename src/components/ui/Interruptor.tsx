"use client";

type Props = {
  activo: boolean;
  onCambiar: (activo: boolean) => void;
  etiqueta: string;
  deshabilitado?: boolean;
};

/** Interruptor accesible (role="switch"). Área táctil de 48 px. */
export function Interruptor({ activo, onCambiar, etiqueta, deshabilitado }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      disabled={deshabilitado}
      onClick={() => onCambiar(!activo)}
      className="flex size-12 items-center justify-center disabled:opacity-50"
    >
      <span
        className={`relative h-6 w-11 rounded-full transition-colors ${
          activo ? "bg-primario" : "bg-borde-activo"
        }`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white transition-transform ${
            activo ? "translate-x-5.5" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}
