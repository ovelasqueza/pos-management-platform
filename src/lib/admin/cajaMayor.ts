import "server-only";
import { crearClienteServidor } from "@/lib/supabase/server";
import { limitesRango, type Rango } from "@/lib/dominio/fechas";
import type { MetodoPago } from "@/lib/dominio/cobro";
import type { DatosReporte } from "@/lib/dominio/documentos";
import { SALDO_VACIO, type SaldoCajaMayor, type TipoMovimiento } from "@/lib/dominio/cajaMayor";
import { POR_PAGINA } from "./reportes";

/** Saldo por parte de cada sede (las que no tienen filas quedan en 0). */
export async function saldosPorSede(): Promise<Map<string, SaldoCajaMayor>> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("caja_mayor_saldos")
    .select("sede_id, parte, saldo")
    .returns<{ sede_id: string; parte: MetodoPago; saldo: number | string }[]>();
  if (error) throw new Error(`No se pudo cargar la caja mayor: ${error.message}`);

  const mapa = new Map<string, SaldoCajaMayor>();
  for (const f of data) {
    const s = mapa.get(f.sede_id) ?? { ...SALDO_VACIO };
    const valor = Number(f.saldo);
    s[f.parte] = valor;
    s.total += valor;
    mapa.set(f.sede_id, s);
  }
  return mapa;
}

export type Movimiento = {
  id: string;
  creadoEn: string;
  tipo: TipoMovimiento;
  parte: MetodoPago;
  monto: number;
  saldoDespues: number;
  usuario: string;
  descripcion: string | null;
  turnoCajero: string | null;
  reporte: DatosReporte | null;
};

type FilaMovimiento = {
  id: string;
  creado_en: string;
  tipo: TipoMovimiento;
  parte: MetodoPago;
  monto: number | string;
  saldo_despues: number | string;
  descripcion: string | null;
  usuario: { nombre_completo: string } | null;
  turno: { reporte: DatosReporte | null; cajero: { nombre_completo: string } | null } | null;
};

/** Movimientos de la sede en el rango, del más reciente al más antiguo (50 por página). */
export async function listarMovimientos(sedeId: string, rango: Rango, pagina: number) {
  const supabase = await crearClienteServidor();
  const { inicio, fin } = limitesRango(rango);
  const { data, error, count } = await supabase
    .from("caja_mayor_movimientos")
    .select(
      "id, creado_en, tipo, parte, monto, saldo_despues, descripcion, usuario:perfiles(nombre_completo)," +
        " turno:turnos(reporte, cajero:perfiles!turnos_cajero_id_fkey(nombre_completo))",
      { count: "exact" },
    )
    .eq("sede_id", sedeId)
    .gte("creado_en", inicio)
    .lt("creado_en", fin)
    .order("creado_en", { ascending: false })
    .order("id")
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1)
    .returns<FilaMovimiento[]>();
  if (error) throw new Error(`No se pudieron cargar los movimientos: ${error.message}`);

  const filas: Movimiento[] = data.map((m) => ({
    id: m.id,
    creadoEn: m.creado_en,
    tipo: m.tipo,
    parte: m.parte,
    monto: Number(m.monto),
    saldoDespues: Number(m.saldo_despues),
    usuario: m.usuario?.nombre_completo ?? "—",
    descripcion: m.descripcion,
    turnoCajero: m.turno?.cajero?.nombre_completo ?? null,
    reporte: m.turno?.reporte ?? null,
  }));
  return { filas, total: count ?? 0 };
}
