import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";

type Tipo = "error" | "advertencia" | "exito";

const estilos: Record<Tipo, string> = {
  error: "bg-peligro-suave border-peligro-borde text-peligro",
  advertencia: "bg-advertencia-suave border-advertencia/40 text-advertencia",
  exito: "bg-exito-suave border-primario/30 text-primario-activo",
};

const iconos: Record<Tipo, ReactNode> = {
  error: <CircleAlert size={20} aria-hidden />,
  advertencia: <TriangleAlert size={20} aria-hidden />,
  exito: <CircleCheck size={20} aria-hidden />,
};

type Props = {
  tipo?: Tipo;
  children: ReactNode;
  /** Acción opcional a la derecha (p. ej. botón Reintentar) */
  accion?: ReactNode;
};

/** Aviso de una línea con ícono. Se anuncia a lectores de pantalla. */
export function Aviso({ tipo = "error", children, accion }: Props) {
  return (
    <div
      role={tipo === "error" ? "alert" : "status"}
      className={`flex items-center gap-2 rounded-tarjeta border px-4 py-3 text-sm font-medium ${estilos[tipo]}`}
    >
      {iconos[tipo]}
      <span className="flex-1">{children}</span>
      {accion}
    </div>
  );
}
