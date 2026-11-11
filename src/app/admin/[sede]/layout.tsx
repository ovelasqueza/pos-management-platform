import { notFound } from "next/navigation";
import { requerirAdmin } from "@/lib/sesion";
import { listarSedes, resolverSede } from "@/lib/admin/sedes";
import { MenuAdmin } from "@/components/admin/MenuAdmin";
import { SelectorSede } from "@/components/admin/SelectorSede";
import { BotonSalir } from "@/components/admin/BotonSalir";
import { TransicionAdmin } from "@/components/admin/TransicionAdmin";
import { SelectorPapel } from "@/components/impresion/SelectorPapel";

export default async function LayoutAdmin({ children, params }: LayoutProps<"/admin/[sede]">) {
  const [perfil, { sede: segmento }] = await Promise.all([requerirAdmin(), params]);
  const [sede, sedes] = await Promise.all([resolverSede(segmento), listarSedes()]);
  if (sede === undefined) notFound();

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <MenuAdmin sede={segmento} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-borde bg-superficie px-4 py-2 sm:grid-cols-[1fr_minmax(0,3fr)_1fr] md:px-6">
          <span className="hidden sm:block" aria-hidden />
          <SelectorSede
            actual={segmento}
            sedes={sedes.map(({ id, nombre, tipo, ciudad, direccion, activa }) => ({ id, nombre, tipo, ciudad, direccion, activa }))}
          />
          <div className="flex min-w-0 items-center justify-end gap-3">
            <div className="hidden sm:block">
              <SelectorPapel variante="claro" sedeId={sede?.id} anchoSede={sede?.ancho_papel} />
            </div>
            <p className="hidden truncate text-sm text-texto-3 lg:block">{perfil.nombreCompleto}</p>
            <BotonSalir compacto />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">
          <TransicionAdmin>{children}</TransicionAdmin>
        </main>
      </div>
    </div>
  );
}
