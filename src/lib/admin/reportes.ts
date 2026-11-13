import "server-only";
import { crearClienteServidor } from "@/lib/supabase/server";
import { limitesRango, periodoAnterior, type Rango } from "@/lib/dominio/fechas";
import type { MetodoPago } from "@/lib/dominio/cobro";
import type { TipoSede } from "@/lib/dominio/sede";
import type { DatosReporte } from "@/lib/dominio/documentos";

export const POR_PAGINA = 50;

export type Resumen = {
  total: number;
  cantidad: number;
  gastos: number;
  por_metodo: Record<MetodoPago, number>;
  por_sede: { sede_id: string; nombre: string; total: number; cantidad: number; gastos: number }[];
};

const args = (sedeId: string | null, r: Rango) => ({ p_sede: sedeId, p_desde: r.desde, p_hasta: r.hasta });

function fallar(que: string, error: { message: string }): never {
  throw new Error(`No se pudo cargar ${que}: ${error.message}`);
}

export async function obtenerResumen(sedeId: string | null, rango: Rango) {
  const supabase = await crearClienteServidor();
  const [resumen, dias] = await Promise.all([
    supabase.rpc("rep_resumen", args(sedeId, rango)),
    supabase.rpc("rep_ventas_por_dia", args(sedeId, rango)),
  ]);
  if (resumen.error) fallar("el resumen", resumen.error);
  if (dias.error) fallar("las ventas por día", dias.error);
  return {
    resumen: resumen.data as Resumen,
    dias: (dias.data as { fecha: string; total: number }[]).map((d) => ({ fecha: d.fecha, total: Number(d.total) })),
  };
}

export type FilaProductoVendido = {
  productoId: string;
  nombre: string;
  tipo: TipoSede;
  unidades: number;
  valor: number;
  porSede: { sede: string; unidades: number }[];
};

export async function obtenerProductosVendidos(sedeId: string | null, rango: Rango): Promise<FilaProductoVendido[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("rep_productos", args(sedeId, rango));
  if (error) fallar("los productos", error);
  return (
    data as {
      producto_id: string;
      nombre: string;
      tipo: TipoSede;
      unidades: number;
      valor: number;
      por_sede: { sede: string; unidades: number }[];
    }[]
  ).map((p) => ({
    productoId: p.producto_id,
    nombre: p.nombre,
    tipo: p.tipo,
    unidades: Number(p.unidades),
    valor: Number(p.valor),
    porSede: p.por_sede,
  }));
}

const desdeHasta = (pagina: number) => [(pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1] as const;

export type FilaVenta = {
  id: string;
  numero: number;
  creado_en: string;
  total: number;
  metodo: MetodoPago;
  monto_efectivo?: number | null;
  monto_transferencia?: number | null;
  sede: { nombre: string } | null;
  cajero: { nombre_completo: string } | null;
  /** Script 18 */
  anulada_en?: string | null;
  motivo_anulacion?: string | null;
};

export async function listarVentas(sedeId: string | null, rango: Rango, pagina: number) {
  const supabase = await crearClienteServidor();
  const { inicio, fin } = limitesRango(rango);
  const consulta = (columnas: string) => {
    let q = supabase
      .from("ventas")
      .select(`${columnas}, sede:sedes(nombre), cajero:perfiles(nombre_completo)`, { count: "exact" })
      .gte("creado_en", inicio)
      .lt("creado_en", fin)
      .order("creado_en", { ascending: false })
      .range(...desdeHasta(pagina));
    if (sedeId) q = q.eq("sede_id", sedeId);
    return q.returns<FilaVenta[]>();
  };
  let { data, error, count } = await consulta(
    "id, numero, creado_en, total, metodo, monto_efectivo, monto_transferencia, anulada_en, motivo_anulacion",
  );
  // Respaldo mientras no se ejecuten migraciones pendientes
  if (error?.code === "42703") {
    ({ data, error, count } = await consulta("id, numero, creado_en, total, metodo, anulada_en, motivo_anulacion"));
  }
  if (error?.code === "42703") ({ data, error, count } = await consulta("id, numero, creado_en, total, metodo"));
  if (error) fallar("las ventas", error);
  return { filas: data ?? [], total: count ?? 0 };
}

export type FilaAnulada = {
  ventaId: string;
  numero: number;
  creadoEn: string;
  anuladaEn: string;
  sede: string;
  cajero: string;
  metodo: MetodoPago;
  total: number;
  motivo: string;
};

/** Ventas anuladas con hora de anulación en el rango. null si falta el script 18. */
export async function listarAnuladas(sedeId: string | null, rango: Rango): Promise<FilaAnulada[] | null> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("rep_ventas_anuladas", args(sedeId, rango));
  if (error?.code === "PGRST202" || error?.code === "42883") return null;
  if (error) fallar("las ventas anuladas", error);
  return (data as Record<string, string | number>[]).map((f) => ({
    ventaId: String(f.venta_id),
    numero: Number(f.numero),
    creadoEn: String(f.creado_en),
    anuladaEn: String(f.anulada_en),
    sede: String(f.sede),
    cajero: String(f.cajero),
    metodo: f.metodo as MetodoPago,
    total: Number(f.total),
    motivo: String(f.motivo),
  }));
}

