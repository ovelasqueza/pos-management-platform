import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variante = "primario" | "secundario" | "peligro" | "fantasma";
type Tamano = "md" | "lg";

const variantes: Record<Variante, string> = {
  primario:
    "bg-primario text-white font-semibold hover:bg-primario-hover active:bg-primario-activo disabled:bg-borde-activo",
  secundario:
    "bg-superficie text-texto border border-borde-activo hover:border-texto active:bg-suave",
  peligro:
    "bg-superficie text-peligro border border-peligro-borde active:bg-peligro-suave",
  fantasma: "text-texto-2 hover:bg-suave active:bg-borde",
};

const tamanos: Record<Tamano, string> = {
  md: "min-h-12 px-4 text-base",
  lg: "min-h-14 px-6 text-lg",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  tamano?: Tamano;
  icono?: ReactNode;
};

export function Boton({
  variante = "secundario",
  tamano = "md",
  icono,
  className = "",
  type = "button",
  children,
  ...resto
}: Props) {
  return (
    <button
      type={type}
      className={`inline-flex min-w-12 items-center justify-center gap-2 rounded-control transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${variantes[variante]} ${tamanos[tamano]} ${className}`}
      {...resto}
    >
      {icono}
      {children}
    </button>
  );
}
