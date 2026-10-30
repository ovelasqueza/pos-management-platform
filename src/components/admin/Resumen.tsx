import type { ReactNode } from "react";
import { formatearPesos } from "@/lib/dominio/dinero";
import { formatearDia } from "@/lib/dominio/fechas";

export function Tarjeta({ titulo, valor, icono, children }: { titulo: string; valor: string; icono: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-tarjeta border border-borde bg-superficie p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-texto-3">
        {icono}
        {titulo}
      </p>
      <p className="num text-2xl font-bold tracking-tight">{valor}</p>
      {children}
    </div>
  );
}

/** Barras verticales con CSS (sin librería). */
export function GraficoBarras({ dias }: { dias: { fecha: string; total: number }[] }) {
  const maximo = Math.max(1, ...dias.map((d) => d.total));
  const etiquetaCada = Math.ceil(dias.length / 10); // máx. ~10 etiquetas

  return (
    <figure className="rounded-tarjeta border border-borde bg-superficie p-4">
      <figcaption className="mb-3 text-sm font-semibold text-texto-3">Ventas por día</figcaption>
      <div className="flex h-48 items-end gap-1" role="list">
        {dias.map((d) => (
          <div
            key={d.fecha}
            role="listitem"
            aria-label={`${formatearDia(d.fecha)}: ${formatearPesos(d.total)}`}
            title={`${formatearDia(d.fecha)}: ${formatearPesos(d.total)}`}
            className="group relative flex h-full flex-1 items-end"
          >
            <div
              className="w-full rounded-t-control bg-primario/80 group-hover:bg-primario"
              style={{ height: `${Math.max(d.total > 0 ? 2 : 0, (d.total / maximo) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1" aria-hidden>
        {dias.map((d, i) => (
          <span key={d.fecha} className="num flex-1 truncate text-center text-[10px] text-texto-3">
            {i % etiquetaCada === 0 ? formatearDia(d.fecha) : ""}
          </span>
        ))}
      </div>
    </figure>
  );
}


export const etiquetaHora = (h: number) => `${h % 12 || 12} ${h < 12 ? "a. m." : "p. m."}`;

/** Barras horizontales por hora del día: cuándo se vende más (la hora pico resaltada). */
export function BarrasPorHora({ datos, titulo }: { datos: { hora: number; ventas: number; total: number }[]; titulo?: string }) {
  if (datos.length === 0) {
    return <p className="rounded-tarjeta border border-borde bg-superficie p-6 text-center text-texto-3">Sin ventas en el periodo</p>;
  }
  // Todas las horas entre la primera y la última con ventas (las vacías se ven en 0)
  const porHora = new Map(datos.map((d) => [d.hora, d]));
  const desde = datos[0].hora;
  const hasta = datos[datos.length - 1].hora;
  const horas = Array.from({ length: hasta - desde + 1 }, (_, i) => porHora.get(desde + i) ?? { hora: desde + i, ventas: 0, total: 0 });
  const maximo = Math.max(1, ...horas.map((h) => h.total));
  const pico = horas.reduce((a, b) => (b.total > a.total ? b : a));

  return (
    <figure className="flex flex-col gap-3 rounded-tarjeta border border-borde bg-superficie p-4">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold text-texto-3">{titulo ?? "Ventas por hora"}</span>
        <span className="text-texto-3">
          Hora pico: <strong className="text-texto">{etiquetaHora(pico.hora)}</strong>
        </span>
      </figcaption>
      <ul className="flex flex-col gap-1">
        {horas.map((h) => (
          <li key={h.hora} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3">
            <span className="num text-right text-sm text-texto-3">{etiquetaHora(h.hora)}</span>
            <span className="h-5 rounded-control bg-suave">
              <span
                className={`block h-full rounded-control ${h.hora === pico.hora ? "bg-primario" : "bg-primario/50"}`}
                style={{ width: `${(h.total / maximo) * 100}%` }}
              />
            </span>
            <span className="num text-right text-sm whitespace-nowrap">
              {formatearPesos(h.total)}
              <span className="text-texto-3"> · {h.ventas}</span>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

const MEDIOS = [
  { clave: "efectivo", nombre: "Efectivo", color: "bg-primario" },
  { clave: "transferencia", nombre: "QR", color: "bg-sky-600" },
  { clave: "tarjeta", nombre: "Tarjeta", color: "bg-violet-600" },
] as const;

/** Una barra con la proporción de cada medio de pago. */
export function BarraMedios({ porMetodo }: { porMetodo: Record<(typeof MEDIOS)[number]["clave"], number> }) {
  const total = MEDIOS.reduce((s, m) => s + porMetodo[m.clave], 0);
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

  return (
    <div className="flex flex-col gap-3 rounded-tarjeta border border-borde bg-superficie p-4">
      <p className="text-sm font-semibold text-texto-3">Cómo entró la plata</p>
      <div className="flex h-4 overflow-hidden rounded-control bg-suave" aria-hidden>
        {MEDIOS.map((m) => (
          <span key={m.clave} className={m.color} style={{ width: `${total > 0 ? (porMetodo[m.clave] / total) * 100 : 0}%` }} />
        ))}
      </div>
      <ul className="grid gap-2 sm:grid-cols-3">
        {MEDIOS.map((m) => (
          <li key={m.clave} className="flex items-center gap-2">
            <span className={`size-3 shrink-0 rounded-full ${m.color}`} aria-hidden />
            <span className="text-texto-2">{m.nombre}</span>
            <span className="num ml-auto font-semibold sm:ml-2">{formatearPesos(porMetodo[m.clave])}</span>
            <span className="num text-sm text-texto-3">{pct(porMetodo[m.clave])}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
