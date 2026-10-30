// Tipos del dominio, compartidos por la versión real (Supabase) y la demo
// (navegador). En TypeScript van en camelCase; la implementación de Supabase
// traduce a las columnas snake_case de la base de datos.

export type EstadoPresupuesto = "borrador" | "enviado" | "aceptado" | "rechazado";

export interface AjustesNegocio {
  nombreNegocio: string | null;
  documento: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  monedaBase: string;
  ivaPorcentaje: number;
}

export interface Cliente {
  id: string;
  nombre: string;
  documento: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  notas: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

export type DatosCliente = Pick<Cliente, "nombre"> &
  Partial<Pick<Cliente, "documento" | "telefono" | "email" | "direccion" | "notas">>;

export interface Variante {
  id: string;
  productoId: string;
  nombre: string;
  precio: number;
  activo: boolean;
}

export type DatosVariante = Pick<Variante, "nombre" | "precio"> & Partial<Pick<Variante, "activo">>;

export interface Producto {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  variantes: Variante[];
  creadoEn: string;
  actualizadoEn: string;
}

export type DatosProducto = Pick<Producto, "nombre"> &
  Partial<Pick<Producto, "descripcion" | "activo">>;

export interface ItemPresupuesto {
  id: string;
  varianteId: string | null;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  orden: number;
}

export type DatosItem = Pick<ItemPresupuesto, "descripcion" | "cantidad" | "precioUnitario"> &
  Partial<Pick<ItemPresupuesto, "varianteId">>;

export interface Presupuesto {
  id: string;
  numero: number;
  clienteId: string;
  estado: EstadoPresupuesto;
  /** Moneda en la que se muestra al cliente. Los precios se guardan en la moneda base. */
  moneda: string;
  /** 1 unidad de moneda base = `tasa` unidades de `moneda`. */
  tasa: number;
  descuentoPorcentaje: number;
  ivaPorcentaje: number;
  subtotal: number;
  total: number;
  notas: string | null;
  /** Fecha sin hora, AAAA-MM-DD. */
  fechaEmision: string;
  fechaVencimiento: string | null;
  items: ItemPresupuesto[];
  creadoEn: string;
  actualizadoEn: string;
}

/** Lo que muestra un listado: sin ítems y con el nombre del cliente. */
export type PresupuestoResumen = Omit<Presupuesto, "items"> & { clienteNombre: string };

export type DatosPresupuesto = {
  clienteId: string;
  moneda: string;
  items: DatosItem[];
} & Partial<
  Pick<
    Presupuesto,
    "tasa" | "descuentoPorcentaje" | "ivaPorcentaje" | "notas" | "fechaEmision" | "fechaVencimiento"
  >
>;
