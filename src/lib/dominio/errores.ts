/** Mensajes cortos para los códigos que lanzan las funciones de la BD. */
const mensajes: Record<string, string> = {
  TIPO_SEDE_INMUTABLE: "El tipo de sede no se puede cambiar",
  SEDE_CON_TURNO_ABIERTO: "La sede tiene turnos abiertos",
  SEDE_NO_DISPONIBLE: "La sede no está activa",
  SEDE_INACTIVA: "Sede inactiva",
  ULTIMO_ADMIN: "Debe quedar al menos un administrador activo",
  CAJERO_CON_TURNO_ABIERTO: "El cajero tiene un turno abierto. Ciérralo primero",
  NOMBRE_USUARIO_INMUTABLE: "El usuario no se puede cambiar",
  PERFIL_SIN_ROL: "Falta el rol del usuario",
  TIPO_PRODUCTO_INMUTABLE: "El catálogo del producto no se puede cambiar",
  SOLO_ADMIN: "Solo el administrador puede hacer esto",
  SOLO_CAJERO: "Solo un cajero activo puede hacer esto",
  SIN_PERMISO: "No tienes permiso para esta acción",
  BASE_INVALIDA: "Escribe una base válida",
  TURNO_YA_ABIERTO: "Ya tienes un turno abierto",
  CAJA_OCUPADA: "Caja ocupada. Turno abierto de",
  TURNO_EN_OTRO_EQUIPO: "Este turno está abierto en otro equipo",
  EQUIPO_NO_IDENTIFICADO: "No se reconoce este equipo. Recarga la página",
  TURNO_CERRADO: "El turno está cerrado",
  TURNO_NO_EXISTE: "El turno no existe",
  LINEAS_INVALIDAS: "Revisa las cantidades del carrito",
  PRECIOS_ACTUALIZADOS: "Algunos precios cambiaron. Revisa el carrito",
  RECIBIDO_INSUFICIENTE: "El efectivo recibido no alcanza",
  TOTAL_EXCEDIDO: "El total es demasiado alto",
  MONTO_INVALIDO: "Escribe un monto válido",
  DESCRIPCION_INVALIDA: "Escribe una descripción",
  EFECTIVO_INSUFICIENTE: "No hay suficiente efectivo en caja",
  GASTO_NO_ANULABLE: "Ese gasto ya no se puede anular",
  CONTADO_INVALIDO: "Escribe el efectivo contado",
  REGISTRO_INMUTABLE: "Este registro no se puede modificar",
  FECHA_FUTURA: "La fecha no puede ser futura",
  INVENTARIO_SEDE_INACTIVA: "La sede está inactiva: el inventario es solo de consulta",
  INVENTARIO_EN_CURSO: "Esta sede ya tiene un inventario en curso",
  INVENTARIO_FECHA_OCUPADA: "Ya hay un inventario de esta sede en esa fecha",
  INVENTARIO_FINALIZADO: "El inventario está finalizado",
  INVENTARIO_NO_EXISTE: "El inventario no existe",
  NOTA_INVALIDA: "La nota admite máximo 120 caracteres",
  CANTIDAD_INVALIDA: "Cantidad no válida",
  LINEA_INVALIDA: "No se puede agregar a este inventario",
  LINEA_NO_EXISTE: "La línea ya no existe",
  YA_EN_INVENTARIO: "Ya está en el inventario",
  CAJA_MAYOR_INSUFICIENTE: "No hay suficiente en caja mayor",
  ENVIO_MAYOR_INVALIDO: "No puede ser más que lo contado",
  ORIGEN_INVALIDO: "Revisa de dónde sale el dinero",
  SEDE_NO_EXISTE: "La sede no existe",
};

type ErrorBD = { code?: string; message?: string } | null | undefined;

/** Código de negocio dentro del mensaje de la BD (p. ej. "TURNO_CERRADO"). */
export function codigoDeError(error: ErrorBD): string | undefined {
  return error?.message?.match(/\b[A-Z][A-Z_]{3,}\b/)?.[0];
}

/**
 * Traduce un error de Supabase/Postgres a un mensaje para la interfaz.
 * Si la BD agrega detalle ("CODIGO: detalle"), se muestra junto al mensaje.
 */
export function mensajeDeError(error: ErrorBD, porDefecto = "No se pudo guardar. Intenta de nuevo"): string {
  if (!error) return porDefecto;
  const codigo = codigoDeError(error);
  if (codigo && mensajes[codigo]) {
    const detalle = error.message?.split(`${codigo}: `)[1]?.trim();
    return detalle ? `${mensajes[codigo]}: ${detalle}` : mensajes[codigo];
  }
  if (error.code === "23505") return "Ya existe un registro con ese nombre";
  if (error.code === "42501") return "No tienes permiso para esta acción";
  return porDefecto;
}

export function esCodigo(error: ErrorBD, codigo: string): boolean {
  return codigoDeError(error) === codigo;
}

/** Error de red (sin respuesta del servidor). */
export function esErrorDeRed(error: { message?: string } | null | undefined): boolean {
  const m = error?.message ?? "";
  return /fetch|network|Failed to|Load failed|timeout/i.test(m);
}
