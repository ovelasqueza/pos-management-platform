import { notFound, redirect } from "next/navigation";
import { requerirAdmin } from "@/lib/sesion";
import { resolverSede } from "@/lib/admin/sedes";
import { listarCandidatos, obtenerInventario } from "@/lib/admin/inventario";
import { DetalleInventario } from "@/components/admin/inventario/DetalleInventario";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaDetalleInventario({ params }: PageProps<"/admin/[sede]/inventario/[id]">) {
  const { sede: segmento, id } = await params;
  if (!UUID.test(id)) notFound();
  const [perfil, sede, inventario] = await Promise.all([requerirAdmin(), resolverSede(segmento), obtenerInventario(id)]);
  if (sede === undefined || !inventario) notFound();
  // Abierto desde "Todas" u otra sede: llevar a la sede del inventario
  if (sede === null || sede.id !== inventario.resumen.sedeId) {
    redirect(`/admin/${inventario.resumen.sedeId}/inventario/${id}`);
  }

  const candidatos = await listarCandidatos(sede.id, sede.tipo);
  const r = inventario.resumen;

  return (
    <DetalleInventario
      // Al recargar tras finalizar, editar o actualizar costos, el estado local se vuelve a armar
      key={`${r.modificadoEn}-${r.estado}-${sede.activa}`}
      inventario={{
        id: r.id,
        fecha: r.fecha,
        nota: r.nota,
        estado: r.estado,
        modificadoEn: r.modificadoEn,
        modificadoPor: r.modificadoPor,
        finalizadoEn: r.finalizadoEn,
        finalizadoPor: r.finalizadoPor,
      }}
      sede={{ id: sede.id, nombre: sede.nombre, nit: sede.nit, activa: sede.activa }}
      lineasIniciales={inventario.lineas}
      candidatos={candidatos}
      usuario={perfil.nombreCompleto}
    />
  );
}
