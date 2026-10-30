import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CircleCheck, Clock, Receipt, ShoppingBag, TriangleAlert, Wallet } from "lucide-react";
import { resolverSede } from "@/lib/admin/sedes";
import {
  intentar,
  listarTurnosAbiertos,
  obtenerComparacion,
  obtenerDiferenciasCajero,
  obtenerProductosHoraPico,
  obtenerProductosVendidos,
  obtenerResumen,
  obtenerVentasPorHora,
} from "@/lib/admin/reportes";
import { diasDelRango, formatearHora, hoyBogota, leerRango, variacion, type Rango } from "@/lib/dominio/fechas";
import { formatearPesos } from "@/lib/dominio/dinero";
import { Encabezado } from "@/components/admin/Encabezado";
import { FiltroFechas } from "@/components/admin/FiltroFechas";
import { BarraMedios, BarrasPorHora, etiquetaHora, GraficoBarras, Tarjeta } from "@/components/admin/Resumen";
import { BotonVerCaja } from "@/components/admin/VerCaja";

export default async function PaginaResumen({ params, searchParams }: PageProps<"/admin/[sede]">) {
  const [{ sede: segmento }, sp] = await Promise.all([params, searchParams]);
  const sede = await resolverSede(segmento);
  const rango = leerRango(sp);

  return (
    <section className="flex flex-col gap-4">
      <Encabezado titulo={sede ? `Resumen · ${sede.nombre}` : "Resumen · Todas las sedes"} />
      <FiltroFechas desde={rango.desde} hasta={rango.hasta} error={rango.error} />
      {!rango.error && <Contenido segmento={segmento} sedeId={sede?.id ?? null} rango={rango} todas={!sede} />}
    </section>
  );
}

type Props = { segmento: string; sedeId: string | null; rango: Rango; todas: boolean };

