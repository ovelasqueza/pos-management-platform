"use client";

import { useMemo, useState, useTransition, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CircleCheck,
  FileSpreadsheet,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/browser";
import { formatearPesos } from "@/lib/dominio/dinero";
import { formatearFecha, formatearFechaHora, hoyBogota } from "@/lib/dominio/fechas";
import { normalizarTexto } from "@/lib/dominio/producto";
import { esCodigo, esErrorDeRed, mensajeDeError } from "@/lib/dominio/errores";
import {
  agruparLineas,
  armarCsvInventario,
  calcularTotales,
  cantidadConUnidad,
  esArticulo,
  lineaDesdeBD,
  nombreArchivoCsv,
  type LineaInventario,
} from "@/lib/dominio/inventario";
import {
  actualizarCostos,
  borrarInventario,
  editarDatosInventario,
  finalizarInventario,
  reabrirInventario,
} from "@/app/admin/[sede]/inventario/acciones";
import { Boton } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { Modal } from "@/components/ui/Modal";
import { Aviso } from "@/components/ui/Aviso";
import { useCampoCantidad, type ResultadoGuardado } from "./CampoCantidad";

export type Candidato = { tipo: "producto" | "articulo"; id: string; nombre: string; detalle: string };

type Props = {
  inventario: {
    id: string;
    fecha: string;
    nota: string | null;
    estado: "en_curso" | "finalizado";
    modificadoEn: string;
    modificadoPor: string | null;
    finalizadoEn: string | null;
    finalizadoPor: string | null;
  };
  sede: { id: string; nombre: string; nit: string | null; activa: boolean };
  lineasIniciales: LineaInventario[];
  candidatos: Candidato[];
  usuario: string;
};

type Confirmacion = { titulo: string; texto: string; boton: string; peligro?: boolean; accion: () => Promise<void> };

const LIMITE_ESPERA = 8000;

export function DetalleInventario({ inventario, sede, lineasIniciales, candidatos, usuario }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => crearClienteNavegador(), []);
  const [lineas, setLineas] = useState(lineasIniciales);
  const [ultimo, setUltimo] = useState({ por: inventario.modificadoPor, en: inventario.modificadoEn });
  const [busqueda, setBusqueda] = useState("");
  const [aviso, setAviso] = useState<string>();
  const [confirmar, setConfirmar] = useState<Confirmacion | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [editandoDatos, setEditandoDatos] = useState(false);
  const [pendiente, iniciar] = useTransition();

  const enCurso = inventario.estado === "en_curso";
  const editable = enCurso && sede.activa;
  const totales = calcularTotales(lineas);
  const listaInventarios = `/admin/${sede.id}/inventario`;

  const grupos = useMemo(() => {
    const q = normalizarTexto(busqueda);
    return agruparLineas(q ? lineas.filter((l) => normalizarTexto(l.nombre).includes(q)) : lineas);
  }, [lineas, busqueda]);

  const marcarCambio = () => setUltimo({ por: usuario, en: new Date().toISOString() });

  /** Error de negocio que deja la pantalla desactualizada (finalizado, sede inactiva…): avisar y recargar. */
  function errorDeEstado(error: { message?: string }) {
    setAviso(mensajeDeError(error));
    router.refresh();
  }

  // ── Cantidad (guardado automático) ──
  const guardarCantidad = (id: string) => async (cantidad: number): Promise<ResultadoGuardado> => {
    const { data, error } = await supabase
      .rpc("inv_cantidad", { p_linea: id, p_cantidad: cantidad })
      .abortSignal(AbortSignal.timeout(LIMITE_ESPERA));
    if (error) {
      if (esCodigo(error, "CANTIDAD_INVALIDA")) return "invalido";
      if (!esErrorDeRed(error) && !/abort/i.test(error.message)) errorDeEstado(error);
      return "red";
    }
    const nueva = lineaDesdeBD(data);
    setLineas((ls) => ls.map((l) => (l.id === id ? nueva : l)));
    marcarCambio();
    return "ok";
  };

  // ── Agregar y quitar ──
  async function agregar(c: Candidato) {
    setAviso(undefined);
    const { data, error } = await supabase.rpc("inv_agregar", {
      p_inventario: inventario.id,
      p_producto: c.tipo === "producto" ? c.id : null,
      p_articulo: c.tipo === "articulo" ? c.id : null,
    });
    setAgregando(false);
    if (error) return errorDeEstado(error);
    setLineas((ls) => [...ls, lineaDesdeBD(data)]);
    marcarCambio();
  }

  function pedirQuitar(l: LineaInventario) {
    setConfirmar({
      titulo: "Quitar línea",
      texto: `¿Quitar ${l.nombre} de este inventario?`,
      boton: "Quitar",
      peligro: true,
      accion: async () => {
        const { error } = await supabase.rpc("inv_quitar", { p_linea: l.id });
        if (error) return errorDeEstado(error);
        setLineas((ls) => ls.filter((x) => x.id !== l.id));
        marcarCambio();
      },
    });
  }

  // ── Acciones del inventario (Server Actions + recarga) ──
  function accion(fn: () => Promise<{ error?: string }>, despues?: () => void) {
    return async () => {
      const r = await fn();
      if (r.error) return setAviso(r.error);
      setAviso(undefined);
      if (despues) despues();
      else router.refresh();
    };
  }

  const pedirActualizarCostos = () =>
    setConfirmar({
      titulo: "Actualizar costos",
      texto: "Todas las líneas tomarán el costo actual de Productos y Materias primas.",
      boton: "Actualizar",
      accion: accion(() => actualizarCostos(inventario.id)),
    });

  const pedirFinalizar = () =>
    setConfirmar({
      titulo: "Finalizar inventario",
      texto:
        totales.sinCosto > 0
          ? `Hay ${totales.sinCosto} línea(s) sin costo que no suman al total. ¿Finalizar de todas formas?`
          : "Quedará de solo lectura. Podrás editarlo después si hace falta.",
      boton: "Finalizar",
      accion: accion(() => finalizarInventario(inventario.id)),
    });

  const pedirReabrir = () =>
    setConfirmar({
      titulo: "Editar inventario finalizado",
      texto: "Volverá a quedar En curso hasta que lo finalices otra vez.",
      boton: "Editar",
      accion: accion(() => reabrirInventario(inventario.id)),
    });

  const pedirBorrar = () =>
    setConfirmar({
      titulo: "Borrar inventario",
      texto: `Se borrará el inventario del ${formatearFecha(inventario.fecha)} con todas sus cantidades.`,
      boton: "Borrar",
      peligro: true,
      accion: accion(() => borrarInventario(inventario.id), () => router.push(listaInventarios)),
    });

  function descargarCsv() {
    const csv = armarCsvInventario({
      sede: sede.nombre,
      nit: sede.nit,
      fecha: inventario.fecha,
      estado: inventario.estado,
      nota: inventario.nota,
      lineas,
    });
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = nombreArchivoCsv(sede.nombre, inventario.fecha);
    a.click();
    URL.revokeObjectURL(url);
  }

  const yaIncluidos = new Set(lineas.map((l) => l.productoId ?? l.articuloId));

  return (
    <section className="flex flex-col gap-4">
      {/* Cabecera */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link href={listaInventarios} className="inline-flex w-fit items-center gap-1 text-sm text-texto-3 hover:text-texto">
            <ArrowLeft size={16} aria-hidden />
            Inventarios
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold capitalize">{formatearFecha(inventario.fecha)}</h1>
            <Estado enCurso={enCurso} />
            {editable && (
              <button
                type="button"
                onClick={() => setEditandoDatos(true)}
                aria-label="Cambiar fecha o nota"
                className="flex size-10 items-center justify-center rounded-control text-texto-3 hover:bg-suave"
              >
                <Pencil size={16} />
              </button>
            )}
          </div>
          <p className="text-sm text-texto-3">
            {sede.nombre}
            {inventario.nota && <> · {inventario.nota}</>}
          </p>
        </div>
        <Boton icono={<FileSpreadsheet size={20} aria-hidden />} onClick={descargarCsv}>
          Excel
        </Boton>
      </div>

      {/* Totales */}
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-tarjeta border border-borde bg-superficie p-4">
        <div>
          <p className="text-sm font-semibold text-texto-3">Total</p>
          <p className={`num text-[40px] leading-tight font-bold ${totales.sinCosto ? "text-advertencia" : ""}`}>
            {formatearPesos(totales.total)}
          </p>
          {totales.sinCosto > 0 && (
            <p className="flex items-center gap-1 text-sm font-medium text-advertencia">
              <TriangleAlert size={16} aria-hidden />
              {totales.sinCosto} sin costo (no suman)
            </p>
          )}
        </div>
        <dl className="flex gap-6 text-sm">
          <div>
            <dt className="text-texto-3">Productos</dt>
            <dd className="num font-semibold">{formatearPesos(totales.productos)}</dd>
          </div>
          <div>
            <dt className="text-texto-3">Materias primas</dt>
            <dd className="num font-semibold">{formatearPesos(totales.articulos)}</dd>
          </div>
        </dl>
      </div>

      <p className="flex flex-wrap items-center gap-x-2 text-xs text-texto-3">
        {ultimo.por && <span>Últ. cambio: {ultimo.por} · {formatearFechaHora(ultimo.en)}</span>}
        {!enCurso && inventario.finalizadoEn && (
          <>
            <span>· Finalizado por {inventario.finalizadoPor ?? "—"} · {formatearFechaHora(inventario.finalizadoEn)}</span>
            {sede.activa && (
              <button type="button" onClick={pedirReabrir} className="min-h-8 px-1 text-texto-3 underline hover:text-texto">
                Editar
              </button>
            )}
          </>
        )}
      </p>

      {!sede.activa && <Aviso tipo="advertencia">Sede inactiva: este inventario es solo de consulta</Aviso>}
      {aviso && <Aviso>{aviso}</Aviso>}

      {/* Herramientas */}
      <div className="flex flex-wrap gap-2">
        <label className="relative w-full max-w-sm">
          <span className="sr-only">Buscar en el inventario</span>
          <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texto-3" aria-hidden />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar"
            className="min-h-12 w-full rounded-control border border-borde-activo bg-superficie pr-4 pl-10 focus:border-primario focus:outline-none"
          />
        </label>
        {editable && (
          <>
            <Boton
              variante="fantasma"
              icono={<Plus size={20} aria-hidden />}
              onClick={() => setAgregando(true)}
              title="Lo nuevo entra solo. Úsalo para traer algo que quitaste o que la sede no vende"
            >
              Agregar otro
            </Boton>
            <Boton icono={<RefreshCw size={18} aria-hidden />} onClick={pedirActualizarCostos}>
              Actualizar costos
            </Boton>
          </>
        )}
      </div>

      <Grupo titulo="Productos" lineas={grupos.productos} editable={editable} guardar={guardarCantidad} quitar={pedirQuitar} />
      <Grupo titulo="Materias primas" lineas={grupos.articulos} editable={editable} guardar={guardarCantidad} quitar={pedirQuitar} />

      {editable && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-borde pt-4">
          <button type="button" onClick={pedirBorrar} className="inline-flex min-h-12 items-center gap-2 px-2 text-sm text-peligro hover:underline">
            <Trash2 size={16} aria-hidden />
            Borrar inventario
          </button>
          <Boton variante="primario" tamano="lg" icono={<CircleCheck size={22} aria-hidden />} onClick={pedirFinalizar}>
            Finalizar
          </Boton>
        </div>
      )}

      {/* Agregar producto o materia prima */}
      <Modal abierto={agregando} titulo="Agregar al inventario" onCerrar={() => setAgregando(false)}>
        {agregando && (
          <ListaCandidatos candidatos={candidatos.filter((c) => !yaIncluidos.has(c.id))} onEscoger={agregar} sedeId={sede.id} />
        )}
      </Modal>

      {/* Fecha y nota */}
      <Modal abierto={editandoDatos} titulo="Fecha y nota" onCerrar={() => setEditandoDatos(false)} ancho="sm">
        {editandoDatos && (
          <FormDatos
            fecha={inventario.fecha}
            nota={inventario.nota}
            onGuardar={async (fecha, nota) => {
              const r = await editarDatosInventario(inventario.id, fecha, nota);
              if (!r.error) {
                setEditandoDatos(false);
                router.refresh();
              }
              return r.error;
            }}
          />
        )}
      </Modal>

      {/* Confirmación */}
      <Modal abierto={confirmar !== null} titulo={confirmar?.titulo ?? ""} onCerrar={() => setConfirmar(null)} ancho="sm">
        {confirmar && (
          <div className="flex flex-col gap-4">
            <p>{confirmar.texto}</p>
            <div className="grid grid-cols-2 gap-2">
              <Boton onClick={() => setConfirmar(null)}>Cancelar</Boton>
              <Boton
                variante={confirmar.peligro ? "peligro" : "primario"}
                disabled={pendiente}
                onClick={() =>
                  iniciar(async () => {
                    await confirmar.accion();
                    setConfirmar(null);
                  })
                }
              >
                {pendiente ? "…" : confirmar.boton}
              </Boton>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}

function Estado({ enCurso }: { enCurso: boolean }) {
  return enCurso ? (
    <span className="rounded-control bg-advertencia-suave px-2 py-0.5 text-xs font-semibold text-advertencia">En curso</span>
  ) : (
    <span className="rounded-control bg-exito-suave px-2 py-0.5 text-xs font-semibold text-primario-activo">Finalizado</span>
  );
}

function Grupo({
  titulo,
  lineas,
  editable,
  guardar,
  quitar,
}: {
  titulo: string;
  lineas: LineaInventario[];
  editable: boolean;
  guardar: (id: string) => (v: number) => Promise<ResultadoGuardado>;
  quitar: (l: LineaInventario) => void;
}) {
  if (lineas.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-tarjeta border border-borde bg-superficie">
      <table className="w-full text-left">
        <thead className="border-b border-borde text-sm text-texto-3">
          <tr>
            <th className="px-4 py-3 font-semibold text-texto">
              {titulo} <span className="num font-normal text-texto-3">({lineas.length})</span>
            </th>
            <th className="px-4 py-3 text-right font-medium">Cantidad</th>
            <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">Costo</th>
            <th className="px-4 py-3 text-right font-medium">Valor</th>
            {editable && <th className="w-12" />}
          </tr>
        </thead>
        <tbody>
          {lineas.map((l) =>
            editable ? (
              <FilaEditable key={l.id} linea={l} guardar={guardar(l.id)} quitar={() => quitar(l)} />
            ) : (
              <tr key={l.id} className="border-b border-suave align-top last:border-0">
                <td className="px-4 py-4">
                  <Nombre linea={l} />
                </td>
                <td className="px-4 py-1 text-right">
                  <span className="num inline-block py-3">{cantidadConUnidad(l.cantidad, l.unidad)}</span>
                </td>
                <Costo linea={l} />
                <Valor linea={l} />
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

function Nombre({ linea: l }: { linea: LineaInventario }) {
  return (
    <div>
      <p className="font-medium">{l.nombre}</p>
      {esArticulo(l) && <p className="text-xs text-texto-3 capitalize">{l.unidad}</p>}
    </div>
  );
}

const Costo = ({ linea: l }: { linea: LineaInventario }) => (
  <td className="num hidden px-4 py-4 text-right text-texto-2 sm:table-cell">{l.costo === null ? "—" : formatearPesos(l.costo)}</td>
);

const Valor = ({ linea: l }: { linea: LineaInventario }) => (
  <td className="num px-4 py-4 text-right">
    {l.costo === null ? (
      <span className="inline-flex items-center gap-1 text-sm text-advertencia">
        <TriangleAlert size={14} aria-hidden />
        sin costo
      </span>
    ) : (
      formatearPesos(l.valor ?? Math.round(l.cantidad * l.costo))
    )}
  </td>
);

/** Fila para contar: nombre con "+ adicionar" al lado (debajo en pantallas angostas) y la cantidad en su columna. */
function FilaEditable({
  linea: l,
  guardar,
  quitar,
}: {
  linea: LineaInventario;
  guardar: (v: number) => Promise<ResultadoGuardado>;
  quitar: () => void;
}) {
  const { cantidad, adicionar } = useCampoCantidad({
    etiqueta: `Cantidad de ${l.nombre}`,
    valor: l.cantidad,
    unidad: l.unidad,
    soloEnteros: !esArticulo(l),
    guardar,
  });
  return (
    <tr className="border-b border-suave align-top last:border-0">
      <td className="px-4 py-1">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-1">
          <div className="pt-2">
            <Nombre linea={l} />
          </div>
          {adicionar}
        </div>
      </td>
      <td className="px-4 py-1 text-right">{cantidad}</td>
      <Costo linea={l} />
      <Valor linea={l} />
      <td className="px-1 py-1">
        <button
          type="button"
          aria-label={`Quitar ${l.nombre}`}
          onClick={quitar}
          className="flex size-12 items-center justify-center rounded-control text-texto-3 hover:bg-peligro-suave hover:text-peligro"
        >
          <Trash2 size={18} />
        </button>
      </td>
    </tr>
  );
}

function ListaCandidatos({
  candidatos,
  onEscoger,
  sedeId,
}: {
  candidatos: Candidato[];
  onEscoger: (c: Candidato) => Promise<void>;
  sedeId: string;
}) {
  const [q, setQ] = useState("");
  const [pendiente, iniciar] = useTransition();
  const visibles = useMemo(() => {
    const n = normalizarTexto(q);
    return (n ? candidatos.filter((c) => normalizarTexto(c.nombre).includes(n)) : candidatos).slice(0, 60);
  }, [candidatos, q]);

  return (
    <div className="flex flex-col gap-3">
      <Campo etiqueta="Buscar producto o materia prima" etiquetaOculta value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" autoFocus icono={<Search size={18} aria-hidden />} />
      <ul className="barra-fina flex max-h-[50vh] flex-col divide-y divide-suave overflow-y-auto">
        {visibles.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              disabled={pendiente}
              onClick={() => iniciar(() => onEscoger(c))}
              className="flex min-h-12 w-full items-center justify-between gap-3 px-2 text-left hover:bg-suave disabled:opacity-60"
            >
              <span className="font-medium">{c.nombre}</span>
              <span className="shrink-0 text-xs text-texto-3">{c.detalle}</span>
            </button>
          </li>
        ))}
      </ul>
      {visibles.length === 0 && <p className="text-center text-sm text-texto-3">{candidatos.length ? "Sin resultados" : "Ya está todo en la lista"}</p>}
      <Link href={`/admin/${sedeId}/inventario/articulos`} className="text-center text-sm text-texto-3 underline">
        ¿No está? Crear materia prima
      </Link>
    </div>
  );
}

function FormDatos({
  fecha,
  nota,
  onGuardar,
}: {
  fecha: string;
  nota: string | null;
  onGuardar: (fecha: string, nota: string) => Promise<string | undefined>;
}): ReactNode {
  const [error, setError] = useState<string>();
  const [pendiente, iniciar] = useTransition();
  const hoy = hoyBogota();

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    iniciar(async () => setError(await onGuardar(String(f.get("fecha") ?? ""), String(f.get("nota") ?? ""))));
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <Campo etiqueta="Fecha del conteo" name="fecha" type="date" defaultValue={fecha} max={hoy} required className="num" />
      <Campo etiqueta="Nota (opcional)" name="nota" defaultValue={nota ?? ""} maxLength={120} />
      {error && <Aviso>{error}</Aviso>}
      <Boton type="submit" variante="primario" disabled={pendiente}>
        {pendiente ? "Guardando…" : "Guardar"}
      </Boton>
    </form>
  );
}
