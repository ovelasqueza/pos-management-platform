import { listarSedes } from "@/lib/admin/sedes";
import { nombreTipo } from "@/lib/dominio/sede";
import { BotonEditarSede, BotonNuevaSede } from "@/components/admin/FormularioSede";
import { EstadoSede } from "@/components/admin/EstadoSede";
import { Encabezado } from "@/components/admin/Encabezado";

export default async function PaginaSedes() {
  const sedes = await listarSedes();

  return (
    <section className="flex flex-col gap-4">
      <Encabezado titulo="Sedes" accion={<BotonNuevaSede />} />
      <div className="overflow-x-auto rounded-tarjeta border border-borde bg-superficie">
        <table className="w-full text-left">
          <thead className="border-b border-borde text-sm text-texto-3">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Ciudad · Dirección / barrio</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Teléfono</th>
              <th className="px-4 py-3 text-right font-medium">Activa</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {sedes.map((s) => (
              <tr key={s.id} className="border-b border-suave last:border-0">
                <td className="px-4 py-2 font-medium">
                  {s.nombre}
                  {s.nit && <span className="num block text-xs font-normal text-texto-3">NIT {s.nit}</span>}
                </td>
                <td className="px-4 py-2 text-texto-2">{nombreTipo(s.tipo)}</td>
                <td className="hidden px-4 py-2 text-texto-2 md:table-cell">
                  {s.ciudad || s.direccion ? (
                    <>
                      {s.ciudad && <span className="font-medium text-texto">{s.ciudad}</span>}
                      {s.ciudad && s.direccion && <span className="text-texto-3"> · </span>}
                      {s.direccion}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="num hidden px-4 py-2 text-texto-2 md:table-cell">{s.telefono ?? "—"}</td>
                <td className="px-2 py-1">
                  <EstadoSede id={s.id} nombre={s.nombre} activa={s.activa} />
                </td>
                <td className="px-1">
                  <BotonEditarSede sede={s} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sedes.length === 0 && <p className="p-6 text-center text-texto-3">Sin sedes</p>}
      </div>
    </section>
  );
}