export type FilaGasto = {
  id: string;
  creado_en: string;
  monto: number;
  monto_caja: number;
  monto_mayor: number;
  mayor_efectivo: number;
  mayor_transferencia: number;
  mayor_tarjeta: number;
  descripcion: string;
  anulado_en: string | null;
  turno: { sede: { nombre: string } | null; cajero: { nombre_completo: string } | null } | null;
};

export async function listarGastos(sedeId: string | null, rango: Rango, pagina: number) {
  const supabase = await crearClienteServidor();
  const { inicio, fin } = limitesRango(rango);
  let q = supabase
    .from("gastos")
    .select(
      "id, creado_en, monto, monto_caja, monto_mayor, mayor_efectivo, mayor_transferencia, mayor_tarjeta, descripcion, anulado_en, turno:turnos!inner(sede_id, sede:sedes(nombre), cajero:perfiles!turnos_cajero_id_fkey(nombre_completo))",
      { count: "exact" },
    )
    .gte("creado_en", inicio)
    .lt("creado_en", fin)
    .order("creado_en", { ascending: false })
    .range(...desdeHasta(pagina));
  if (sedeId) q = q.eq("turno.sede_id", sedeId);
  const { data, error, count } = await q.returns<FilaGasto[]>();
  if (error) fallar("los gastos", error);
  return { filas: data, total: count ?? 0 };
}

export type FilaTurnoReporte = {
  id: string;
  abierto_en: string;
  cerrado_en: string | null;
  cajero_id: string;
  cerrado_por: string | null;
  efectivo_esperado: number | null;
  efectivo_contado: number | null;
  diferencia: number | null;
  reporte: DatosReporte | null;
  sede: { nombre: string } | null;
  cajero: { nombre_completo: string } | null;
};

/** Turnos con apertura dentro del rango. */
export async function listarTurnos(sedeId: string | null, rango: Rango, pagina: number) {
  const supabase = await crearClienteServidor();
  const { inicio, fin } = limitesRango(rango);
  let q = supabase
    .from("turnos")
    .select(
      "id, abierto_en, cerrado_en, cajero_id, cerrado_por, efectivo_esperado, efectivo_contado, diferencia, reporte, sede:sedes(nombre), cajero:perfiles!turnos_cajero_id_fkey(nombre_completo)",
      { count: "exact" },
    )
    .gte("abierto_en", inicio)
    .lt("abierto_en", fin)
    .order("abierto_en", { ascending: false })
    .range(...desdeHasta(pagina));
  if (sedeId) q = q.eq("sede_id", sedeId);
  const { data, error, count } = await q.returns<FilaTurnoReporte[]>();
  if (error) fallar("los turnos", error);
  return { filas: data, total: count ?? 0 };
}

/** Gastos vigentes del rango (total, sin paginar). */
export async function totalGastosVigentes(sedeId: string | null, rango: Rango): Promise<number> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("rep_resumen", args(sedeId, rango));
  if (error) fallar("el total de gastos", error);
  return (data as Resumen).gastos;
}


// ── Cuadre diario ──

export type FilaCuadre = {
  fecha: string;
  turnos: number;
  base: number;
  efectivo: number;
  transferencia: number;
  tarjeta: number;
  /** Gastos que salieron de la caja (los que se restan del esperado) */
  gastos: number;
  esperado: number;
  contado: number;
  diferencia: number;
  /** Spec 06: gastos pagados con caja mayor y efectivo enviado a caja mayor */
  gastosMayor: number;
  aMayor: number;
};

export async function obtenerCuadreDiario(sedeId: string | null, rango: Rango) {
  const supabase = await crearClienteServidor();
  const { inicio, fin } = limitesRango(rango);
  let abiertos = supabase
    .from("turnos")
    .select("id", { count: "exact", head: true })
    .is("cerrado_en", null)
    .gte("abierto_en", inicio)
    .lt("abierto_en", fin);
  if (sedeId) abiertos = abiertos.eq("sede_id", sedeId);

  const [cuadre, a] = await Promise.all([supabase.rpc("rep_cuadre_diario", args(sedeId, rango)), abiertos]);
  if (cuadre.error) fallar("el cuadre diario", cuadre.error);
  if (a.error) fallar("los turnos abiertos", a.error);

  const filas = (cuadre.data as Record<string, string | number | undefined>[]).map(
    (f): FilaCuadre => ({
      fecha: String(f.fecha),
      turnos: Number(f.turnos),
      base: Number(f.base),
      efectivo: Number(f.efectivo),
      transferencia: Number(f.transferencia),
      tarjeta: Number(f.tarjeta),
      gastos: Number(f.gastos),
      esperado: Number(f.esperado),
      contado: Number(f.contado),
      diferencia: Number(f.diferencia),
      gastosMayor: Number(f.gastos_mayor ?? 0),
      aMayor: Number(f.a_mayor ?? 0),
    }),
  );
  return { filas, turnosAbiertos: a.count ?? 0 };
}

// ── Diferencias por cajero ──

