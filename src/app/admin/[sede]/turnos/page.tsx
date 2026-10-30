import { resolverSede } from "@/lib/admin/sedes";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { DatosReporte } from "@/lib/dominio/documentos";
import { Encabezado } from "@/components/admin/Encabezado";
import { TablaTurnos, type TurnoFila } from "@/components/admin/TablaTurnos";

type Fila = {
  id: string;
  cajero_id: string;
  cerrado_por: string | null;
  abierto_en: string;
  cerrado_en: string | null;
  efectivo_esperado: number | null;
  efectivo_contado: number | null;
  diferencia: number | null;
  reporte: DatosReporte | null;
  cajero: { nombre_completo: string } | null;
  sede: { nombre: string } | null;
};

const SELECT =
  "id, cajero_id, cerrado_por, abierto_en, cerrado_en, efectivo_esperado, efectivo_contado, diferencia, reporte," +
  " cajero:perfiles!turnos_cajero_id_fkey(nombre_completo), sede:sedes(nombre)";

const CERRADOS_MAX = 50;

function aFila(t: Fila): TurnoFila {
  return {
    id: t.id,
    cajero: t.cajero?.nombre_completo ?? "—",
    sede: t.sede?.nombre ?? "—",
    abiertoEn: t.abierto_en,
    cerradoEn: t.cerrado_en,
    cerradoPorAdmin: Boolean(t.cerrado_por && t.cerrado_por !== t.cajero_id),
    esperado: t.efectivo_esperado,
    contado: t.efectivo_contado,
    diferencia: t.diferencia,
    reporte: t.reporte,
  };
}

export default async function PaginaTurnos({ params }: PageProps<"/admin/[sede]/turnos">) {
  const { sede: segmento } = await params;
  const sede = await resolverSede(segmento);
  const supabase = await crearClienteServidor();

  let abiertos = supabase.from("turnos").select(SELECT).is("cerrado_en", null).order("abierto_en");
  let cerrados = supabase
    .from("turnos")
    .select(SELECT)
    .not("cerrado_en", "is", null)
    .order("cerrado_en", { ascending: false })
    .limit(CERRADOS_MAX);
  if (sede) {
    abiertos = abiertos.eq("sede_id", sede.id);
    cerrados = cerrados.eq("sede_id", sede.id);
  }

  const [a, c] = await Promise.all([abiertos.returns<Fila[]>(), cerrados.returns<Fila[]>()]);
  if (a.error || c.error) throw new Error(`No se pudieron cargar los turnos: ${(a.error ?? c.error)?.message}`);

  return (
    <section className="flex flex-col gap-4">
      <Encabezado titulo={sede ? `Turnos · ${sede.nombre}` : "Turnos"} />
      <TablaTurnos abiertos={a.data.map(aFila)} cerrados={c.data.map(aFila)} mostrarSede={!sede} />
    </section>
  );
}
