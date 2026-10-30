"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { Modal } from "@/components/ui/Modal";
import { Aviso } from "@/components/ui/Aviso";
import { crearSede, editarSede } from "@/app/admin/acciones-sedes";
import { TIPOS_SEDE, nombreTipo, type TipoSede } from "@/lib/dominio/sede";
import type { EstadoFormulario } from "@/lib/formularios";

type SedeEditable = {
  id: string;
  nombre: string;
  tipo: TipoSede;
  direccion: string | null;
  telefono: string | null;
};

function Formulario({ sede, onListo }: { sede?: SedeEditable; onListo: () => void }) {
  const [estado, enviar, enviando] = useActionState<EstadoFormulario, FormData>(
    sede ? editarSede : crearSede,
    {},
  );

  useEffect(() => {
    if (estado.ok) onListo();
  }, [estado.marca, estado.ok, onListo]);

  const c = estado.campos ?? {};

  return (
    <form action={enviar} className="flex flex-col gap-4">
      {sede && <input type="hidden" name="id" value={sede.id} />}
      <Campo etiqueta="Nombre" name="nombre" defaultValue={sede?.nombre} error={c.nombre} required autoFocus />

      {sede ? (
        <p className="text-sm text-texto-3">
          Tipo: <strong className="text-texto">{nombreTipo(sede.tipo)}</strong> (no se puede cambiar)
        </p>
      ) : (
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-semibold text-texto-2">Tipo</legend>
          <div className="grid grid-cols-2 gap-2">
            {TIPOS_SEDE.map((t) => (
              <label
                key={t.valor}
                className="flex min-h-12 cursor-pointer items-center justify-center rounded-control border border-borde-activo font-medium has-checked:border-primario has-checked:bg-exito-suave has-checked:text-primario-activo"
              >
                <input type="radio" name="tipo" value={t.valor} className="sr-only" required />
                {t.nombre}
              </label>
            ))}
          </div>
          {c.tipo && <p className="text-sm text-peligro">{c.tipo}</p>}
        </fieldset>
      )}

      <Campo etiqueta="Dirección (opcional)" name="direccion" defaultValue={sede?.direccion ?? ""} error={c.direccion} />
      <Campo etiqueta="Teléfono (opcional)" name="telefono" type="tel" defaultValue={sede?.telefono ?? ""} error={c.telefono} />
      {estado.error && <Aviso>{estado.error}</Aviso>}

      <Boton type="submit" variante="primario" disabled={enviando}>
        {enviando ? "Guardando…" : sede ? "Guardar" : "Crear sede"}
      </Boton>
    </form>
  );
}

export function BotonNuevaSede() {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Boton variante="primario" icono={<Plus size={20} aria-hidden />} onClick={() => setAbierto(true)}>
        Sede
      </Boton>
      <Modal abierto={abierto} titulo="Nueva sede" onCerrar={() => setAbierto(false)}>
        {abierto && <Formulario onListo={() => setAbierto(false)} />}
      </Modal>
    </>
  );
}

export function BotonEditarSede({ sede }: { sede: SedeEditable }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={`Editar ${sede.nombre}`}
        onClick={() => setAbierto(true)}
        className="flex size-12 items-center justify-center rounded-control text-texto-2 hover:bg-suave"
      >
        <Pencil size={18} />
      </button>
      <Modal abierto={abierto} titulo="Editar sede" onCerrar={() => setAbierto(false)}>
        {abierto && <Formulario sede={sede} onListo={() => setAbierto(false)} />}
      </Modal>
    </>
  );
}
