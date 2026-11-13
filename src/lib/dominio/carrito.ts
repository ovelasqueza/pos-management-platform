/** Carrito de la venta en curso: reducer puro, sin React. */
import type { ModalidadProducto } from "./producto";

export type ProductoVendible = {
  id: string;
  nombre: string;
  categoriaId: string | null;
  categoria: string | null;
  imagenUrl: string | null;
  precio: number;
  modalidad?: ModalidadProducto | null;
};

export type LineaCarrito = {
  productoId: string;
  nombre: string;
  precio: number;
  cantidad: number;
};

export type Carrito = LineaCarrito[];

export const CANTIDAD_MAX = 999;

export type AccionCarrito =
  | { tipo: "agregar"; producto: Pick<ProductoVendible, "id" | "nombre" | "precio"> }
  | { tipo: "sumar"; productoId: string }
  | { tipo: "restar"; productoId: string }
  | { tipo: "fijar"; productoId: string; cantidad: number }
  | { tipo: "quitar"; productoId: string }
  | { tipo: "vaciar" }
  | { tipo: "reemplazar"; carrito: Carrito };

export function reducirCarrito(carrito: Carrito, accion: AccionCarrito): Carrito {
  switch (accion.tipo) {
    case "agregar": {
      const existe = carrito.find((l) => l.productoId === accion.producto.id);
      if (existe) return reducirCarrito(carrito, { tipo: "sumar", productoId: existe.productoId });
      const { id, nombre, precio } = accion.producto;
      return [...carrito, { productoId: id, nombre, precio, cantidad: 1 }];
    }
    case "sumar":
      return carrito.map((l) =>
        l.productoId === accion.productoId ? { ...l, cantidad: Math.min(l.cantidad + 1, CANTIDAD_MAX) } : l,
      );
    case "restar":
      return carrito.flatMap((l) => {
        if (l.productoId !== accion.productoId) return [l];
        return l.cantidad <= 1 ? [] : [{ ...l, cantidad: l.cantidad - 1 }];
      });
    case "fijar":
      if (!Number.isInteger(accion.cantidad) || accion.cantidad < 1 || accion.cantidad > CANTIDAD_MAX) {
        return carrito; // inválido: se conserva la cantidad anterior
      }
      return carrito.map((l) => (l.productoId === accion.productoId ? { ...l, cantidad: accion.cantidad } : l));
    case "quitar":
      return carrito.filter((l) => l.productoId !== accion.productoId);
    case "vaciar":
      return [];
    case "reemplazar":
      return accion.carrito;
  }
}

export const subtotal = (l: LineaCarrito) => l.cantidad * l.precio;
export const totalCarrito = (c: Carrito) => c.reduce((s, l) => s + subtotal(l), 0);
export const unidadesCarrito = (c: Carrito) => c.reduce((s, l) => s + l.cantidad, 0);

/**
 * Ajusta el carrito al catálogo vigente: actualiza precios y quita productos
 * que ya no se venden. Devuelve el carrito nuevo y qué cambió.
 */
export function conciliarCarrito(carrito: Carrito, vigentes: ProductoVendible[]) {
  const porId = new Map(vigentes.map((p) => [p.id, p]));
  const retirados: string[] = [];
  const conPrecioNuevo: string[] = [];

  const nuevo = carrito.flatMap((l) => {
    const p = porId.get(l.productoId);
    if (!p) {
      retirados.push(l.nombre);
      return [];
    }
    if (p.precio !== l.precio) conPrecioNuevo.push(p.nombre);
    return [{ ...l, nombre: p.nombre, precio: p.precio }];
  });

  return { carrito: nuevo, retirados, conPrecioNuevo, cambio: retirados.length + conPrecioNuevo.length > 0 };
}

/** Huella del carrito: si no cambia, se reutiliza la misma clave de cobro. */
export function firmaCarrito(c: Carrito): string {
  return c
    .map((l) => `${l.productoId}:${l.cantidad}:${l.precio}`)
    .sort()
    .join("|");
}
