import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { resolverSede } from "@/lib/admin/sedes";
import {
  intentar,
  listarGastos,
  listarTurnos,
  listarVentas,
  obtenerCuadreDiario,
  obtenerDiferenciasCajero,
  obtenerProductosVendidos,
  obtenerTopPorHora,
  obtenerVentasPorHora,
  POR_PAGINA,
  totalGastosVigentes,
  type FilaCuadre,
} from "@/lib/admin/reportes";
import { leerRango, formatearDia, formatearFechaHora, type Rango } from "@/lib/dominio/fechas";
import { formatearPesos } from "@/lib/dominio/dinero";
import { nombreMetodo } from "@/lib/dominio/cobro";
import { describirOrigen, origenDeGasto } from "@/lib/dominio/cajaMayor";
import { Encabezado } from "@/components/admin/Encabezado";
import { FiltroFechas } from "@/components/admin/FiltroFechas";
import { DetalleVenta } from "@/components/admin/DetalleVenta";
import { ProductosVendidos } from "@/components/admin/ProductosVendidos";
import { BarrasPorHora, etiquetaHora } from "@/components/admin/Resumen";
import { BotonVerReporte, Diferencia } from "@/components/admin/TablaTurnos";
import { ProveedorImpresion } from "@/components/impresion/ProveedorImpresion";

const VISTAS = [
  { valor: "ventas", nombre: "Ventas" },
  { valor: "productos", nombre: "Productos" },
  { valor: "gastos", nombre: "Gastos" },
  { valor: "turnos", nombre: "Turnos" },
  { valor: "cuadre", nombre: "Cuadre" },
  { valor: "cajeros", nombre: "Cajeros" },
  { valor: "horas", nombre: "Por hora" },
] as const;
type Vista = (typeof VISTAS)[number]["valor"];

type Contexto = { sedeId: string | null; rango: Rango; pagina: number; todas: boolean; query: Record<string, string> };

const th = "px-4 py-3 font-medium";
const td = "px-4 py-2";

function enlace(query: Record<string, string>, cambios: Record<string, string>) {
  return `?${new URLSearchParams({ ...query, ...cambios })}`;
}

function Paginacion({ ctx, total }: { ctx: Contexto; total: number }) {
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  if (paginas === 1) return null;
  const boton = "flex size-12 items-center justify-center rounded-control border border-borde bg-superficie";
  return (
    <nav aria-label="Páginas" className="flex items-center justify-end gap-2">
      {ctx.pagina > 1 ? (
        <Link href={enlace(ctx.query, { pagina: String(ctx.pagina - 1) })} className={boton} aria-label="Anterior">
          <ChevronLeft size={20} />
        </Link>
      ) : (
        <span className={`${boton} opacity-40`} aria-hidden>
          <ChevronLeft size={20} />
        </span>
      )}
      <span className="num text-sm text-texto-3">
        {ctx.pagina} / {paginas}
      </span>
      {ctx.pagina < paginas ? (
        <Link href={enlace(ctx.query, { pagina: String(ctx.pagina + 1) })} className={boton} aria-label="Siguiente">
          <ChevronRight size={20} />
        </Link>
      ) : (
        <span className={`${boton} opacity-40`} aria-hidden>
          <ChevronRight size={20} />
        </span>
      )}
    </nav>
  );
}

