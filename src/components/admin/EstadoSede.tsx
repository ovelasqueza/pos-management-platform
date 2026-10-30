"use client";

import { useState, useTransition } from "react";
import { Interruptor } from "@/components/ui/Interruptor";
import { cambiarEstadoSede } from "@/app/admin/acciones-sedes";

/** Interruptor activa/inactiva con el error en línea si la BD lo rechaza. */
export function EstadoSede({ id, nombre, activa }: { id: string; nombre: string; activa: boolean }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string>();

  return (
    <div className="flex flex-col items-end">
      <Interruptor
        activo={activa}
        etiqueta={`${nombre} activa`}
        deshabilitado={pendiente}
        onCambiar={(nuevo) =>
          iniciar(async () => {
            setError(undefined);
            const r = await cambiarEstadoSede(id, nuevo);
            if (r.error) setError(r.error);
          })
        }
      />
      {error && (
        <p role="alert" className="max-w-48 text-right text-xs text-peligro">
          {error}
        </p>
      )}
    </div>
  );
}
