"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { AbrirTurno as AbrirTurnoTipo } from "./AbrirTurno";

const AbrirTurno = dynamic(
  () => import("./AbrirTurno").then((m) => m.AbrirTurno),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen flex-col bg-fondo">
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-texto-2">
            <div className="size-8 animate-spin rounded-full border-2 border-primario border-t-transparent" />
            <p className="text-sm font-medium">Cargando turno…</p>
          </div>
        </div>
      </div>
    ),
  }
);

export function AbrirTurnoDinamico(props: ComponentProps<typeof AbrirTurnoTipo>) {
  return <AbrirTurno {...props} />;
}
