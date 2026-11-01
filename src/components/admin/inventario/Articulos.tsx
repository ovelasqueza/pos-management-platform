"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { Pencil, Plus, Search } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/browser";
import { formatearPesos, leerPesos } from "@/lib/dominio/dinero";
import { normalizarTexto } from "@/lib/dominio/producto";
import { UNIDADES, type Unidad } from "@/lib/dominio/inventario";
import type { EstadoFormulario } from "@/lib/formularios";
import { cambiarEstadoArticulo, crearArticulo, editarArticulo } from "@/app/admin/[sede]/inventario/acciones";
import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { Modal } from "@/components/ui/Modal";
import { Aviso } from "@/components/ui/Aviso";
import { Interruptor } from "@/components/ui/Interruptor";
import { CampoAutoguardado } from "@/components/ui/CampoAutoguardado";

export type ArticuloFila = { id: string; nombre: string; unidad: Unidad; costo: number | null; activo: boolean };

const sinSigno = (v: number) => formatearPesos(v).replace("$ ", "");

function SelectorUnidad({ valor, error }: { valor?: Unidad; error?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="articulo-unidad" className="text-sm font-semibold text-texto-2">
        Unidad (cómo se cuenta)
      </label>
      <select
        id="articulo-unidad"
        name="unidad"
        defaultValue={valor ?? "bulto"}
        className="min-h-12 rounded-control border border-borde-activo bg-superficie px-4 focus:border-primario focus:outline-none"
      >
        {UNIDADES.map((u) => (
          <option key={u.valor} value={u.valor}>
            {u.nombre[0].toUpperCase() + u.nombre.slice(1)}
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-peligro">{error}</p>}
    </div>
  );
}

function Formulario({ sedeId, articulo, onListo }: { sedeId: string; articulo?: ArticuloFila; onListo: () => void }) {
  const [estado, enviar, enviando] = useActionState<EstadoFormulario, FormData>(articulo ? editarArticulo : crearArticulo, {});
  useEffect(() => {
    if (estado.ok) onListo();
  }, [estado.marca, estado.ok, onListo]);
  const c = estado.campos ?? {};

  return (
    <form action={enviar} className="flex flex-col gap-4">
      {articulo ? <input type="hidden" name="id" value={articulo.id} /> : <input type="hidden" name="sedeId" value={sedeId} />}
      <Campo etiqueta="Nombre" name="nombre" defaultValue={articulo?.nombre} error={c.nombre} maxLength={80} required autoFocus />
      <SelectorUnidad valor={articulo?.unidad} error={c.unidad} />
      {!articulo && (
        <Campo etiqueta="Costo por unidad (opcional)" name="costo" inputMode="numeric" placeholder="Sin costo" error={c.costo} className="num" />
      )}
      {articulo && <p className="text-sm text-texto-3">Cambiar la unidad no modifica inventarios ya hechos.</p>}
      {estado.error && <Aviso>{estado.error}</Aviso>}
      <Boton type="submit" variante="primario" disabled={enviando}>
        {enviando ? "Guardando…" : articulo ? "Guardar" : "Crear materia prima"}
      </Boton>
    </form>
  );
}

export function BotonNuevoArticulo({ sedeId }: { sedeId: string }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Boton variante="primario" icono={<Plus size={20} aria-hidden />} onClick={() => setAbierto(true)}>
        Materia prima
      </Boton>
      <Modal abierto={abierto} titulo="Nueva materia prima" onCerrar={() => setAbierto(false)}>
        {abierto && <Formulario sedeId={sedeId} onListo={() => setAbierto(false)} />}
      </Modal>
    </>
  );
}

function EditarArticulo({ sedeId, articulo }: { sedeId: string; articulo: ArticuloFila }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={`Editar ${articulo.nombre}`}
        onClick={() => setAbierto(true)}
        className="flex size-12 items-center justify-center rounded-control text-texto-2 hover:bg-suave"
      >
        <Pencil size={18} />
      </button>
      <Modal abierto={abierto} titulo="Editar materia prima" onCerrar={() => setAbierto(false)}>
        {abierto && <Formulario sedeId={sedeId} articulo={articulo} onListo={() => setAbierto(false)} />}
      </Modal>
    </>
  );
}

function Activo({ articulo }: { articulo: ArticuloFila }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div className="flex flex-col items-center">
      <Interruptor
        activo={articulo.activo}
        etiqueta={`${articulo.nombre} activo`}
        deshabilitado={pendiente}
        onCambiar={(v) =>
          iniciar(async () => {
            setError(undefined);
            const r = await cambiarEstadoArticulo(articulo.id, v);
            if (r.error) setError(r.error);
          })
        }
      />
      {error && <p role="alert" className="text-xs text-peligro">{error}</p>}
    </div>
  );
}

/** Materias primas de la sede: costo con guardado automático, activo y editar. */
export function TablaArticulos({ sedeId, articulos }: { sedeId: string; articulos: ArticuloFila[] }) {
  const [busqueda, setBusqueda] = useState("");
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const visibles = useMemo(() => {
    const q = normalizarTexto(busqueda);
    return q ? articulos.filter((a) => normalizarTexto(a.nombre).includes(q)) : articulos;
  }, [articulos, busqueda]);

  const guardarCosto = (id: string) => async (costo: number) => {
    const { data, error } = await supabase.from("articulos_inventario").update({ costo }).eq("id", id).select("id");
    return !error && data.length === 1;
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="relative w-full max-w-sm">
        <span className="sr-only">Buscar materia prima</span>
        <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texto-3" aria-hidden />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar"
          className="min-h-12 w-full rounded-control border border-borde-activo bg-superficie pr-4 pl-10 focus:border-primario focus:outline-none"
        />
      </label>
      <div className="overflow-x-auto rounded-tarjeta border border-borde bg-superficie">
        <table className="w-full text-left">
          <thead className="border-b border-borde text-sm text-texto-3">
            <tr>
              <th className="px-4 py-3 font-medium">Materia prima</th>
              <th className="px-4 py-3 font-medium">Unidad</th>
              <th className="px-4 py-3 text-right font-medium">Costo por unidad</th>
              <th className="w-20 px-2 py-3 text-center font-medium">Activo</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {visibles.map((a) => (
              <tr key={a.id} className="border-b border-suave align-top last:border-0">
                <td className={`px-4 py-4 font-medium ${a.activo ? "" : "text-texto-3"}`}>{a.nombre}</td>
                <td className="px-4 py-4 text-texto-2 capitalize">{a.unidad}</td>
                <td className="px-4 py-1">
                  <CampoAutoguardado
                    etiqueta={`Costo de ${a.nombre}`}
                    valor={a.costo}
                    leer={(t) => leerPesos(t)}
                    guardar={guardarCosto(a.id)}
                    formatear={sinSigno}
                    placeholder="Sin costo"
                  />
                </td>
                <td className="px-2 py-1">
                  <Activo articulo={a} />
                </td>
                <td className="px-1 py-1">
                  <EditarArticulo sedeId={sedeId} articulo={a} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibles.length === 0 && (
          <p className="p-6 text-center text-texto-3">
            {articulos.length ? "Sin resultados" : "Aún no hay materias primas. Crea la primera (harina, aceite, carbón…)"}
          </p>
        )}
      </div>
    </div>
  );
}
