import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requerirCajero } from "@/lib/sesion";
import { COOKIE_DISPOSITIVO } from "@/lib/dispositivo";
import { crearClienteServidor } from "@/lib/supabase/server";
import { cargarProductosVendibles } from "@/lib/caja/productos";
import type { DatosReporte } from "@/lib/dominio/documentos";
import { ProveedorImpresion } from "@/components/impresion/ProveedorImpresion";
import { AbrirTurno } from "@/components/caja/AbrirTurno";
import { PuntoVenta } from "@/components/caja/PuntoVenta";

export default async function Caja() {
  const cajero = await requerirCajero();
  const supabase = await crearClienteServidor();

  const { data: turno, error: errorTurno } = await supabase
    .from("turnos")
    .select("id, dispositivo")
    .eq("cajero_id", cajero.id)
    .is("cerrado_en", null)
    .maybeSingle<{ id: string; dispositivo: string | null }>();
  // Si la consulta falla no se puede asumir "sin turno" (mostraría Abrir turno en bucle)
  if (errorTurno) throw new Error(`No se pudo consultar el turno: ${errorTurno.message}`);

  // El turno solo se usa desde el equipo donde se abrió
  const equipo = (await cookies()).get(COOKIE_DISPOSITIVO)?.value ?? null;
  if (turno?.dispositivo && turno.dispositivo !== equipo) redirect("/salir?motivo=otro-equipo");

  if (!turno) {
    const [{ data: ultimo }, { data: ocupada }, { data: sugerida }] = await Promise.all([
      supabase
        .from("turnos")
        .select("reporte")
        .eq("cajero_id", cajero.id)
        .not("cerrado_en", "is", null)
        .order("cerrado_en", { ascending: false })
        .limit(1)
        .maybeSingle<{ reporte: DatosReporte }>(),
      // Una caja por sede: ¿otro cajero tiene el turno abierto?
      supabase.rpc("turno_abierto_en_mi_sede"),
      // Lo que quedó en caja en el último cierre de la sede (spec 06)
      supabase.rpc("base_sugerida"),
    ]);

    return (
      <ProveedorImpresion>
        <AbrirTurno
          sede={cajero.sede.nombre}
          cajero={cajero.nombreCompleto}
          ultimoReporte={ultimo?.reporte ?? null}
          ocupada={(ocupada as { cajero: string; abierto_en: string } | null) ?? null}
          baseSugerida={typeof sugerida === "number" ? sugerida : null}
        />
      </ProveedorImpresion>
    );
  }

  const productos = await cargarProductosVendibles(supabase);

  return (
    <ProveedorImpresion>
      <PuntoVenta
        key={turno.id}
        turnoId={turno.id}
        sede={cajero.sede.nombre}
        cajero={cajero.nombreCompleto}
        productosIniciales={productos}
      />
    </ProveedorImpresion>
  );
}