async function Ventas({ ctx }: { ctx: Contexto }) {
  const { filas, total } = await listarVentas(ctx.sedeId, ctx.rango, ctx.pagina);
  return (
    <>
      <p className="text-sm text-texto-3">{total} ventas</p>
      <div className="overflow-x-auto rounded-tarjeta border border-borde bg-superficie">
        <table className="w-full text-left">
          <thead className="border-b border-borde text-sm text-texto-3">
            <tr>
              <th className={th}>#</th>
              <th className={th}>Fecha</th>
              {ctx.todas && <th className={th}>Sede</th>}
              <th className={`${th} hidden md:table-cell`}>Cajero</th>
              <th className={th}>Método</th>
              <th className={`${th} text-right`}>Total</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {filas.map((v) => (
              <tr key={v.id} className="border-b border-suave last:border-0">
                <td className={`${td} num font-semibold`}>{v.numero}</td>
                <td className={`${td} num text-sm`}>{formatearFechaHora(v.creado_en)}</td>
                {ctx.todas && <td className={td}>{v.sede?.nombre}</td>}
                <td className={`${td} hidden md:table-cell`}>{v.cajero?.nombre_completo}</td>
                <td className={td}>{nombreMetodo(v.metodo)}</td>
                <td className={`${td} num text-right font-semibold`}>{formatearPesos(v.total)}</td>
                <td className="px-1">
                  <DetalleVenta ventaId={v.id} numero={v.numero} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filas.length === 0 && <p className="p-6 text-center text-texto-3">Sin ventas en el periodo</p>}
      </div>
      <Paginacion ctx={ctx} total={total} />
    </>
  );
}

async function Gastos({ ctx }: { ctx: Contexto }) {
  const [{ filas, total }, vigentes] = await Promise.all([
    listarGastos(ctx.sedeId, ctx.rango, ctx.pagina),
    totalGastosVigentes(ctx.sedeId, ctx.rango),
  ]);
  return (
    <>
      <p className="flex justify-between text-sm text-texto-3">
        <span>{total} gastos</span>
        <span>
          Total vigentes: <strong className="num text-texto">{formatearPesos(vigentes)}</strong>
        </span>
      </p>
      <div className="overflow-x-auto rounded-tarjeta border border-borde bg-superficie">
        <table className="w-full text-left">
          <thead className="border-b border-borde text-sm text-texto-3">
            <tr>
              <th className={th}>Fecha</th>
              {ctx.todas && <th className={th}>Sede</th>}
              <th className={`${th} hidden md:table-cell`}>Cajero</th>
              <th className={th}>Descripción</th>
              <th className={`${th} text-right`}>Monto</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((g) => (
              <tr key={g.id} className={`border-b border-suave last:border-0 ${g.anulado_en ? "text-texto-3" : ""}`}>
                <td className={`${td} num text-sm`}>{formatearFechaHora(g.creado_en)}</td>
                {ctx.todas && <td className={td}>{g.turno?.sede?.nombre}</td>}
                <td className={`${td} hidden md:table-cell`}>{g.turno?.cajero?.nombre_completo}</td>
                <td className={td}>
                  <span className={g.anulado_en ? "line-through" : ""}>{g.descripcion}</span>
                  {g.anulado_en && <span className="ml-2 rounded-control bg-suave px-2 py-0.5 text-xs">Anulado</span>}
                  {origenDeGasto(g) !== "caja" && <span className="block text-xs text-texto-3">{describirOrigen(g)}</span>}
                </td>
                <td className={`${td} num text-right ${g.anulado_en ? "line-through" : "font-semibold"}`}>{formatearPesos(g.monto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filas.length === 0 && <p className="p-6 text-center text-texto-3">Sin gastos en el periodo</p>}
      </div>
      <Paginacion ctx={ctx} total={total} />
    </>
  );
}

async function Turnos({ ctx }: { ctx: Contexto }) {
  const { filas, total } = await listarTurnos(ctx.sedeId, ctx.rango, ctx.pagina);
  return (
    <>
      <p className="text-sm text-texto-3">{total} turnos</p>
      <div className="overflow-x-auto rounded-tarjeta border border-borde bg-superficie">
        <table className="w-full text-left">
          <thead className="border-b border-borde text-sm text-texto-3">
            <tr>
              <th className={th}>Cajero</th>
              {ctx.todas && <th className={th}>Sede</th>}
              <th className={th}>Apertura</th>
              <th className={`${th} hidden md:table-cell`}>Cierre</th>
              <th className={`${th} text-right`}>Ventas</th>
              <th className={`${th} hidden text-right lg:table-cell`}>Gastos</th>
              <th className={`${th} hidden text-right lg:table-cell`}>Esperado</th>
              <th className={`${th} hidden text-right lg:table-cell`}>Contado</th>
              <th className={`${th} text-right`}>Diferencia</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {filas.map((t) => (
              <tr key={t.id} className="border-b border-suave last:border-0">
                <td className={`${td} font-medium`}>
                  {t.cajero?.nombre_completo}
                  {t.cerrado_por && t.cerrado_por !== t.cajero_id && (
                    <span className="ml-2 rounded-control bg-suave px-2 py-0.5 text-xs text-texto-3">Admin</span>
                  )}
                </td>
                {ctx.todas && <td className={td}>{t.sede?.nombre}</td>}
                <td className={`${td} num text-sm`}>{formatearFechaHora(t.abierto_en)}</td>
                <td className={`${td} num hidden text-sm md:table-cell`}>
                  {t.cerrado_en ? formatearFechaHora(t.cerrado_en) : <span className="font-semibold text-primario">Abierto</span>}
                </td>
                <td className={`${td} num text-right`}>{t.reporte ? formatearPesos(t.reporte.ventas_total) : "—"}</td>
                <td className={`${td} num hidden text-right lg:table-cell`}>{t.reporte ? formatearPesos(t.reporte.gastos_total) : "—"}</td>
                <td className={`${td} num hidden text-right lg:table-cell`}>{t.efectivo_esperado !== null ? formatearPesos(t.efectivo_esperado) : "—"}</td>
                <td className={`${td} num hidden text-right lg:table-cell`}>{t.efectivo_contado !== null ? formatearPesos(t.efectivo_contado) : "—"}</td>
                <td className={`${td} text-right`}>{t.diferencia !== null ? <Diferencia valor={t.diferencia} /> : "—"}</td>
                <td className="px-1">{t.reporte && <BotonVerReporte reporte={t.reporte} cajero={t.cajero?.nombre_completo ?? ""} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filas.length === 0 && <p className="p-6 text-center text-texto-3">Sin turnos en el periodo</p>}
      </div>
      <Paginacion ctx={ctx} total={total} />
    </>
  );
}

async function Productos({ ctx }: { ctx: Contexto }) {
  const filas = await obtenerProductosVendidos(ctx.sedeId, ctx.rango);
  return <ProductosVendidos filas={filas} todas={ctx.todas} />;
}

const COLUMNAS_CUADRE: { clave: Exclude<keyof FilaCuadre, "fecha" | "turnos" | "diferencia">; nombre: string; clase?: string }[] = [
  { clave: "base", nombre: "Base", clase: "hidden lg:table-cell" },
  { clave: "efectivo", nombre: "Efectivo" },
  { clave: "transferencia", nombre: "QR" },
  { clave: "tarjeta", nombre: "Tarjeta" },
  { clave: "gastos", nombre: "Gastos caja" },
  { clave: "esperado", nombre: "Esperado" },
  { clave: "contado", nombre: "Contado" },
  { clave: "gastosMayor", nombre: "Gastos mayor", clase: "hidden xl:table-cell" },
  { clave: "aMayor", nombre: "A caja mayor", clase: "hidden xl:table-cell" },
];

/** Una fila por día: lo que entró por cada medio y si el efectivo llegó completo. */
async function Cuadre({ ctx }: { ctx: Contexto }) {
  const { filas, turnosAbiertos } = await obtenerCuadreDiario(ctx.sedeId, ctx.rango);
  const suma = (k: keyof FilaCuadre) => filas.reduce((s, f) => s + (f[k] as number), 0);

  return (
    <>
      <p className="text-sm text-texto-3">
        Turnos cerrados, por día de apertura. QR y Tarjeta: compáralos con el banco.
      </p>
      {turnosAbiertos > 0 && (
        <p className="text-sm font-semibold text-advertencia">
          {turnosAbiertos === 1 ? "1 turno abierto no está incluido" : `${turnosAbiertos} turnos abiertos no están incluidos`}
        </p>
      )}
      <div className="overflow-x-auto rounded-tarjeta border border-borde bg-superficie">
        <table className="w-full text-left">
          <thead className="border-b border-borde text-sm text-texto-3">
            <tr>
              <th className={th}>Día</th>
              <th className={`${th} hidden text-right md:table-cell`}>Turnos</th>
              {COLUMNAS_CUADRE.map((c) => (
                <th key={c.clave} className={`${th} text-right ${c.clase ?? ""}`}>
                  {c.nombre}
                </th>
              ))}
              <th className={`${th} text-right`}>Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.fecha} className="border-b border-suave last:border-0">
                <td className={`${td} num font-medium whitespace-nowrap`}>{formatearDia(f.fecha)}</td>
                <td className={`${td} num hidden text-right md:table-cell`}>{f.turnos}</td>
                {COLUMNAS_CUADRE.map((c) => (
                  <td key={c.clave} className={`${td} num text-right whitespace-nowrap ${c.clase ?? ""}`}>
                    {formatearPesos(f[c.clave])}
                  </td>
                ))}
                <td className={`${td} text-right whitespace-nowrap`}>
                  <Diferencia valor={f.diferencia} />
                </td>
              </tr>
            ))}
          </tbody>
          {filas.length > 1 && (
            <tfoot className="border-t border-borde font-semibold">
              <tr>
                <td className={td}>Total</td>
                <td className={`${td} num hidden text-right md:table-cell`}>{suma("turnos")}</td>
                {COLUMNAS_CUADRE.map((c) => (
                  <td key={c.clave} className={`${td} num text-right whitespace-nowrap ${c.clase ?? ""}`}>
                    {formatearPesos(suma(c.clave))}
                  </td>
                ))}
                <td className={`${td} text-right whitespace-nowrap`}>
                  <Diferencia valor={suma("diferencia")} />
                </td>
              </tr>
            </tfoot>
          )}
        </table>
        {filas.length === 0 && <p className="p-6 text-center text-texto-3">Sin turnos cerrados en el periodo</p>}
      </div>
    </>
  );
}

/** Faltantes y sobrantes acumulados por cajero (por separado: en el neto se compensan). */
async function Cajeros({ ctx }: { ctx: Contexto }) {
  const filas = await obtenerDiferenciasCajero(ctx.sedeId, ctx.rango);
  return (
    <>
      <p className="text-sm text-texto-3">Turnos cerrados con apertura en el periodo.</p>
      <div className="overflow-x-auto rounded-tarjeta border border-borde bg-superficie">
        <table className="w-full text-left">
          <thead className="border-b border-borde text-sm text-texto-3">
            <tr>
              <th className={th}>Cajero</th>
              <th className={`${th} text-right`}>Turnos</th>
              <th className={`${th} hidden text-right md:table-cell`}>Cuadrados</th>
              <th className={`${th} text-right`}>Faltantes</th>
              <th className={`${th} text-right`}>Sobrantes</th>
              <th className={`${th} text-right`}>Neto</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.cajeroId} className="border-b border-suave last:border-0">
                <td className={`${td} font-medium`}>{f.cajero}</td>
                <td className={`${td} num text-right`}>{f.turnos}</td>
                <td className={`${td} num hidden text-right md:table-cell`}>{f.cuadrados}</td>
                <td className={`${td} num text-right whitespace-nowrap`}>
                  {f.faltantes > 0 ? (
                    <span className="font-semibold text-peligro">
                      {f.faltantes} · {formatearPesos(f.faltante)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className={`${td} num text-right whitespace-nowrap`}>
                  {f.sobrantes > 0 ? (
                    <span className="font-semibold text-advertencia">
                      {f.sobrantes} · {formatearPesos(f.sobrante)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className={`${td} text-right whitespace-nowrap`}>
                  <Diferencia valor={f.neto} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filas.length === 0 && <p className="p-6 text-center text-texto-3">Sin turnos cerrados en el periodo</p>}
      </div>
    </>
  );
}

/** Cuándo se vende más y qué se vende en cada hora. */
async function PorHora({ ctx }: { ctx: Contexto }) {
  const [datos, topHoras] = await Promise.all([
    obtenerVentasPorHora(ctx.sedeId, ctx.rango),
    intentar(() => obtenerTopPorHora(ctx.sedeId, ctx.rango, 3)),
  ]);
  const puestos = [0, 1, 2];

  return (
    <>
      <BarrasPorHora datos={datos} />
      {topHoras === null ? (
        <p className="text-sm text-advertencia">Para ver los productos por hora, ejecuta la migración 08 (ver docs/bd/README.md).</p>
      ) : (
        topHoras.length > 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-texto-3">Lo más vendido en cada hora (por unidades)</h2>
            <div className="overflow-x-auto rounded-tarjeta border border-borde bg-superficie">
              <table className="w-full text-left">
                <thead className="border-b border-borde text-sm text-texto-3">
                  <tr>
                    <th className={th}>Hora</th>
                    <th className={th}>1.º</th>
                    <th className={`${th} hidden md:table-cell`}>2.º</th>
                    <th className={`${th} hidden lg:table-cell`}>3.º</th>
                  </tr>
                </thead>
                <tbody>
                  {topHoras.map((h) => (
                    <tr key={h.hora} className="border-b border-suave align-top last:border-0">
                      <td className={`${td} num font-semibold whitespace-nowrap`}>{etiquetaHora(h.hora)}</td>
                      {puestos.map((i) => {
                        const p = h.productos[i];
                        const ocultar = i === 1 ? "hidden md:table-cell" : i === 2 ? "hidden lg:table-cell" : "";
                        return (
                          <td key={i} className={`${td} ${ocultar}`}>
                            {p ? (
                              <>
                                <span className={`block ${i === 0 ? "font-semibold" : ""}`}>{p.nombre}</span>
                                <span className="num text-sm text-texto-3">
                                  {p.unidades} und · {formatearPesos(p.valor)}
                                </span>
                              </>
                            ) : (
                              <span className="text-texto-3">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </>
  );
}

export default async function PaginaReportes({ params, searchParams }: PageProps<"/admin/[sede]/reportes">) {
  const [{ sede: segmento }, sp] = await Promise.all([params, searchParams]);
  const sede = await resolverSede(segmento);
  const rango = leerRango(sp);
  const vista: Vista = VISTAS.some((v) => v.valor === sp.vista) ? (sp.vista as Vista) : "ventas";
  const pagina = Math.max(1, Number.parseInt(String(sp.pagina ?? "1"), 10) || 1);

  const query = { vista, desde: rango.desde, hasta: rango.hasta };
  const ctx: Contexto = { sedeId: sede?.id ?? null, rango, pagina, todas: !sede, query };

  return (
    <ProveedorImpresion>
      <section className="flex flex-col gap-4">
        <Encabezado titulo={sede ? `Reportes · ${sede.nombre}` : "Reportes · Todas las sedes"} />

        <nav aria-label="Reporte" className="flex w-fit flex-wrap gap-1 rounded-tarjeta bg-suave p-1">
          {VISTAS.map((v) => (
            <Link
              key={v.valor}
              href={enlace(query, { vista: v.valor })}
              aria-current={v.valor === vista ? "page" : undefined}
              className={`flex min-h-11 items-center rounded-control px-4 font-medium ${
                v.valor === vista ? "border border-borde bg-superficie text-texto" : "text-texto-3"
              }`}
            >
              {v.nombre}
            </Link>
          ))}
        </nav>

        <FiltroFechas desde={rango.desde} hasta={rango.hasta} error={rango.error} />

        {!rango.error && (
          <>
            {vista === "ventas" && <Ventas ctx={ctx} />}
            {vista === "gastos" && <Gastos ctx={ctx} />}
            {vista === "turnos" && <Turnos ctx={ctx} />}
            {vista === "productos" && <Productos ctx={ctx} />}
            {vista === "cuadre" && <Cuadre ctx={ctx} />}
            {vista === "cajeros" && <Cajeros ctx={ctx} />}
            {vista === "horas" && <PorHora ctx={ctx} />}
          </>
        )}
      </section>
    </ProveedorImpresion>
  );
}
