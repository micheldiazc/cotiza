// Reglas de negocio compartidas. Las dos implementaciones del repositorio las
// usan, así la demo se comporta igual que la versión real. La base de datos
// repite algunas (checks, FK) como última barrera.

import type { DatosCliente, DatosItem, DatosPresupuesto, DatosVariante, EstadoPresupuesto } from "./tipos";

export type CodigoError =
  | "validacion"
  | "no_encontrado"
  | "cliente_con_presupuestos"
  | "no_editable"
  | "transicion_invalida";

export class ErrorDatos extends Error {
  constructor(
    public readonly codigo: CodigoError,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "ErrorDatos";
  }
}

// --- Dinero ------------------------------------------------------------------

/** Redondea a céntimos trabajando en enteros para evitar errores de coma flotante. */
export function redondear(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

export interface Totales {
  subtotal: number;
  descuento: number;
  baseImponible: number;
  iva: number;
  total: number;
}

export function calcularTotales(
  items: Pick<DatosItem, "cantidad" | "precioUnitario">[],
  descuentoPorcentaje = 0,
  ivaPorcentaje = 0,
): Totales {
  const subtotal = redondear(items.reduce((suma, i) => suma + redondear(i.cantidad * i.precioUnitario), 0));
  const descuento = redondear((subtotal * descuentoPorcentaje) / 100);
  const baseImponible = redondear(subtotal - descuento);
  const iva = redondear((baseImponible * ivaPorcentaje) / 100);
  return { subtotal, descuento, baseImponible, iva, total: redondear(baseImponible + iva) };
}

// --- Estados -----------------------------------------------------------------

const TRANSICIONES: Record<EstadoPresupuesto, EstadoPresupuesto[]> = {
  borrador: ["enviado"],
  enviado: ["aceptado", "rechazado", "borrador"],
  aceptado: [],
  rechazado: ["borrador"],
};

export function transicionPermitida(desde: EstadoPresupuesto, hacia: EstadoPresupuesto): boolean {
  return TRANSICIONES[desde].includes(hacia);
}

export function comprobarTransicion(desde: EstadoPresupuesto, hacia: EstadoPresupuesto) {
  if (!transicionPermitida(desde, hacia)) {
    throw new ErrorDatos("transicion_invalida", `Un presupuesto ${desde} no puede pasar a ${hacia}.`);
  }
}

/** Solo los borradores se pueden editar: lo enviado al cliente no cambia por detrás. */
export function comprobarEditable(estado: EstadoPresupuesto) {
  if (estado !== "borrador") {
    throw new ErrorDatos("no_editable", "Solo se pueden editar presupuestos en borrador.");
  }
}

// --- Validaciones ------------------------------------------------------------

function exigir(condicion: boolean, mensaje: string) {
  if (!condicion) throw new ErrorDatos("validacion", mensaje);
}

const esPorcentaje = (n: number) => Number.isFinite(n) && n >= 0 && n <= 100;
const esMoneda = (m: string) => /^[A-Z]{3}$/.test(m);

export function validarCliente(datos: Partial<DatosCliente>, esNuevo: boolean) {
  if (esNuevo || datos.nombre !== undefined) {
    exigir(Boolean(datos.nombre?.trim()), "El cliente necesita un nombre.");
  }
}

export function validarNombre(nombre: string | undefined, esNuevo: boolean, que: string) {
  if (esNuevo || nombre !== undefined) {
    exigir(Boolean(nombre?.trim()), `${que} necesita un nombre.`);
  }
}

export function validarVariante(datos: Partial<DatosVariante>, esNueva: boolean) {
  validarNombre(datos.nombre, esNueva, "La variante");
  if (esNueva || datos.precio !== undefined) {
    exigir(Number.isFinite(datos.precio) && datos.precio! >= 0, "El precio no puede ser negativo.");
  }
}

export function validarPresupuesto(datos: DatosPresupuesto) {
  exigir(Boolean(datos.clienteId), "El presupuesto necesita un cliente.");
  exigir(esMoneda(datos.moneda), "La moneda debe ser un código de 3 letras, como USD.");
  exigir(datos.tasa === undefined || (Number.isFinite(datos.tasa) && datos.tasa > 0), "La tasa debe ser mayor que 0.");
  exigir(
    datos.descuentoPorcentaje === undefined || esPorcentaje(datos.descuentoPorcentaje),
    "El descuento debe estar entre 0 y 100.",
  );
  exigir(datos.ivaPorcentaje === undefined || esPorcentaje(datos.ivaPorcentaje), "El IVA debe estar entre 0 y 100.");
  exigir(
    !datos.fechaVencimiento || !datos.fechaEmision || datos.fechaVencimiento >= datos.fechaEmision,
    "El vencimiento no puede ser anterior a la emisión.",
  );
  for (const item of datos.items) {
    exigir(Boolean(item.descripcion?.trim()), "Cada línea necesita una descripción.");
    exigir(Number.isFinite(item.cantidad) && item.cantidad > 0, "La cantidad debe ser mayor que 0.");
    exigir(Number.isFinite(item.precioUnitario) && item.precioUnitario >= 0, "El precio no puede ser negativo.");
  }
}

export function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

/** P-0001, P-0042... */
export function formatearNumero(numero: number): string {
  return `P-${String(numero).padStart(4, "0")}`;
}
