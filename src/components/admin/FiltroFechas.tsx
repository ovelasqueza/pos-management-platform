"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { atajos } from "@/lib/dominio/fechas";

type Props = { desde: string; hasta: string; error?: string };

/** Atajos (Hoy, Ayer, 7 días, Este mes) + fechas manuales. Guarda el rango en la URL. */
export function FiltroFechas({ desde, hasta, error }: Props) {
  const router = useRouter();
  const ruta = usePathname();
  const params = useSearchParams();

  function ir(rango: { desde: string; hasta: string }) {
    const p = new URLSearchParams(params);
    p.set("desde", rango.desde);
    p.set("hasta", rango.hasta);
    p.delete("pagina");
    router.push(`${ruta}?${p}`);
  }

  const lista = atajos();
  const campo = `num min-h-12 rounded-control border bg-superficie px-3 focus:outline-none ${
    error ? "border-peligro" : "border-borde-activo focus:border-primario"
  }`;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-tarjeta bg-suave p-1" role="group" aria-label="Periodo">
          {lista.map((a) => {
            const activo = a.rango.desde === desde && a.rango.hasta === hasta;
            return (
              <button
                key={a.nombre}
                type="button"
                aria-pressed={activo}
                onClick={() => ir(a.rango)}
                className={`min-h-11 rounded-control px-3 text-sm font-medium ${
                  activo ? "border border-borde bg-superficie text-texto" : "text-texto-3"
                }`}
              >
                {a.nombre}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays size={18} className="text-texto-3" aria-hidden />
          <label className="sr-only" htmlFor="desde">
            Desde
          </label>
          <input id="desde" type="date" value={desde} aria-invalid={Boolean(error)} onChange={(e) => e.target.value && ir({ desde: e.target.value, hasta })} className={campo} />
          <span className="text-texto-3">a</span>
          <label className="sr-only" htmlFor="hasta">
            Hasta
          </label>
          <input id="hasta" type="date" value={hasta} aria-invalid={Boolean(error)} onChange={(e) => e.target.value && ir({ desde, hasta: e.target.value })} className={campo} />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-peligro">
          {error}
        </p>
      )}
    </div>
  );
}
