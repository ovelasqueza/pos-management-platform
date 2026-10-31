"use client";

type Props = {
  activo: boolean;
  onCambiar: (activo: boolean) => void;
  etiqueta: string;
  deshabilitado?: boolean;
};

/**
 * Interruptor accesible (role="switch"). Área táctil de 48 px.
 * La perilla blanca se desliza a la derecha cuando está activo.
 * Mientras se guarda no se atenúa (evita el parpadeo): solo ignora toques.
 */
export function Interruptor({ activo, onCambiar, etiqueta, deshabilitado }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      aria-busy={deshabilitado || undefined}
      onClick={() => {
        if (!deshabilitado) onCambiar(!activo);
      }}
      className={`flex size-12 items-center justify-center rounded-control [-webkit-tap-highlight-color:transparent] ${
        deshabilitado ? "cursor-wait" : "cursor-pointer"
      }`}
    >
      <span
        aria-hidden
        className="relative block h-7 w-12 rounded-full transition-colors duration-200 ease-out"
        style={{ backgroundColor: activo ? "var(--color-primario)" : "var(--color-borde-activo)" }}
      >
        <span
          className="absolute top-0.5 left-0.5 block size-6 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out"
          style={{ transform: activo ? "translateX(20px)" : "translateX(0)" }}
        />
      </span>
    </button>
  );
}
