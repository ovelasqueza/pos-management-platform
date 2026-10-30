"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Check, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
import { Boton } from "@/components/ui/Boton";
import { Modal } from "@/components/ui/Modal";
import { Aviso } from "@/components/ui/Aviso";
import { crearCategoria, eliminarCategoria, renombrarCategoria } from "@/app/admin/[sede]/productos/acciones";
import type { TipoSede } from "@/lib/dominio/sede";

type Categoria = { id: string; nombre: string; productos: number };

const claseInput =
  "min-h-12 flex-1 rounded-control border border-borde-activo bg-superficie px-4 focus:border-primario focus:outline-none";
const claseIcono = "flex size-12 shrink-0 items-center justify-center rounded-control hover:bg-suave";

export function GestorCategorias({ tipo, categorias }: { tipo: TipoSede; categorias: Categoria[] }) {
  const [abierto, setAbierto] = useState(false);
  const [nueva, setNueva] = useState("");
  const [editando, setEditando] = useState<{ id: string; nombre: string } | null>(null);
  const [error, setError] = useState<string>();
  const [pendiente, iniciar] = useTransition();

  function ejecutar(accion: () => Promise<{ error?: string }>, alTerminar?: () => void) {
    setError(undefined);
    iniciar(async () => {
      const r = await accion();
      if (r.error) setError(r.error);
      else alTerminar?.();
    });
  }

  function agregar(e: FormEvent) {
    e.preventDefault();
    ejecutar(() => crearCategoria(tipo, nueva), () => setNueva(""));
  }

  return (
    <>
      <Boton icono={<Tags size={20} aria-hidden />} onClick={() => setAbierto(true)}>
        Categorías
      </Boton>
      <Modal abierto={abierto} titulo="Categorías" onCerrar={() => setAbierto(false)}>
        <div className="flex flex-col gap-4">
          <form onSubmit={agregar} className="flex gap-2">
            <label htmlFor="nueva-categoria" className="sr-only">
              Nueva categoría
            </label>
            <input
              id="nueva-categoria"
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              placeholder="Nueva categoría"
              maxLength={40}
              className={claseInput}
            />
            <Boton type="submit" variante="primario" disabled={pendiente || !nueva.trim()} aria-label="Agregar">
              <Plus size={20} />
            </Boton>
          </form>

          {error && <Aviso>{error}</Aviso>}

          <ul className="flex flex-col divide-y divide-suave">
            {categorias.map((c) =>
              editando?.id === c.id ? (
                <li key={c.id} className="flex items-center gap-1 py-1">
                  <label htmlFor={`cat-${c.id}`} className="sr-only">
                    Nombre de la categoría
                  </label>
                  <input
                    id={`cat-${c.id}`}
                    value={editando.nombre}
                    onChange={(e) => setEditando({ id: c.id, nombre: e.target.value })}
                    maxLength={40}
                    autoFocus
                    className={claseInput}
                  />
                  <button
                    type="button"
                    aria-label="Guardar"
                    disabled={pendiente}
                    onClick={() => ejecutar(() => renombrarCategoria(c.id, editando.nombre), () => setEditando(null))}
                    className={`${claseIcono} text-primario`}
                  >
                    <Check size={20} />
                  </button>
                  <button type="button" aria-label="Cancelar" onClick={() => setEditando(null)} className={`${claseIcono} text-texto-3`}>
                    <X size={20} />
                  </button>
                </li>
              ) : (
                <li key={c.id} className="flex items-center gap-1 py-1">
                  <span className="flex-1 font-medium">{c.nombre}</span>
                  <span className="num text-sm text-texto-3" title="Productos">
                    {c.productos}
                  </span>
                  <button
                    type="button"
                    aria-label={`Renombrar ${c.nombre}`}
                    onClick={() => setEditando({ id: c.id, nombre: c.nombre })}
                    className={`${claseIcono} text-texto-2`}
                  >
                    <Pencil size={18} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Eliminar ${c.nombre}`}
                    disabled={pendiente}
                    onClick={() => ejecutar(() => eliminarCategoria(c.id))}
                    className={`${claseIcono} text-peligro`}
                  >
                    <Trash2 size={18} />
                  </button>
                </li>
              ),
            )}
          </ul>
          {categorias.length === 0 && <p className="text-center text-sm text-texto-3">Sin categorías</p>}
        </div>
      </Modal>
    </>
  );
}
