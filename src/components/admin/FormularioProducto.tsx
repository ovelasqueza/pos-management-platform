"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { Modal } from "@/components/ui/Modal";
import { Aviso } from "@/components/ui/Aviso";
import { MiniaturaProducto } from "@/components/ui/MiniaturaProducto";
import { crearProducto, editarProducto, eliminarProducto } from "@/app/admin/[sede]/productos/acciones";
import { reducirFoto } from "@/lib/imagen";
import type { EstadoFormulario } from "@/lib/formularios";
import type { TipoSede } from "@/lib/dominio/sede";

export type ProductoEditable = {
  id: string;
  nombre: string;
  categoriaId: string | null;
  precioReferencia: number;
  precioVenta?: number;
  imagenUrl: string | null;
  activo: boolean;
};

export type OpcionCategoria = { id: string; nombre: string };

function Formulario({
  tipo,
  categorias,
  producto,
  sedeId,
  cerrar,
  onEliminar,
}: {
  tipo: TipoSede;
  categorias: OpcionCategoria[];
  producto?: ProductoEditable;
  sedeId?: string;
  cerrar: () => void;
  onEliminar?: () => void;
}) {
  const [estado, enviar, enviando] = useActionState<EstadoFormulario, FormData>(
    producto ? editarProducto : crearProducto,
    {},
  );
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(producto?.imagenUrl ?? null);
  const [quitar, setQuitar] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [errorFoto, setErrorFoto] = useState<string>();

  useEffect(() => {
    if (estado.ok) cerrar();
  }, [estado.marca, estado.ok, cerrar]);

  const c = estado.campos ?? {};

  return (
    <form action={enviar} className="flex flex-col gap-4">
      {producto ? <input type="hidden" name="id" value={producto.id} /> : <input type="hidden" name="tipo" value={tipo} />}
      {sedeId && <input type="hidden" name="sedeId" value={sedeId} />}
      {!producto && sedeId && (
        <p className="-mt-1 text-xs text-texto-3">
          El producto se creará activo en esta sede y desactivado en las demás sedes.
        </p>
      )}

      <div className="flex items-center gap-4">
        <MiniaturaProducto nombre={producto?.nombre ?? "?"} url={quitar ? null : vistaPrevia} tamano={72} />
        <div className="flex flex-col gap-1">
          <label className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-control border border-borde-activo px-4 font-medium hover:border-texto">
            <ImagePlus size={18} aria-hidden />
            Imagen
            <input
              type="file"
              name="imagen"
              accept="image/*"
              className="sr-only"
              onChange={async (e) => {
                const campo = e.currentTarget;
                const original = campo.files?.[0];
                setQuitar(false);
                setErrorFoto(undefined);
                if (!original) {
                  setVistaPrevia(producto?.imagenUrl ?? null);
                  return;
                }
                setProcesando(true);
                try {
                  // Reduce la foto (p. ej. de celular) y la deja en el campo en lugar del original
                  const reducida = await reducirFoto(original);
                  const dt = new DataTransfer();
                  dt.items.add(reducida);
                  campo.files = dt.files;
                  setVistaPrevia(URL.createObjectURL(reducida));
                } catch (err) {
                  campo.value = "";
                  setVistaPrevia(producto?.imagenUrl ?? null);
                  setErrorFoto(err instanceof Error ? err.message : "No se pudo procesar la foto");
                } finally {
                  setProcesando(false);
                }
              }}
            />
          </label>
          {producto?.imagenUrl && (
            <label className="flex items-center gap-2 text-sm text-texto-2">
              <input type="checkbox" name="quitarImagen" checked={quitar} onChange={(e) => setQuitar(e.target.checked)} className="accent-peligro" />
              Quitar imagen
            </label>
          )}
          <p className={`text-xs ${c.imagen || errorFoto ? "text-peligro" : "text-texto-3"}`}>
            {procesando ? "Preparando foto…" : (errorFoto ?? c.imagen ?? "Opcional · cualquier foto, se ajusta sola")}
          </p>
        </div>
      </div>

      <Campo etiqueta="Nombre" name="nombre" defaultValue={producto?.nombre} error={c.nombre} required autoFocus />

      <div className="flex flex-col gap-1">
        <label htmlFor="categoriaId" className="text-sm font-semibold text-texto-2">
          Categoría (opcional)
        </label>
        <select
          id="categoriaId"
          name="categoriaId"
          defaultValue={producto?.categoriaId ?? ""}
          className="min-h-12 rounded-control border border-borde-activo bg-superficie px-4 focus:border-primario focus:outline-none"
        >
          <option value="">Sin categoría</option>
          {categorias.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.nombre}
            </option>
          ))}
        </select>
      </div>

      <Campo
        etiqueta={
          sedeId
            ? "Precio de venta (esta sede)"
            : producto
              ? "Precio de referencia"
              : "Precio de venta (todas las sedes)"
        }
        name="precioReferencia"
        inputMode="numeric"
        defaultValue={producto ? (producto.precioVenta ?? producto.precioReferencia) : undefined}
        error={c.precioReferencia}
        className="num"
        required
      />

      {producto && (
        <div className="flex flex-col gap-1">
          {!sedeId && (
            <label className="flex min-h-12 items-center gap-3 text-sm font-medium">
              <input type="checkbox" name="aplicarATodas" className="size-5 accent-primario" />
              Aplicar este precio a todas las sedes
            </label>
          )}
          <label className="flex min-h-12 items-center gap-3 text-sm font-medium">
            <input type="checkbox" name="activo" defaultChecked={producto.activo} className="size-5 accent-primario" />
            {sedeId ? "Activo en esta sede (no afecta otras sedes)" : "Activo (si lo apagas, desaparece de la caja en todas las sedes)"}
          </label>
        </div>
      )}

      {estado.error && <Aviso>{estado.error}</Aviso>}
      <div className={producto ? "grid grid-cols-[auto_1fr] gap-2" : ""}>
        {producto && onEliminar && (
          <Boton variante="peligro" aria-label="Eliminar producto" onClick={onEliminar}>
            <Trash2 size={18} />
          </Boton>
        )}
        <Boton type="submit" variante="primario" className="w-full" disabled={enviando || procesando}>
          {enviando ? "Guardando…" : producto ? "Guardar" : "Crear producto"}
        </Boton>
      </div>
    </form>
  );
}

