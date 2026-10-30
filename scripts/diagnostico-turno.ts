/**
 * Diagnóstico (solo lectura) de la apertura de turno.
 * Uso: npx tsx --env-file=.env.local scripts/diagnostico-turno.ts
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const s = createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

async function main() {
  // 1. ¿Existe la columna dispositivo? (migración 08)
  const col = await s.from("turnos").select("id, dispositivo").limit(1);
  console.log(`Migración 08 (columna dispositivo): ${col.error ? "NO aplicada → " + col.error.message : "aplicada"}`);

  // 2. Turnos abiertos
  const { data: abiertos, error } = await s
    .from("turnos")
    .select("id, abierto_en, cajero:perfiles!turnos_cajero_id_fkey(nombre_completo), sede:sedes(nombre)")
    .is("cerrado_en", null);
  console.log(`Turnos abiertos: ${error ? error.message : abiertos.length}`);
  for (const t of abiertos ?? []) console.log(`  - ${JSON.stringify(t)}`);

  // 3. ¿Supabase acepta el encabezado x-pos-dispositivo desde el navegador? (CORS)
  const r = await fetch(`${url}/rest/v1/rpc/abrir_turno`, {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:3000",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "apikey,authorization,content-type,x-client-info,x-pos-dispositivo",
    },
  });
  console.log(`CORS preflight: ${r.status} · allow-headers: ${r.headers.get("access-control-allow-headers")}`);
}

main();
