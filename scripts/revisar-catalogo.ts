/**
 * Revisa (solo lectura) lo importado: productos por catálogo, categorías y en cuántas sedes quedaron habilitados.
 * Uso: npx tsx --env-file=.env.local scripts/revisar-catalogo.ts
 */
import { createClient } from "@supabase/supabase-js";

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});

async function main() {
  for (const tipo of ["panaderia", "asadero"] as const) {
    const [{ count: productos }, { count: categorias }, { data: sedes }] = await Promise.all([
      s.from("productos").select("*", { count: "exact", head: true }).eq("tipo", tipo),
      s.from("categorias").select("*", { count: "exact", head: true }).eq("tipo", tipo),
      s.from("sedes").select("id, nombre").eq("tipo", tipo),
    ]);
    console.log(`${tipo}: ${productos} productos, ${categorias} categorías, ${sedes?.length ?? 0} sedes`);
    for (const sede of sedes ?? []) {
      const { count } = await s.from("productos_sede").select("*", { count: "exact", head: true }).eq("sede_id", sede.id);
      console.log(`  - ${sede.nombre}: ${count} productos habilitados`);
    }
  }
  const { data } = await s.from("productos").select("nombre, precio_referencia").ilike("nombre", "%NIDO DE FRUTAS%");
  console.log(`Corrección línea 204: ${data?.map((p) => `${p.nombre} ($${p.precio_referencia})`).join(", ") || "no encontrado"}`);
}

main();
