"use client";

import { useActionState, useEffect, useState } from "react";
import { KeyRound, Pencil, Plus } from "lucide-react";
import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { Modal } from "@/components/ui/Modal";
import { Aviso } from "@/components/ui/Aviso";
import { crearUsuario, editarUsuario, restablecerContrasena } from "@/app/admin/[sede]/usuarios/acciones";
import type { EstadoFormulario } from "@/lib/formularios";

export type UsuarioFila = {
  id: string;
  nombreCompleto: string;
  nombreUsuario: string;
  rol: "cajero" | "admin";
  sedeId: string | null;
  activo: boolean;
};

type OpcionSede = { id: string; nombre: string; activa: boolean };

function useCerrarAlGuardar(estado: EstadoFormulario, cerrar: () => void) {
  useEffect(() => {
    if (estado.ok) cerrar();
  }, [estado.marca, estado.ok, cerrar]);
}

function CamposRolSede({
  sedes,
  rolInicial,
  sedeInicial,
  errores,
}: {
  sedes: OpcionSede[];
  rolInicial: "cajero" | "admin";
  sedeInicial: string | null;
  errores: Record<string, string>;
}) {
  const [rol, setRol] = useState(rolInicial);

  return (
    <>
      <fieldset>
        <legend className="mb-1 text-sm font-semibold text-texto-2">Rol</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["cajero", "admin"] as const).map((r) => (
            <label
              key={r}
              className="flex min-h-12 cursor-pointer items-center justify-center rounded-control border border-borde-activo font-medium has-checked:border-primario has-checked:bg-exito-suave has-checked:text-primario-activo"
            >
              <input
                type="radio"
                name="rol"
                value={r}
                checked={rol === r}
                onChange={() => setRol(r)}
                className="sr-only"
              />
              {r === "cajero" ? "Cajero" : "Administrador"}
            </label>
          ))}
        </div>
      </fieldset>

      {rol === "cajero" && (
        <div className="flex flex-col gap-1">
          <label htmlFor="sedeId" className="text-sm font-semibold text-texto-2">
            Sede
          </label>
          <select
            id="sedeId"
            name="sedeId"
            defaultValue={sedeInicial ?? ""}
            required
            aria-invalid={errores.sedeId ? true : undefined}
            className="min-h-12 rounded-control border border-borde-activo bg-superficie px-4 focus:border-primario focus:outline-none"
          >
            <option value="" disabled>
              Escoge una sede
            </option>
            {sedes
              .filter((s) => s.activa || s.id === sedeInicial)
              .map((s) => (
                <option key={s.id} value={s.id} disabled={!s.activa}>
                  {s.nombre}
                  {s.activa ? "" : " (inactiva)"}
                </option>
              ))}
          </select>
          {errores.sedeId && <p className="text-sm text-peligro">{errores.sedeId}</p>}
        </div>
      )}
    </>
  );
}

function FormCrear({ sedes, sedeInicial, cerrar }: { sedes: OpcionSede[]; sedeInicial: string | null; cerrar: () => void }) {
  const [estado, enviar, enviando] = useActionState<EstadoFormulario, FormData>(crearUsuario, {});
  useCerrarAlGuardar(estado, cerrar);
  const c = estado.campos ?? {};

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <Campo etiqueta="Nombre completo" name="nombreCompleto" error={c.nombreCompleto} required autoFocus />
      <Campo
        etiqueta="Usuario"
        name="nombreUsuario"
        autoCapitalize="none"
        spellCheck={false}
        error={c.nombreUsuario}
        required
      />
      <Campo etiqueta="Contraseña" name="contrasena" type="password" autoComplete="new-password" error={c.contrasena} required minLength={8} />
      <CamposRolSede sedes={sedes} rolInicial="cajero" sedeInicial={sedeInicial} errores={c} />
      {estado.error && <Aviso>{estado.error}</Aviso>}
      <Boton type="submit" variante="primario" disabled={enviando}>
        {enviando ? "Creando…" : "Crear usuario"}
      </Boton>
    </form>
  );
}

