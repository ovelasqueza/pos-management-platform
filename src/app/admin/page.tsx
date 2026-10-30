import Link from "next/link";
import { Building2, ChevronRight, Network } from "lucide-react";
import { requerirAdmin } from "@/lib/sesion";
import { listarSedes, TODAS } from "@/lib/admin/sedes";
import { BotonNuevaSede } from "@/components/admin/FormularioSede";
import { BotonSalir } from "@/components/admin/BotonSalir";
import { ListaSedes } from "@/components/admin/ListaSedes";

/** Primera pantalla del admin: escoger sede o "Todas las sedes". */
export default async function SelectorInicial() {
  const perfil = await requerirAdmin();
  const sedes = await listarSedes();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-texto-3">{perfil.nombreCompleto}</p>
          <h1 className="text-2xl font-semibold">Escoge una sede</h1>
        </div>
        <div className="flex gap-2">
          <BotonNuevaSede />
          <BotonSalir />
        </div>
      </header>

      <Link
        href={`/admin/${TODAS}`}
        className="flex items-center gap-4 rounded-tarjeta border border-primario/40 bg-exito-suave p-5 hover:border-primario"
      >
        <Network size={28} className="text-primario" aria-hidden />
        <div className="mr-auto">
          <p className="text-lg font-semibold">Todas las sedes</p>
          <p className="text-sm text-texto-3">Vista consolidada · {sedes.length} sedes</p>
        </div>
        <ChevronRight size={22} className="text-primario" aria-hidden />
      </Link>

      {sedes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-tarjeta border border-dashed border-borde-activo p-10 text-texto-3">
          <Building2 size={32} aria-hidden />
          <p>Aún no hay sedes. Crea la primera.</p>
        </div>
      ) : (
        <ListaSedes
          sedes={sedes.map(({ id, nombre, tipo, direccion, telefono, activa }) => ({ id, nombre, tipo, direccion, telefono, activa }))}
        />
      )}
    </main>
  );
}
