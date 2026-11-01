"use client";

import { useState, useTransition } from "react";
import { Equal, Minus, Plus } from "lucide-react";
import { formatearPesos, leerPesos } from "@/lib/dominio/dinero";
import { METODOS, type MetodoPago } from "@/lib/dominio/cobro";
import type { SaldoCajaMayor } from "@/lib/dominio/cajaMayor";
import { moverCajaMayor, type Operacion } from "@/app/admin/[sede]/caja-mayor/acciones";
import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { Modal } from "@/components/ui/Modal";
import { Aviso } from "@/components/ui/Aviso";
import { Opciones } from "@/components/ui/Opciones";

const TITULO: Record<Operacion, string> = { sumar: "Sumar a caja mayor", quitar: "Quitar de caja mayor", fijar: "Fijar saldo" };

/** Tarjetas de saldo y botones Sumar / Quitar / Fijar (solo admin). */
export function PanelCajaMayor({ sedeId, saldo }: { sedeId: string; saldo: SaldoCajaMayor }) {
  const [operacion, setOperacion] = useState<Operacion | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {METODOS.map((m) => (
          <div key={m.valor} className="rounded-tarjeta border border-borde bg-superficie px-4 py-3">
            <dt className="text-sm text-texto-3">{m.nombre}</dt>
            <dd className="num text-2xl font-bold">{formatearPesos(saldo[m.valor])}</dd>
          </div>
        ))}
        <div className="rounded-tarjeta border-2 border-primario bg-exito-suave px-4 py-3 text-primario-activo">
          <dt className="text-sm font-semibold">Total</dt>
          <dd className="num text-2xl font-bold">{formatearPesos(saldo.total)}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-2">
        <Boton variante="primario" icono={<Plus size={18} aria-hidden />} onClick={() => setOperacion("sumar")}>
          Sumar
        </Boton>
        <Boton icono={<Minus size={18} aria-hidden />} onClick={() => setOperacion("quitar")}>
          Quitar
        </Boton>
        <Boton variante="fantasma" icono={<Equal size={18} aria-hidden />} onClick={() => setOperacion("fijar")}>
          Fijar saldo
        </Boton>
      </div>
      {operacion && <FormularioMovimiento sedeId={sedeId} saldo={saldo} operacion={operacion} cerrar={() => setOperacion(null)} />}
    </div>
  );
}

function FormularioMovimiento({
  sedeId,
  saldo,
  operacion,
  cerrar,
}: {
  sedeId: string;
  saldo: SaldoCajaMayor;
  operacion: Operacion;
  cerrar: () => void;
}) {
  const [parte, setParte] = useState<MetodoPago>("efectivo");
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState(operacion === "fijar" ? "Saldo inicial" : "");
  const [errores, setErrores] = useState<{ monto?: string; descripcion?: string; general?: string }>({});
  const [pendiente, iniciar] = useTransition();

  function guardar() {
    const valor = leerPesos(monto, operacion === "fijar" ? 0 : 1);
    const nuevos: typeof errores = {};
    if (valor === null) nuevos.monto = operacion === "fijar" ? "Escribe el saldo (puede ser 0)" : "Monto mayor que 0";
    else if (operacion === "quitar" && valor > saldo[parte]) nuevos.monto = "No hay suficiente en esa parte";
    if (!descripcion.trim()) nuevos.descripcion = "Escribe una descripción";
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0 || valor === null) return;

    iniciar(async () => {
      const r = await moverCajaMayor({ sedeId, parte, operacion, monto: valor, descripcion });
      if (r.error) setErrores(r.campo ? { [r.campo]: r.error } : { general: r.error });
      else cerrar();
    });
  }

  return (
    <Modal abierto titulo={TITULO[operacion]} onCerrar={cerrar} ancho="sm">
      <div className="flex flex-col gap-4">
        <Opciones etiqueta="Parte" opciones={METODOS} valor={parte} onCambiar={setParte} />
        <p className="-mt-2 text-sm text-texto-3">
          Saldo actual: <span className="num font-semibold text-texto">{formatearPesos(saldo[parte])}</span>
        </p>
        <Campo
          etiqueta={operacion === "fijar" ? "Nuevo saldo" : "Monto"}
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          icono={<span className="num text-base font-semibold text-texto-2">$</span>}
          value={monto}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 9);
            setMonto(d ? new Intl.NumberFormat("es-CO").format(Number(d)) : "");
          }}
          error={errores.monto}
          className="num text-right text-lg font-semibold"
          autoFocus
        />
        <Campo
          etiqueta="Descripción"
          placeholder={operacion === "quitar" ? "Ej: consignación banco" : "Ej: saldo inicial"}
          maxLength={120}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          error={errores.descripcion}
        />
        {errores.general && <Aviso>{errores.general}</Aviso>}
        <div className="grid grid-cols-2 gap-2">
          <Boton onClick={cerrar} disabled={pendiente}>
            Cancelar
          </Boton>
          <Boton variante={operacion === "quitar" ? "peligro" : "primario"} onClick={guardar} disabled={pendiente}>
            {pendiente ? "Guardando…" : "Guardar"}
          </Boton>
        </div>
      </div>
    </Modal>
  );
}
