import type { MetodoPago } from "./cobro";

/** Datos que devuelve la BD para imprimir (ver privado.ticket y privado.armar_reporte). */

/** `nit` solo viene en el ticket (script 12); el reporte de turno no lo trae. */
type DatosSede = { nombre: string; nit?: string | null; direccion: string | null; telefono: string | null };

export type DatosTicket = {
  venta_id: string;
  numero: number;
  fecha: string;
  sede: DatosSede;
  cajero: string;
  metodo: MetodoPago;
  total: number;
  recibido: number | null;
  cambio: number | null;
  /** Ventas antes del script 09 no lo traen: se asume Consumidor Final */
  cliente?: { tipo: string; documento: string; nombre: string };
  lineas: { nombre: string; cantidad: number; precio: number; subtotal: number }[];
};

export type DatosReporte = {
  turno_id: string;
  sede: DatosSede;
  cajero: string;
  abierto_en: string;
  cerrado_en: string;
  cerrado_por_admin: string | null;
  base: number;
  ventas_cantidad: number;
  ventas_total: number;
  por_metodo: Record<MetodoPago, number>;
  gastos: { descripcion: string; monto: number; hora: string }[];
  gastos_total: number;
  esperado: number;
  contado: number;
  diferencia: number;
  productos: { nombre: string; unidades: number; valor: number }[];
};

export type Documento =
  | { tipo: "ticket"; datos: DatosTicket; copia: boolean }
  | { tipo: "reporte"; datos: DatosReporte; copia: boolean };
