/**
 * Verifica (solo lectura) que las migraciones estén aplicadas en Supabase.
 * Uso: npm run verificar-bd   (lee .env.local)
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SECRET_KEY;
if (!url || !clave) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en .env.local");
  process.exit(1);
}

const s = createClient(url, clave, { auth: { persistSession: false } });
let fallas = 0;
const linea = (ok: boolean, que: string, detalle: string) => {
  if (!ok) fallas++;
  console.log(`${ok ? "OK   " : "FALLA"}  ${que.padEnd(28)} ${detalle}`);
};

async function main() {
  const tablas = [
    "sedes", "perfiles", "categorias", "productos", "productos_sede", "costos_producto_sede",
    "productos_vendibles", "turnos", "contadores_venta", "ventas", "lineas_venta", "gastos",
    "caja_mayor_saldos", "caja_mayor_movimientos",
  ];
  for (const t of tablas) {
    const { count, error } = await s.from(t).select("*", { count: "exact", head: true });
    linea(!error, t, error ? error.message : `filas: ${count}`);
  }

  // Sin usuario (clave secreta) las RPC deben responder con un error de permiso: eso prueba que existen.
  // Las de "security invoker" fallan antes, al no tener acceso al esquema privado (un admin real sí lo tiene).
  const rpcs: [string, Record<string, unknown>][] = [
    ["aplicar_precio_referencia", { p_producto: "00000000-0000-0000-0000-000000000000" }],
    ["abrir_turno", { p_base: 0 }],
    // Versiones de las migraciones 15 y 16 (caja mayor)
    ["registrar_gasto", { p_monto: 1, p_descripcion: "x", p_mayor_efectivo: 0, p_mayor_transferencia: 0, p_mayor_tarjeta: 0 }],
    ["cerrar_turno", { p_turno: "00000000-0000-0000-0000-000000000000", p_contado: 0, p_a_mayor: 0 }],
    ["caja_mayor_saldo", {}],
    ["base_sugerida", {}],
    ["caja_mayor_ajustar", { p_sede: "00000000-0000-0000-0000-000000000000", p_parte: "efectivo", p_monto: 1, p_descripcion: "x" }],
    ["caja_mayor_fijar", { p_sede: "00000000-0000-0000-0000-000000000000", p_parte: "efectivo", p_saldo: 0, p_descripcion: "x" }],
    ["rep_resumen", { p_sede: null, p_desde: "2026-10-01", p_hasta: "2026-10-28" }],
    ["rep_ventas_por_dia", { p_sede: null, p_desde: "2026-10-01", p_hasta: "2026-10-28" }],
    ["rep_productos", { p_sede: null, p_desde: "2026-10-01", p_hasta: "2026-10-28" }],
    ["rep_cuadre_diario", { p_sede: null, p_desde: "2026-10-01", p_hasta: "2026-10-28" }],
    ["rep_diferencias_cajero", { p_sede: null, p_desde: "2026-10-01", p_hasta: "2026-10-28" }],
    ["rep_ventas_por_hora", { p_sede: null, p_desde: "2026-10-01", p_hasta: "2026-10-28" }],
    ["rep_caja_turno", { p_turno: "00000000-0000-0000-0000-000000000000" }],
    ["rep_vendido_entre", { p_sede: null, p_inicio: "2026-10-01T00:00:00-05:00", p_fin: "2026-10-02T00:00:00-05:00" }],
    ["rep_productos_hora_pico", { p_sede: null, p_desde: "2026-10-01", p_hasta: "2026-10-28", p_limite: 5 }],
    ["rep_top_por_hora", { p_sede: null, p_desde: "2026-10-01", p_hasta: "2026-10-28", p_por_hora: 3 }],
  ];
  for (const [f, a] of rpcs) {
    const { error } = await s.rpc(f, a);
    const existe = !error || /SOLO_|SIN_PERMISO|permission denied for (schema privado|function es_admin)/.test(error.message);
    linea(existe, `rpc ${f}`, existe ? "existe" : (error?.message ?? ""));
  }

  const { data: b, error: eb } = await s.storage.getBucket("productos");
  linea(!eb, "bucket productos", eb ? eb.message : `público=${b.public} límite=${b.file_size_limit} B`);

  const { data: admins } = await s.from("perfiles").select("nombre_usuario").eq("rol", "admin");
  console.log(`\nAdmins: ${admins?.length ? admins.map((a) => a.nombre_usuario).join(", ") : "ninguno (ejecuta npm run crear-admin)"}`);
  console.log(fallas ? `\n${fallas} problema(s).` : "\nTodo listo.");
  process.exit(fallas ? 1 : 0);
}

main();
