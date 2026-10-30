"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

type Props = {
  abierto: boolean;
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
  /** Ancho máximo del contenido */
  ancho?: "sm" | "md" | "lg";
};

const anchos = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-3xl" };

/** Modal accesible sobre <dialog> nativo (foco atrapado y Escape incluidos). */
export function Modal({ abierto, titulo, onCerrar, children, ancho = "md" }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (abierto && !dialogo.open) dialogo.showModal();
    if (!abierto && dialogo.open) dialogo.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      onClose={onCerrar}
      onCancel={(e) => {
        e.preventDefault();
        onCerrar();
      }}
      aria-labelledby="modal-titulo"
      className={`m-auto w-[calc(100%-2rem)] ${anchos[ancho]} rounded-modal border border-borde-activo bg-superficie p-0 text-texto shadow-modal backdrop:bg-texto/25`}
    >
      <div className="flex items-center justify-between border-b border-borde px-5 py-3">
        <h2 id="modal-titulo" className="text-lg font-semibold">
          {titulo}
        </h2>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          className="flex size-12 items-center justify-center rounded-control text-texto-3 hover:bg-suave"
        >
          <X size={22} />
        </button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  );
}