export function BotonNuevoProducto({
  tipo,
  categorias,
  sedeId,
}: {
  tipo: TipoSede;
  categorias: OpcionCategoria[];
  sedeId?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Boton variante="primario" icono={<Plus size={20} aria-hidden />} onClick={() => setAbierto(true)}>
        Producto
      </Boton>
      <Modal abierto={abierto} titulo="Nuevo producto" onCerrar={() => setAbierto(false)}>
        {abierto && <Formulario tipo={tipo} categorias={categorias} sedeId={sedeId} cerrar={() => setAbierto(false)} />}
      </Modal>
    </>
  );
}

/** Botón lápiz: edita el producto (nombre, categoría, imagen, precio ref., activo) o lo elimina. */
export function EditarProducto({
  tipo,
  producto,
  categorias,
  sedeId,
}: {
  tipo: TipoSede;
  producto: ProductoEditable;
  categorias: OpcionCategoria[];
  sedeId?: string;
}) {
  const [modal, setModal] = useState<"editar" | "eliminar" | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string>();
  const cerrar = () => {
    setModal(null);
    setError(undefined);
  };

  return (
    <>
      <button
        type="button"
        aria-label={`Editar ${producto.nombre}`}
        onClick={() => setModal("editar")}
        className="flex size-12 items-center justify-center rounded-control text-texto-2 hover:bg-suave"
      >
        <Pencil size={18} />
      </button>

      <Modal abierto={modal === "editar"} titulo="Editar producto" onCerrar={cerrar}>
        {modal === "editar" && (
          <Formulario
            tipo={tipo}
            categorias={categorias}
            producto={producto}
            sedeId={sedeId}
            cerrar={cerrar}
            onEliminar={() => setModal("eliminar")}
          />
        )}
      </Modal>

      <Modal abierto={modal === "eliminar"} titulo="Eliminar producto" onCerrar={cerrar} ancho="sm">
        <div className="flex flex-col gap-4">
          <p>
            ¿Eliminar <strong>{producto.nombre}</strong> de todas las sedes?
          </p>
          {error && <Aviso>{error}</Aviso>}
          <div className="grid grid-cols-2 gap-2">
            <Boton onClick={() => setModal("editar")}>Volver</Boton>
            <Boton
              variante="peligro"
              disabled={pendiente}
              onClick={() =>
                iniciar(async () => {
                  const r = await eliminarProducto(producto.id);
                  if (r.error) setError(r.error);
                  else cerrar();
                })
              }
            >
              Eliminar
            </Boton>
          </div>
        </div>
      </Modal>
    </>
  );
}
