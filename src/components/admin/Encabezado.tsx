import type { ReactNode } from "react";
import { Construction } from "lucide-react";

export function Encabezado({ titulo, accion }: { titulo: string; accion?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold">{titulo}</h1>
      {accion}
    </div>
  );
}

/** Sección aún no construida (se completa en la spec indicada). */
export function Pendiente({ titulo, spec }: { titulo: string; spec: string }) {
  return (
    <section className="flex flex-col gap-4">
      <Encabezado titulo={titulo} />
      <div className="flex flex-col items-center gap-2 rounded-tarjeta border border-dashed border-borde-activo p-10 text-texto-3">
        <Construction size={32} aria-hidden />
        <p>Próximamente ({spec})</p>
      </div>
    </section>
  );
}
