import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { resolverSede } from "@/lib/admin/sedes";
import { listarArticulos } from "@/lib/admin/inventario";
import { Encabezado } from "@/components/admin/Encabezado";
import { BotonNuevoArticulo, TablaArticulos } from "@/components/admin/inventario/Articulos";

/** Materias primas de la sede (en la BD: articulos_inventario). Solo para el inventario, nunca salen en la caja. */
export default async function PaginaArticulos({ params }: PageProps<"/admin/[sede]/inventario/articulos">) {
  const { sede: segmento } = await params;
  const sede = await resolverSede(segmento);
  if (sede === undefined) notFound();
  if (sede === null) redirect(`/admin/${segmento}/inventario`); // las materias primas son por sede

  const articulos = await listarArticulos(sede.id);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link href={`/admin/${sede.id}/inventario`} className="inline-flex w-fit items-center gap-1 text-sm text-texto-3 hover:text-texto">
            <ArrowLeft size={16} aria-hidden />
            Inventarios
          </Link>
          <Encabezado titulo={`Materias primas · ${sede.nombre}`} />
          <p className="text-sm text-texto-3">Solo para el inventario: no aparecen en la caja · El costo se guarda solo</p>
        </div>
        <BotonNuevoArticulo sedeId={sede.id} />
      </div>
      <TablaArticulos sedeId={sede.id} articulos={articulos} />
    </section>
  );
}