async function Contenido({ segmento, sedeId, rango, todas }: Props) {
  const unDia = diasDelRango(rango) === 1;
  const incluyeHoy = rango.hasta >= hoyBogota();

  // Lo que depende de la migración 07 no rompe la pantalla si aún no está aplicada
  const [{ resumen, dias }, comparacion, abiertos, topPico, porHora, cajeros] = await Promise.all([
    obtenerResumen(sedeId, rango),
    obtenerComparacion(sedeId, rango),
    incluyeHoy ? listarTurnosAbiertos(sedeId) : Promise.resolve([]),
    intentar(() => obtenerProductosHoraPico(sedeId, rango, 5)),
    unDia ? intentar(() => obtenerVentasPorHora(sedeId, rango)) : Promise.resolve(null),
    intentar(() => obtenerDiferenciasCajero(sedeId, rango)),
  ]);

  // Sin la migración 08: el top de siempre, sin hora pico
  const top: { productoId: string; nombre: string; unidades: number; valor: number; horaPico?: number }[] =
    topPico ?? [...(await obtenerProductosVendidos(sedeId, rango))].sort((a, b) => b.valor - a.valor).slice(0, 5);

  const ticket = resumen.cantidad > 0 ? Math.round(resumen.total / resumen.cantidad) : 0;
  const cambio = comparacion ? variacion(resumen.total, comparacion.total) : null;
  const query = new URLSearchParams({ desde: rango.desde, hasta: rango.hasta });
  const enlaceReporte = (vista: string) => `/admin/${segmento}/reportes?${query}&vista=${vista}`;

  return (
    <>
      {abiertos.length > 0 && (
        <div className="flex flex-col gap-2 rounded-tarjeta border border-primario/40 bg-exito-suave p-3">
          <p className="px-1 text-sm font-semibold text-primario-activo">
            {abiertos.length === 1 ? "Caja abierta ahora" : `${abiertos.length} cajas abiertas ahora`}
          </p>
          <ul className="flex flex-col gap-2">
            {abiertos.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-control bg-superficie px-3 py-2">
                <span className="size-2.5 shrink-0 rounded-full bg-primario" aria-hidden />
                <span className="font-medium">{t.cajero}</span>
                {todas && <span className="text-sm text-texto-3">{t.sede}</span>}
                <span className="num mr-auto text-sm text-texto-3">desde {formatearHora(t.abiertoEn)}</span>
                <BotonVerCaja turnoId={t.id} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tarjeta titulo="Vendido" valor={formatearPesos(resumen.total)} icono={<ShoppingBag size={18} className="text-primario" aria-hidden />}>
          {comparacion && <Variacion cambio={cambio} etiqueta={comparacion.etiqueta} anterior={comparacion.total} />}
        </Tarjeta>

        <Tarjeta titulo="Ventas" valor={String(resumen.cantidad)} icono={<Receipt size={18} className="text-texto-3" aria-hidden />}>
          <p className="text-sm text-texto-3">
            Ticket promedio <span className="num font-semibold text-texto">{formatearPesos(ticket)}</span>
          </p>
        </Tarjeta>

        <Tarjeta titulo="Gastos" valor={formatearPesos(resumen.gastos)} icono={<Wallet size={18} className="text-advertencia" aria-hidden />}>
          <Link href={enlaceReporte("gastos")} className="text-sm text-texto-3 underline-offset-2 hover:underline">
            Ver detalle
          </Link>
        </Tarjeta>

        <EstadoCaja cajeros={cajeros} enlace={enlaceReporte("cajeros")} />
      </div>

      <BarraMedios porMetodo={resumen.por_metodo} />

      <div className="grid gap-3 lg:grid-cols-2">
        {unDia ? porHora && <BarrasPorHora datos={porHora} /> : <GraficoBarras dias={dias} />}

        <div className="flex flex-col gap-2 rounded-tarjeta border border-borde bg-superficie p-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-texto-3">Lo que más se vende</p>
            {top.length > 0 && (
              <Link href={enlaceReporte("horas")} className="flex items-center gap-1 text-sm text-primario hover:underline">
                Por hora <ArrowRight size={14} aria-hidden />
              </Link>
            )}
          </div>
          {top.length === 0 ? (
            <p className="py-6 text-center text-texto-3">Sin ventas en el periodo</p>
          ) : (
            <ol className="flex flex-col">
              {top.map((p, i) => (
                <li key={p.productoId} className="flex items-center gap-3 border-b border-suave py-2 last:border-0">
                  <span className="num w-5 text-sm text-texto-3">{i + 1}</span>
                  <span className="mr-auto min-w-0">
                    <span className="block font-medium">{p.nombre}</span>
                    {p.horaPico !== undefined && (
                      <span className="flex items-center gap-1 text-xs text-texto-3">
                        <Clock size={12} aria-hidden />
                        Se vende más a las {etiquetaHora(p.horaPico)}
                      </span>
                    )}
                  </span>
                  <span className="num text-sm whitespace-nowrap text-texto-3">{p.unidades} und</span>
                  <span className="num w-28 text-right font-semibold whitespace-nowrap">{formatearPesos(p.valor)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {todas && (
        <div className="overflow-x-auto rounded-tarjeta border border-borde bg-superficie">
          <table className="w-full text-left">
            <thead className="border-b border-borde text-sm text-texto-3">
              <tr>
                <th className="px-4 py-3 font-medium">Sede</th>
                <th className="px-4 py-3 text-right font-medium">Ventas</th>
                <th className="px-4 py-3 text-right font-medium">Vendido</th>
                <th className="px-4 py-3 text-right font-medium">Gastos</th>
              </tr>
            </thead>
            <tbody>
              {resumen.por_sede.map((s) => (
                <tr key={s.sede_id} className="border-b border-suave last:border-0">
                  <td className="px-4 py-2 font-medium">{s.nombre}</td>
                  <td className="num px-4 py-2 text-right">{s.cantidad}</td>
                  <td className="num px-4 py-2 text-right">{formatearPesos(s.total)}</td>
                  <td className="num px-4 py-2 text-right">{formatearPesos(s.gastos)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-borde font-semibold">
              <tr>
                <td className="px-4 py-2">Total</td>
                <td className="num px-4 py-2 text-right">{resumen.cantidad}</td>
                <td className="num px-4 py-2 text-right">{formatearPesos(resumen.total)}</td>
                <td className="num px-4 py-2 text-right">{formatearPesos(resumen.gastos)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}

/** "▲ 12% vs. ayer a esta hora" en verde o rojo. */
function Variacion({ cambio, etiqueta, anterior }: { cambio: number | null; etiqueta: string; anterior: number }) {
  if (cambio === null) return <p className="text-sm text-texto-3">Sin ventas {etiqueta.replace("vs. ", "")} para comparar</p>;
  const sube = cambio >= 0;
  const Icono = sube ? ArrowUpRight : ArrowDownRight;
  return (
    <p className="flex flex-wrap items-center gap-1 text-sm" title={`Antes: ${formatearPesos(anterior)}`}>
      <span className={`inline-flex items-center gap-0.5 font-semibold ${sube ? "text-primario" : "text-peligro"}`}>
        <Icono size={16} aria-hidden />
        <span className="num">{Math.abs(cambio)}%</span>
      </span>
      <span className="text-texto-3">{etiqueta}</span>
    </p>
  );
}

/** Cuarta tarjeta: ¿la plata de las cajas cerradas llegó completa? */
function EstadoCaja({
  cajeros,
  enlace,
}: {
  cajeros: { turnos: number; faltantes: number; faltante: number; sobrantes: number; sobrante: number }[] | null;
  enlace: string;
}) {
  if (cajeros === null) return null; // migración 07 pendiente
  const turnos = cajeros.reduce((s, c) => s + c.turnos, 0);
  const faltantes = cajeros.reduce((s, c) => s + c.faltantes, 0);
  const faltante = cajeros.reduce((s, c) => s + c.faltante, 0);
  const sobrantes = cajeros.reduce((s, c) => s + c.sobrantes, 0);
  const sobrante = cajeros.reduce((s, c) => s + c.sobrante, 0);

  const contenido =
    turnos === 0
      ? { titulo: "Caja", valor: "—", nota: "Sin turnos cerrados", clase: "text-texto-3", Icono: CircleCheck }
      : faltantes > 0
        ? { titulo: "Faltantes de caja", valor: formatearPesos(Math.abs(faltante)), nota: `${faltantes} de ${turnos} turnos`, clase: "text-peligro", Icono: TriangleAlert }
        : sobrantes > 0
          ? { titulo: "Sobrantes de caja", valor: formatearPesos(sobrante), nota: `${sobrantes} de ${turnos} turnos`, clase: "text-advertencia", Icono: TriangleAlert }
          : { titulo: "Caja", valor: "Cuadrada", nota: `${turnos} turnos sin diferencia`, clase: "text-primario", Icono: CircleCheck };

  const { Icono } = contenido;
  return (
    <Link
      href={enlace}
      className={`flex flex-col gap-1 rounded-tarjeta border bg-superficie p-4 hover:border-borde-activo ${
        faltantes > 0 ? "border-peligro-borde" : "border-borde"
      }`}
    >
      <p className={`flex items-center gap-2 text-sm font-semibold ${contenido.clase}`}>
        <Icono size={18} aria-hidden />
        {contenido.titulo}
      </p>
      <p className={`num text-2xl font-bold tracking-tight ${turnos === 0 ? "text-texto-3" : contenido.clase}`}>{contenido.valor}</p>
      <p className="text-sm text-texto-3">{contenido.nota}</p>
    </Link>
  );
}