function FormEditar({ usuario, sedes, cerrar }: { usuario: UsuarioFila; sedes: OpcionSede[]; cerrar: () => void }) {
  const [estado, enviar, enviando] = useActionState<EstadoFormulario, FormData>(editarUsuario, {});
  useCerrarAlGuardar(estado, cerrar);
  const c = estado.campos ?? {};

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={usuario.id} />
      <p className="text-sm text-texto-3">
        Usuario: <strong className="num text-texto">{usuario.nombreUsuario}</strong>
      </p>
      <Campo etiqueta="Nombre completo" name="nombreCompleto" defaultValue={usuario.nombreCompleto} error={c.nombreCompleto} required />
      <CamposRolSede sedes={sedes} rolInicial={usuario.rol} sedeInicial={usuario.sedeId} errores={c} />
      <label className="flex min-h-12 items-center gap-3 font-medium">
        <input type="checkbox" name="activo" defaultChecked={usuario.activo} className="size-5 accent-primario" />
        Activo
      </label>
      {estado.error && <Aviso>{estado.error}</Aviso>}
      <Boton type="submit" variante="primario" disabled={enviando}>
        {enviando ? "Guardando…" : "Guardar"}
      </Boton>
    </form>
  );
}

function FormContrasena({ usuario, cerrar }: { usuario: UsuarioFila; cerrar: () => void }) {
  const [estado, enviar, enviando] = useActionState<EstadoFormulario, FormData>(restablecerContrasena, {});
  useCerrarAlGuardar(estado, cerrar);

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={usuario.id} />
      <p className="text-sm text-texto-3">
        Nueva contraseña para <strong className="text-texto">{usuario.nombreCompleto}</strong>
      </p>
      <Campo
        etiqueta="Nueva contraseña"
        name="contrasena"
        type="password"
        autoComplete="new-password"
        minLength={8}
        error={estado.campos?.contrasena}
        required
        autoFocus
      />
      {estado.error && <Aviso>{estado.error}</Aviso>}
      <Boton type="submit" variante="primario" disabled={enviando}>
        {enviando ? "Guardando…" : "Cambiar contraseña"}
      </Boton>
    </form>
  );
}

export function BotonNuevoUsuario({ sedes, sedeInicial }: { sedes: OpcionSede[]; sedeInicial: string | null }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Boton variante="primario" icono={<Plus size={20} aria-hidden />} onClick={() => setAbierto(true)}>
        Usuario
      </Boton>
      <Modal abierto={abierto} titulo="Nuevo usuario" onCerrar={() => setAbierto(false)}>
        {abierto && <FormCrear sedes={sedes} sedeInicial={sedeInicial} cerrar={() => setAbierto(false)} />}
      </Modal>
    </>
  );
}

export function AccionesUsuario({ usuario, sedes }: { usuario: UsuarioFila; sedes: OpcionSede[] }) {
  const [modal, setModal] = useState<"editar" | "clave" | null>(null);
  const cerrar = () => setModal(null);

  return (
    <div className="flex justify-end">
      <button
        type="button"
        aria-label={`Cambiar contraseña de ${usuario.nombreCompleto}`}
        onClick={() => setModal("clave")}
        className="flex size-12 items-center justify-center rounded-control text-texto-2 hover:bg-suave"
      >
        <KeyRound size={18} />
      </button>
      <button
        type="button"
        aria-label={`Editar ${usuario.nombreCompleto}`}
        onClick={() => setModal("editar")}
        className="flex size-12 items-center justify-center rounded-control text-texto-2 hover:bg-suave"
      >
        <Pencil size={18} />
      </button>
      <Modal abierto={modal === "editar"} titulo="Editar usuario" onCerrar={cerrar}>
        {modal === "editar" && <FormEditar usuario={usuario} sedes={sedes} cerrar={cerrar} />}
      </Modal>
      <Modal abierto={modal === "clave"} titulo="Contraseña" onCerrar={cerrar} ancho="sm">
        {modal === "clave" && <FormContrasena usuario={usuario} cerrar={cerrar} />}
      </Modal>
    </div>
  );
}
