import Link from "next/link";
import { ChevronRight, Info, Package2, TriangleAlert } from "lucide-react";
import { listarSedes, resolverSede } from "@/lib/admin/sedes";
import { listarInventarios, type ResumenInventario } from "@/lib/admin/inventario";
import { formatearPesos } from "@/lib/dominio/dinero";
import { formatearFecha, formatearFechaHora } from "@/lib/dominio/fechas";
import { Encabezado } from "@/components/admin/Encabezado";
import { NuevoInventario } from "@/components/admin/inventario/NuevoInventario";

function Total({ r }: { r: Pick<ResumenInventario, "total" | "sinCosto"> }) {
  return (
    <span className={`num inline-flex items-center gap-1 ${r.sinCosto ? "text-advertencia" : ""}`}>
      {r.sinCosto > 0 && <TriangleAlert size={14} aria-label={`${r.sinCosto} sin costo`} />}
      {formatearPesos(r.total)}
    </span>
  );
}

const Estado = ({ enCurso }: { enCurso: boolean }) =>
  enCurso ? (
    <span className="rounded-control bg-advertencia-suave px-2 py-0.5 text-xs font-semibold text-advertencia">En curso</span>
  ) : (
    <span className="rounded-control bg-exito-suave px-2 py-0.5 text-xs font-semibold text-primario-activo">Finalizado</span>
  );

export default async function PaginaInventario({ params }: PageProps<"/admin/[sede]/inventario">) {
  const { sede: segmento } = await params;
  const sede = await resolverSede(segmento);

  // ── Todas las sedes: último inventario finalizado de cada una ──
  if (!sede) {
    const [sedes, inventarios] = await Promise.all([listarSedes(), listarInventarios()]);
    const filas = sedes.map((s) => {
      const propios = inventarios.filter((i) => i.sedeId === s.id);
      return {
        sede: s,
        ultimo: propios.find((i) => i.estado === "finalizado") ?? null,
        enCurso: propios.find((i) => i.estado === "en_curso") ?? null,
      };
    });
    const total = filas.reduce((t, f) => t + (f.ultimo?.total ?? 0), 0);
    const sinCosto = filas.reduce((t, f) => t + (f.ultimo?.sinCosto ?? 0), 0);

    return (
      <section className="flex flex-col gap-4">
        <Encabezado titulo="Inventario · Todas las sedes" />
        <p className="flex items-center gap-2 text-sm text-texto-3">
          <Info size={16} aria-hidden />
          Último inventario finalizado de cada sede. Escoge una sede arriba para contar.
        </p>
        <div className="overflow-x-auto rounded-tarjeta border border-borde bg-superficie">
          <table className="w-full text-left">
            <thead className="border-b border-borde text-sm text-texto-3">
              <tr>
                <th className="px-4 py-3 font-medium">Sede</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(({ sede: s, ultimo, enCurso }) => (
                <tr key={s.id} className={`border-b border-suave last:border-0 ${s.activa ? "" : "text-texto-3"}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{s.nombre}</p>
                    {!s.activa && <p className="text-xs">Inactiva</p>}
                    {enCurso && (
                      <Link href={`/admin/${s.id}/inventario/${enCurso.id}`} className="text-xs text-advertencia underline">
                        En curso: {formatearFecha(enCurso.fecha)}
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3 text-texto-2">
                    {ultimo ? (
                      <Link href={`/admin/${s.id}/inventario/${ultimo.id}`} className="underline-offset-2 hover:underline">
                        {formatearFecha(ultimo.fecha)}
                      </Link>
                    ) : (
                      "Sin inventario"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{ultimo ? <Total r={ultimo} /> : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-borde font-semibold">
              <tr>
                <td className="px-4 py-3" colSpan={2}>
                  Total general
                </td>
                <td className="px-4 py-3 text-right">
                  <Total r={{ total, sinCosto }} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    );
  }

  // ── Una sede: lista de inventarios ──
  const inventarios = await listarInventarios(sede.id);
  const enCurso = inventarios.find((i) => i.estado === "en_curso")?.id ?? null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Encabezado titulo={`Inventario · ${sede.nombre}`} />
        <div className="flex gap-2">
          <Link
            href={`/admin/${sede.id}/inventario/articulos`}
            className="inline-flex min-h-12 items-center gap-2 rounded-control border border-borde-activo bg-superficie px-4 hover:border-texto"
          >
            <Package2 size={20} aria-hidden />
            Materias primas
          </Link>
          {sede.activa && <NuevoInventario sedeId={sede.id} enCurso={enCurso} />}
        </div>
      </div>

      <div className="overflow-hidden rounded-tarjeta border border-borde bg-superficie">
        <ul className="divide-y divide-suave">
          {inventarios.map((i) => (
            <li key={i.id}>
              <Link href={`/admin/${sede.id}/inventario/${i.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-suave">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium capitalize">
                    {formatearFecha(i.fecha)} <Estado enCurso={i.estado === "en_curso"} />
                  </p>
                  <p className="truncate text-xs text-texto-3">
                    {i.nota && <>{i.nota} · </>}
                    {i.lineas} líneas · Últ. cambio {i.modificadoPor ?? "—"} · {formatearFechaHora(i.modificadoEn)}
                  </p>
                </div>
                <Total r={i} />
                <ChevronRight size={18} className="shrink-0 text-texto-3" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
        {inventarios.length === 0 && (
          <p className="p-6 text-center text-texto-3">
            {sede.activa ? "Aún no hay inventarios. Toca + Inventario para empezar a contar" : "Sin inventario"}
          </p>
        )}
      </div>
    </section>
  );
}
