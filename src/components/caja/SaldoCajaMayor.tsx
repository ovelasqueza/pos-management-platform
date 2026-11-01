"use client";

import { Landmark } from "lucide-react";
import { formatearPesos } from "@/lib/dominio/dinero";
import { METODOS } from "@/lib/dominio/cobro";
import type { SaldoCajaMayor as Saldo } from "@/lib/dominio/cajaMayor";

/** Saldo de la caja mayor de la sede (solo lectura para el cajero). */
export function SaldoCajaMayor({ saldo, cargando }: { saldo: Saldo | null; cargando?: boolean }) {
  const valor = (n: number | undefined) => (saldo && n !== undefined ? formatearPesos(n) : cargando ? "…" : "—");

  return (
    <section aria-label="Saldo de caja mayor" className="rounded-tarjeta border border-borde bg-fondo p-3">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-texto-3">
        <Landmark size={16} aria-hidden /> Caja mayor
      </p>
      <dl className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
        {METODOS.map((m) => (
          <div key={m.valor}>
            <dt className="text-xs text-texto-3">{m.nombre}</dt>
            <dd className="num text-sm font-semibold">{valor(saldo?.[m.valor])}</dd>
          </div>
        ))}
        <div className="rounded-control border border-primario bg-exito-suave px-3 py-1 text-right text-primario-activo">
          <dt className="text-xs font-semibold">Total</dt>
          <dd className="num font-bold">{valor(saldo?.total)}</dd>
        </div>
      </dl>
    </section>
  );
}
