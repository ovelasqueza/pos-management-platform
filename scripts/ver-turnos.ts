/**
 * Lista (solo lectura) los últimos turnos con sus horas en Bogotá.
 * Uso: npx tsx --env-file=.env.local scripts/ver-turnos.ts
 */
import { createClient } from "@supabase/supabase-js";

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});
const hora = (v: string | null) =>
  v ? new Date(v).toLocaleString("es-CO", { timeZone: "America/Bogota", hour12: true }) : "—";

async function main() {
  const { data, error } = await s
    .from("turnos")
    .select("id, abierto_en, cerrado_en, cerrado_por, cajero_id, base, efectivo_esperado, efectivo_contado, cajero:perfiles!turnos_cajero_id_fkey(nombre_completo)")
    .order("abierto_en", { ascending: false })
    .limit(6);
  if (error) throw error;
  for (const t of data as unknown as {
    id: string; abierto_en: string; cerrado_en: string | null; cerrado_por: string | null; cajero_id: string;
    base: number; efectivo_esperado: number | null; efectivo_contado: number | null; cajero: { nombre_completo: string } | null;
  }[]) {
    console.log(
      `${t.id.slice(0, 8)}  ${t.cajero?.nombre_completo}  abierto ${hora(t.abierto_en)}  ` +
        (t.cerrado_en ? `cerrado ${hora(t.cerrado_en)} por ${t.cerrado_por === t.cajero_id ? "cajero" : "admin"}  esperado ${t.efectivo_esperado}  contado ${t.efectivo_contado}` : "ABIERTO") +
        `  base ${t.base}`,
    );
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
