import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { listarSedes, resolverSede } from "@/lib/admin/sedes";
import { listarMovimientos, saldosPorSede } from "@/lib/admin/cajaMayor";
import { POR_PAGINA } from "@/lib/admin/reportes";
import { leerRango, formatearFechaHora } from "@/lib/dominio/fechas";
import { formatearPesos } from "@/lib/dominio/dinero";
import { METODOS, nombreMetodo } from "@/lib/dominio/cobro";
import { SALDO_VACIO, nombreMovimiento, type SaldoCajaMayor } from "@/lib/dominio/cajaMayor";
import { Encabezado } from "@/components/admin/Encabezado";
import { FiltroFechas } from "@/components/admin/FiltroFechas";
import { PanelCajaMayor } from "@/components/admin/PanelCajaMayor";
import { BotonVerReporte } from "@/components/admin/TablaTurnos";
import { ProveedorImpresion } from "@/components/impresion/ProveedorImpresion";

const th = "px-4 py-3 font-medium";
const td = "px-4 py-2";

/** Caja mayor (spec 06): saldo por sede en Efectivo, QR y Tarjeta, y sus movimientos. */
export default async function PaginaCajaMayor({ params, searchParams }: PageProps<"/admin/[sede]/caja-mayor">) {
  const [{ sede: segmento }, sp] = await Promise.all([params, searchParams]);
  const sede = await resolverSede(segmento);
  if (sede === undefined) notFound();

  const saldos = await saldosPorSede();

  if (sede === null) {
    const sedes = await listarSedes();
    const general = sedes.reduce<SaldoCajaMayor>((t, s) => {
      const x = saldos.get(s.id) ?? SALDO_VACIO;
      return {
        efectivo: t.efectivo + x.efectivo,
        transferencia: t.transferencia + x.transferencia,
        tarjeta: t.tarjeta + x.tarjeta,
        total: t.total + x.total,
      };
    }, { ...SALDO_VACIO });
    return (
      <section className="flex flex-col gap-4">
        <Encabezado titulo="Caja mayor · Todas las sedes" />
        <p className="text-sm text-texto-3">Escoge una sede para sumar, quitar o ver sus movimientos.</p>
        <div className="overflow-x-auto rounded-tarjeta border border-borde bg-superficie">
          <table className="w-full text-left">
            <thead className="border-b border-borde text-sm text-texto-3">
              <tr>
                <th className={th}>Sede</th>
                {METODOS.map((m) => (
                  <th key={m.valor} className={`${th} text-right`}>
                    {m.nombre}
                  </th>
                ))}
                <th className={`${th} text-right`}>Total</th>
              </tr>
            </thead>
            <tbody>
              {sedes.map((s) => {
                const x = saldos.get(s.id) ?? SALDO_VACIO;
                return (
                  <tr key={s.id} className={`border-b border-suave last:border-0 ${s.activa ? "" : "text-texto-3"}`}>
                    <td className={`${td} font-medium`}>
                      <Link href={`/admin/${s.id}/caja-mayor`} className="hover:underline">
                        {s.nombre}
                      </Link>
                      {!s.activa && <span className="ml-2 rounded-control bg-suave px-2 py-0.5 text-xs">Inactiva</span>}
                    </td>
                    {METODOS.map((m) => (
                      <td key={m.valor} className={`${td} num text-right`}>
                        {formatearPesos(x[m.valor])}
                      </td>
                    ))}
                    <td className={`${td} num text-right font-semibold`}>{formatearPesos(x.total)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-borde font-semibold">
              <tr>
                <td className={td}>Total general</td>
                {METODOS.map((m) => (
                  <td key={m.valor} className={`${td} num text-right`}>
                    {formatearPesos(general[m.valor])}
                  </td>
                ))}
                <td className={`${td} num text-right`}>{formatearPesos(general.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    );
  }

  const rango = leerRango(sp);
  const pagina = Math.max(1, Number.parseInt(String(sp.pagina ?? "1"), 10) || 1);
  const movimientos = rango.error ? null : await listarMovimientos(sede.id, rango, pagina);
  const paginas = movimientos ? Math.max(1, Math.ceil(movimientos.total / POR_PAGINA)) : 1;
  const enlace = (p: number) => `?${new URLSearchParams({ desde: rango.desde, hasta: rango.hasta, pagina: String(p) })}`;
  const boton = "flex size-12 items-center justify-center rounded-control border border-borde bg-superficie";

  return (
    <ProveedorImpresion>
      <section className="flex flex-col gap-4">
        <Encabezado titulo={`Caja mayor · ${sede.nombre}`} />
        <PanelCajaMayor sedeId={sede.id} saldo={saldos.get(sede.id) ?? SALDO_VACIO} />

        <h2 className="mt-2 text-lg font-semibold">Movimientos</h2>
        <FiltroFechas desde={rango.desde} hasta={rango.hasta} error={rango.error} />

        {movimientos && (
          <>
            <div className="overflow-x-auto rounded-tarjeta border border-borde bg-superficie">
              <table className="w-full text-left">
                <thead className="border-b border-borde text-sm text-texto-3">
                  <tr>
                    <th className={th}>Fecha</th>
                    <th className={th}>Movimiento</th>
                    <th className={th}>Parte</th>
                    <th className={`${th} text-right`}>Valor</th>
                    <th className={`${th} hidden text-right md:table-cell`}>Saldo</th>
                    <th className={`${th} hidden lg:table-cell`}>Por</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {movimientos.filas.map((m) => (
                    <tr key={m.id} className="border-b border-suave last:border-0">
                      <td className={`${td} num text-sm whitespace-nowrap`}>{formatearFechaHora(m.creadoEn)}</td>
                      <td className={td}>
                        <span className="font-medium">{nombreMovimiento[m.tipo]}</span>
                        {m.descripcion && <span className="block text-sm text-texto-3">{m.descripcion}</span>}
                      </td>
                      <td className={td}>{nombreMetodo(m.parte)}</td>
                      <td className={`${td} num text-right font-semibold ${m.monto < 0 ? "text-peligro" : "text-primario-activo"}`}>
                        {m.monto > 0 ? "+" : ""}
                        {formatearPesos(m.monto)}
                      </td>
                      <td className={`${td} num hidden text-right md:table-cell`}>{formatearPesos(m.saldoDespues)}</td>
                      <td className={`${td} hidden text-sm lg:table-cell`}>{m.turnoCajero ?? m.usuario}</td>
                      <td className="px-1">
                        {m.tipo === "cierre_turno" && m.reporte && <BotonVerReporte reporte={m.reporte} cajero={m.turnoCajero ?? ""} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {movimientos.filas.length === 0 && <p className="p-6 text-center text-texto-3">Sin movimientos en el periodo</p>}
            </div>
            {paginas > 1 && (
              <nav aria-label="Páginas" className="flex items-center justify-end gap-2">
                {pagina > 1 ? (
                  <Link href={enlace(pagina - 1)} className={boton} aria-label="Anterior">
                    <ChevronLeft size={20} />
                  </Link>
                ) : (
                  <span className={`${boton} opacity-40`} aria-hidden>
                    <ChevronLeft size={20} />
                  </span>
                )}
                <span className="num text-sm text-texto-3">
                  {pagina} / {paginas}
                </span>
                {pagina < paginas ? (
                  <Link href={enlace(pagina + 1)} className={boton} aria-label="Siguiente">
                    <ChevronRight size={20} />
                  </Link>
                ) : (
                  <span className={`${boton} opacity-40`} aria-hidden>
                    <ChevronRight size={20} />
                  </span>
                )}
              </nav>
            )}
          </>
        )}
      </section>
    </ProveedorImpresion>
  );
}
