import Link from "next/link";
import { Info } from "lucide-react";
import { resolverSede } from "@/lib/admin/sedes";
import { listarCategorias, listarProductos, listarProductosSede } from "@/lib/admin/catalogo";
import { TIPOS_SEDE, nombreTipo, type TipoSede } from "@/lib/dominio/sede";
import { formatearPesos } from "@/lib/dominio/dinero";
import { Encabezado } from "@/components/admin/Encabezado";
import { FotoProducto } from "@/components/admin/FotoProducto";
import { BotonNuevoProducto, EditarProducto } from "@/components/admin/FormularioProducto";
import { GestorCategorias } from "@/components/admin/GestorCategorias";
import { TablaProductosSede } from "@/components/admin/TablaProductosSede";

/**
 * Productos y precios en una sola pantalla.
 * - Con una sede escogida: productos de su catálogo con "Vende", precio de venta y costo de esa sede.
 * - En "Todas las sedes": catálogos por tipo con el precio de referencia.
 */
export default async function PaginaProductos({ params, searchParams }: PageProps<"/admin/[sede]/productos">) {
  const [{ sede: segmento }, { tipo: tipoParam }] = await Promise.all([params, searchParams]);
  const sede = await resolverSede(segmento);

  if (sede) {
    const [categorias, filas] = await Promise.all([listarCategorias(sede.tipo), listarProductosSede(sede.id)]);
    const opciones = categorias.map(({ id, nombre }) => ({ id, nombre }));
    return (
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Encabezado titulo={`Productos · ${sede.nombre}`} />
            <p className="text-sm text-texto-3">
              Catálogo {nombreTipo(sede.tipo)} · Precio y costo se guardan solos
            </p>
          </div>
          <div className="flex gap-2">
            <GestorCategorias tipo={sede.tipo} categorias={categorias} />
            <BotonNuevoProducto tipo={sede.tipo} categorias={opciones} />
          </div>
        </div>
        <TablaProductosSede key={sede.id} sedeId={sede.id} tipo={sede.tipo} filas={filas} categorias={opciones} />
      </section>
    );
  }

  // Todas las sedes: catálogo por tipo
  const tipo: TipoSede = tipoParam === "asadero" ? "asadero" : "panaderia";
  const [categorias, productos] = await Promise.all([listarCategorias(tipo), listarProductos(tipo)]);
  const opciones = categorias.map(({ id, nombre }) => ({ id, nombre }));

  return (
    <section className="flex flex-col gap-4">
      <Encabezado
        titulo="Productos · Catálogos"
        accion={
          <div className="flex gap-2">
            <GestorCategorias tipo={tipo} categorias={categorias} />
            <BotonNuevoProducto tipo={tipo} categorias={opciones} />
          </div>
        }
      />

      <p className="flex items-center gap-2 text-sm text-texto-3">
        <Info size={16} aria-hidden />
        Escoge una sede arriba para ver y cambiar su precio de venta y costo.
      </p>

      <nav aria-label="Catálogo" className="flex w-fit rounded-tarjeta bg-suave p-1">
        {TIPOS_SEDE.map((t) => (
          <Link
            key={t.valor}
            href={`?tipo=${t.valor}`}
            aria-current={t.valor === tipo ? "page" : undefined}
            className={`flex min-h-11 items-center rounded-control px-5 font-medium ${
              t.valor === tipo ? "border border-borde bg-superficie text-texto" : "text-texto-3"
            }`}
          >
            {t.nombre}
          </Link>
        ))}
      </nav>

      <div className="overflow-x-auto rounded-tarjeta border border-borde bg-superficie">
        <table className="w-full text-left">
          <thead className="border-b border-borde text-sm text-texto-3">
            <tr>
              <th className="px-4 py-3 font-medium">Producto</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Categoría</th>
              <th className="px-4 py-3 text-right font-medium">Precio ref.</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => (
              <tr key={p.id} className={`border-b border-suave last:border-0 ${p.activo ? "" : "text-texto-3"}`}>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-3">
                    <FotoProducto id={p.id} nombre={p.nombre} url={p.imagenUrl} />
                    <span className="font-medium">{p.nombre}</span>
                    {!p.activo && <span className="rounded-control bg-suave px-2 py-0.5 text-xs">Inactivo</span>}
                  </div>
                </td>
                <td className="hidden px-4 py-2 text-texto-2 sm:table-cell">{p.categoria ?? "—"}</td>
                <td className="num px-4 py-2 text-right">{formatearPesos(p.precioReferencia)}</td>
                <td className="px-1 py-1">
                  <EditarProducto tipo={tipo} producto={p} categorias={opciones} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {productos.length === 0 && <p className="p-6 text-center text-texto-3">Sin productos en este catálogo</p>}
      </div>
    </section>
  );
}
