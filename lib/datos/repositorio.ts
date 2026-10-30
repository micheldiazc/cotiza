// El contrato: qué operaciones de datos existen, sin decir dónde se guardan.
// Las pantallas solo conocen esta interfaz. Hay dos implementaciones:
//   - supabase.ts  → versión real (login + RLS)
//   - navegador/   → modo demo (IndexedDB en el navegador del visitante)
// Ambas pasan los mismos tests (lib/datos/__tests__/contrato.ts).

import type {
  AjustesNegocio,
  Cliente,
  DatosCliente,
  DatosPresupuesto,
  DatosProducto,
  DatosVariante,
  EstadoPresupuesto,
  Presupuesto,
  PresupuestoResumen,
  Producto,
  Variante,
} from "./tipos";

export interface Repositorio {
  ajustes: {
    obtener(): Promise<AjustesNegocio>;
    guardar(datos: Partial<AjustesNegocio>): Promise<AjustesNegocio>;
  };

  clientes: {
    listar(): Promise<Cliente[]>;
    obtener(id: string): Promise<Cliente | null>;
    crear(datos: DatosCliente): Promise<Cliente>;
    actualizar(id: string, datos: Partial<DatosCliente>): Promise<Cliente>;
    /** Falla con "cliente_con_presupuestos" si tiene presupuestos. */
    eliminar(id: string): Promise<void>;
  };

  productos: {
    /** Incluye las variantes de cada producto. */
    listar(): Promise<Producto[]>;
    obtener(id: string): Promise<Producto | null>;
    crear(datos: DatosProducto): Promise<Producto>;
    actualizar(id: string, datos: Partial<DatosProducto>): Promise<Producto>;
    /** Borra también sus variantes. */
    eliminar(id: string): Promise<void>;
  };

  variantes: {
    crear(productoId: string, datos: DatosVariante): Promise<Variante>;
    actualizar(id: string, datos: Partial<DatosVariante>): Promise<Variante>;
    /** Los ítems que la usaban se quedan, con varianteId = null. */
    eliminar(id: string): Promise<void>;
  };

  presupuestos: {
    /** Del más reciente al más antiguo. */
    listar(): Promise<PresupuestoResumen[]>;
    obtener(id: string): Promise<Presupuesto | null>;
    /** Nace en borrador, con el siguiente número del negocio y los totales calculados. */
    crear(datos: DatosPresupuesto): Promise<Presupuesto>;
    /** Solo en borrador. Sustituye todos los ítems. */
    actualizar(id: string, datos: DatosPresupuesto): Promise<Presupuesto>;
    cambiarEstado(id: string, estado: EstadoPresupuesto): Promise<Presupuesto>;
    eliminar(id: string): Promise<void>;
  };
}
