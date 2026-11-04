import type { MetodoPago } from "./cobro";

/** Datos que devuelve la BD para imprimir (ver privado.ticket y privado.armar_reporte). */

/** `nit`: ticket desde el script 12; reporte de turno desde el script 17 (los anteriores no lo traen). */
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
  /** Desde el script 18: hora y motivo si la venta se anuló */
  anulada_en?: string | null;
  motivo_anulacion?: string | null;
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
  /** Desde el script 18: ventas anuladas del turno (no cuentan en los totales) */
  anuladas?: { numero: number; hora: string; anulada_en: string; metodo: MetodoPago; total: number; motivo: string }[];
  anuladas_total?: number;
  gastos: {
    descripcion: string;
    monto: number;
    hora: string;
    /** Desde la spec 06; los reportes anteriores no los traen (todo salió de la caja) */
    monto_caja?: number;
    monto_mayor?: number;
    /** Lo que salió de cada parte de la caja mayor (reportes anteriores traen parte_mayor) */
    mayor?: Partial<Record<MetodoPago, number>>;
    parte_mayor?: MetodoPago | null;
  }[];
  gastos_total: number;
  /** Spec 06: gastos que salieron de la caja (se restan del esperado) y de la caja mayor */
  gastos_caja?: number;
  gastos_mayor?: number;
  esperado: number;
  contado: number;
  diferencia: number;
  /** Spec 06: lo que entró a la caja mayor al cerrar */
  caja_mayor?: Record<MetodoPago, number> & { total: number };
  queda_en_caja?: number;
  productos: { nombre: string; unidades: number; valor: number }[];
};

export type Documento =
  | { tipo: "ticket"; datos: DatosTicket; copia: boolean }
  | { tipo: "reporte"; datos: DatosReporte; copia: boolean };