export type FilaDiferenciaCajero = {
  cajeroId: string;
  cajero: string;
  turnos: number;
  cuadrados: number;
  faltantes: number;
  faltante: number;
  sobrantes: number;
  sobrante: number;
  neto: number;
};

export async function obtenerDiferenciasCajero(sedeId: string | null, rango: Rango): Promise<FilaDiferenciaCajero[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("rep_diferencias_cajero", args(sedeId, rango));
  if (error) fallar("las diferencias por cajero", error);
  return (data as Record<string, string | number>[]).map((f) => ({
    cajeroId: String(f.cajero_id),
    cajero: String(f.cajero),
    turnos: Number(f.turnos),
    cuadrados: Number(f.cuadrados),
    faltantes: Number(f.faltantes),
    faltante: Number(f.faltante),
    sobrantes: Number(f.sobrantes),
    sobrante: Number(f.sobrante),
    neto: Number(f.neto),
  }));
}

// ── Ventas por hora ──

export type FilaHora = { hora: number; ventas: number; total: number };

export async function obtenerVentasPorHora(sedeId: string | null, rango: Rango): Promise<FilaHora[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("rep_ventas_por_hora", args(sedeId, rango));
  if (error) fallar("las ventas por hora", error);
  return (data as Record<string, string | number>[]).map((f) => ({
    hora: Number(f.hora),
    ventas: Number(f.ventas),
    total: Number(f.total),
  }));
}

// ── Resumen: comparación y cajas abiertas ──

/**
 * Vendido en el periodo anterior equivalente (ver periodoAnterior).
 * Devuelve null si no aplica o si la función aún no existe en la BD (migración 07 pendiente).
 */
export async function obtenerComparacion(sedeId: string | null, rango: Rango) {
  const anterior = periodoAnterior(rango);
  if (!anterior) return null;
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("rep_vendido_entre", {
    p_sede: sedeId,
    p_inicio: anterior.inicio,
    p_fin: anterior.fin,
  });
  if (error) return null;
  const d = data as { total: number; cantidad: number };
  return { total: Number(d.total), cantidad: Number(d.cantidad), etiqueta: anterior.etiqueta };
}

export type TurnoAbierto = { id: string; abiertoEn: string; cajero: string; sede: string };

export async function listarTurnosAbiertos(sedeId: string | null): Promise<TurnoAbierto[]> {
  const supabase = await crearClienteServidor();
  let q = supabase
    .from("turnos")
    .select("id, abierto_en, sede:sedes(nombre), cajero:perfiles!turnos_cajero_id_fkey(nombre_completo)")
    .is("cerrado_en", null)
    .order("abierto_en");
  if (sedeId) q = q.eq("sede_id", sedeId);
  const { data, error } = await q.returns<
    { id: string; abierto_en: string; sede: { nombre: string } | null; cajero: { nombre_completo: string } | null }[]
  >();
  if (error) fallar("los turnos abiertos", error);
  return data.map((t) => ({
    id: t.id,
    abiertoEn: t.abierto_en,
    cajero: t.cajero?.nombre_completo ?? "—",
    sede: t.sede?.nombre ?? "—",
  }));
}

/** Versión que no rompe la pantalla si la migración 07 aún no está aplicada. */
export async function intentar<T>(f: () => Promise<T>): Promise<T | null> {
  try {
    return await f();
  } catch {
    return null;
  }
}


// ── Productos por hora ──

export type ProductoHoraPico = { productoId: string; nombre: string; unidades: number; valor: number; horaPico: number; unidadesPico: number };

/** Los productos que más venden (por valor) y la hora del día en que más se venden. */
export async function obtenerProductosHoraPico(sedeId: string | null, rango: Rango, limite = 5): Promise<ProductoHoraPico[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("rep_productos_hora_pico", { ...args(sedeId, rango), p_limite: limite });
  if (error) fallar("los productos más vendidos", error);
  return (data as Record<string, string | number>[]).map((f) => ({
    productoId: String(f.producto_id),
    nombre: String(f.nombre),
    unidades: Number(f.unidades),
    valor: Number(f.valor),
    horaPico: Number(f.hora_pico),
    unidadesPico: Number(f.unidades_pico),
  }));
}

export type TopHora = { hora: number; productos: { productoId: string; nombre: string; unidades: number; valor: number }[] };

/** Para cada hora del día, los productos con más unidades vendidas. */
export async function obtenerTopPorHora(sedeId: string | null, rango: Rango, porHora = 3): Promise<TopHora[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("rep_top_por_hora", { ...args(sedeId, rango), p_por_hora: porHora });
  if (error) fallar("los productos por hora", error);
  const horas = new Map<number, TopHora>();
  for (const f of data as Record<string, string | number>[]) {
    const hora = Number(f.hora);
    if (!horas.has(hora)) horas.set(hora, { hora, productos: [] });
    horas.get(hora)!.productos.push({
      productoId: String(f.producto_id),
      nombre: String(f.nombre),
      unidades: Number(f.unidades),
      valor: Number(f.valor),
    });
  }
  return [...horas.values()].sort((a, b) => a.hora - b.hora);
}
