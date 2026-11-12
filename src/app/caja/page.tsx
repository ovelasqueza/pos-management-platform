import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requerirCajero } from "@/lib/sesion";
import { COOKIE_DISPOSITIVO } from "@/lib/dispositivo";
import { crearClienteServidor } from "@/lib/supabase/server";
import { cargarProductosVendibles } from "@/lib/caja/productos";
import { ProveedorImpresion } from "@/components/impresion/ProveedorImpresion";
import { AbrirTurnoDinamico } from "@/components/caja/AbrirTurnoDinamico";
import { PuntoVentaDinamico } from "@/components/caja/PuntoVentaDinamico";

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
    const [{ data: ultimoCerrado }, { data: ocupada }] = await Promise.all([
      // Verificamos si existe un cierre previo sin transferir el reporte completo en el SSR
      supabase
        .from("turnos")
        .select("id")
        .eq("cajero_id", cajero.id)
        .not("cerrado_en", "is", null)
        .order("cerrado_en", { ascending: false })
        .limit(1)
        .maybeSingle<{ id: string }>(),
      // Una caja por sede: ¿otro cajero tiene el turno abierto?
      supabase.rpc("turno_abierto_en_mi_sede"),
    ]);

    return (
      <ProveedorImpresion anchoSede={cajero.sede.anchoPapel}>
        <AbrirTurnoDinamico
          sede={cajero.sede.nombre}
          cajero={cajero.nombreCompleto}
          tieneUltimoReporte={Boolean(ultimoCerrado?.id)}
          ocupada={(ocupada as { cajero: string; abierto_en: string } | null) ?? null}
        />
      </ProveedorImpresion>
    );
  }

  const productos = await cargarProductosVendibles(supabase);

  return (
    <ProveedorImpresion anchoSede={cajero.sede.anchoPapel}>
      <PuntoVentaDinamico
        key={turno.id}
        turnoId={turno.id}
        sede={cajero.sede.nombre}
        cajero={cajero.nombreCompleto}
        productosIniciales={productos}
      />
    </ProveedorImpresion>
  );
}
