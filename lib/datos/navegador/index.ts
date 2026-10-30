// Repositorio del modo demo: guarda todo en IndexedDB, en el navegador del
// visitante. Nada sale a la red. Imita las reglas de la base de datos real
// (numeración por negocio, no borrar clientes con presupuestos, etc.).
//
// Regla de IndexedDB: una transacción se cierra sola en cuanto se espera algo
// que no sea una operación de esa misma transacción (fetch, setTimeout...).
// Por eso todos los cálculos se hacen antes de abrirla.

import { openDB, type DBSchema, type IDBPDatabase, type IDBPObjectStore, type StoreNames } from "idb";
import {
  calcularTotales,
  comprobarEditable,
  comprobarTransicion,
  compararTasas,
  ErrorDatos,
  hoy,
  validarCliente,
  validarNombre,
  validarPresupuesto,
  validarTasa,
  validarVariante,
} from "../reglas";
import type { Repositorio } from "../repositorio";
import type {
  AjustesNegocio,
  Cliente,
  DatosPresupuesto,
  ItemPresupuesto,
  Presupuesto,
  Producto,
  Tasa,
  Variante,
} from "../tipos";
import { sembrar } from "./semilla";

type ProductoGuardado = Omit<Producto, "variantes">;
type PresupuestoGuardado = Omit<Presupuesto, "items">;
type ItemGuardado = ItemPresupuesto & { presupuestoId: string };
type AjustesGuardados = AjustesNegocio & { siguienteNumero: number };

interface EsquemaDemo extends DBSchema {
  ajustes: { key: string; value: AjustesGuardados };
  meta: { key: string; value: boolean };
  clientes: { key: string; value: Cliente };
  productos: { key: string; value: ProductoGuardado };
  variantes: { key: string; value: Variante; indexes: { porProducto: string } };
  presupuestos: { key: string; value: PresupuestoGuardado; indexes: { porCliente: string } };
  items: { key: string; value: ItemGuardado; indexes: { porPresupuesto: string; porVariante: string } };
  tasas: { key: string; value: Tasa; indexes: { porPar: [string, string] } };
}

const VERSION_BD = 2;
const TABLAS = ["ajustes", "meta", "clientes", "productos", "variantes", "presupuestos", "items", "tasas"] as const;
const CLAVE_AJUSTES = "ajustes";

const AJUSTES_INICIALES: AjustesGuardados = {
  nombreNegocio: null,
  documento: null,
  telefono: null,
  email: null,
  direccion: null,
  monedaBase: "USD",
  ivaPorcentaje: 0,
  siguienteNumero: 1,
};

export interface RepositorioNavegador extends Repositorio {
  /** Borra todo y vuelve a cargar los datos de ejemplo. */
  restablecer(): Promise<void>;
}

export interface OpcionesNavegador {
  /** Nombre de la base de datos de IndexedDB (los tests usan uno distinto por test). */
  nombreBd?: string;
  /** Cargar los datos de ejemplo la primera vez. */
  conDatosDeEjemplo?: boolean;
}

const ahora = () => new Date().toISOString();
const nuevoId = () => crypto.randomUUID();
const noEncontrado = (que: string) => new ErrorDatos("no_encontrado", `${que} no existe.`);

export async function crearRepositorioNavegador({
  nombreBd = "cotiza-demo",
  conDatosDeEjemplo = true,
}: OpcionesNavegador = {}): Promise<RepositorioNavegador> {
  // Como las migraciones de Postgres: cada versión añade lo suyo y solo se
  // aplica lo que le falte a la base de datos del visitante (oldVersion).
  const db: IDBPDatabase<EsquemaDemo> = await openDB<EsquemaDemo>(nombreBd, VERSION_BD, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore("ajustes");
        db.createObjectStore("meta");
        db.createObjectStore("clientes", { keyPath: "id" });
        db.createObjectStore("productos", { keyPath: "id" });
        db.createObjectStore("variantes", { keyPath: "id" }).createIndex("porProducto", "productoId");
        db.createObjectStore("presupuestos", { keyPath: "id" }).createIndex("porCliente", "clienteId");
        const items = db.createObjectStore("items", { keyPath: "id" });
        items.createIndex("porPresupuesto", "presupuestoId");
        items.createIndex("porVariante", "varianteId");
      }
      if (oldVersion < 2) {
        db.createObjectStore("tasas", { keyPath: "id" }).createIndex("porPar", ["monedaOrigen", "monedaDestino"]);
      }
    },
  });

  async function leerAjustes(): Promise<AjustesGuardados> {
    return (await db.get("ajustes", CLAVE_AJUSTES)) ?? AJUSTES_INICIALES;
  }

  function sinContador({ siguienteNumero: _, ...ajustes }: AjustesGuardados): AjustesNegocio {
    return ajustes;
  }

  async function itemsDe(presupuestoId: string): Promise<ItemPresupuesto[]> {
    const items = await db.getAllFromIndex("items", "porPresupuesto", presupuestoId);
    return items
      .sort((a, b) => a.orden - b.orden)
      .map(({ presupuestoId: _, ...item }) => item);
  }

  async function variantesDe(productoId: string): Promise<Variante[]> {
    const variantes = await db.getAllFromIndex("variantes", "porProducto", productoId);
    return variantes.sort((a, b) => a.precio - b.precio);
  }

  function prepararPresupuesto(datos: DatosPresupuesto, ivaPorDefecto: number) {
    validarPresupuesto(datos);
    const descuentoPorcentaje = datos.descuentoPorcentaje ?? 0;
    const ivaPorcentaje = datos.ivaPorcentaje ?? ivaPorDefecto;
    const { subtotal, total } = calcularTotales(datos.items, descuentoPorcentaje, ivaPorcentaje);
    const items = datos.items.map((item, orden) => ({
      id: nuevoId(),
      varianteId: item.varianteId ?? null,
      descripcion: item.descripcion.trim(),
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
      orden,
    }));
    return { descuentoPorcentaje, ivaPorcentaje, subtotal, total, items };
  }

  const repo: RepositorioNavegador = {
    ajustes: {
      async obtener() {
        return sinContador(await leerAjustes());
      },
      async guardar(datos) {
        const tx = db.transaction("ajustes", "readwrite");
        const actuales = (await tx.store.get(CLAVE_AJUSTES)) ?? AJUSTES_INICIALES;
        const nuevos = { ...actuales, ...datos, siguienteNumero: actuales.siguienteNumero };
        await tx.store.put(nuevos, CLAVE_AJUSTES);
        await tx.done;
        return sinContador(nuevos);
      },
    },

    tasas: {
      async listar() {
        return (await db.getAll("tasas")).sort(compararTasas);
      },
      async registrar(datos) {
        validarTasa(datos);
        const tasa: Tasa = {
          id: nuevoId(),
          monedaOrigen: datos.monedaOrigen,
          monedaDestino: datos.monedaDestino,
          valor: datos.valor,
          fuente: datos.fuente ?? "manual",
          fecha: datos.fecha ?? hoy(),
          creadoEn: ahora(),
        };
        await db.add("tasas", tasa);
        return tasa;
      },
      async ultima(monedaOrigen, monedaDestino) {
        const tasas = await db.getAllFromIndex("tasas", "porPar", [monedaOrigen, monedaDestino]);
        return tasas.sort(compararTasas)[0] ?? null;
      },
    },

    clientes: {
      async listar() {
        const clientes = await db.getAll("clientes");
        return clientes.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      },
      async obtener(id) {
        return (await db.get("clientes", id)) ?? null;
      },
      async crear(datos) {
        validarCliente(datos, true);
        const momento = ahora();
        const cliente: Cliente = {
          id: nuevoId(),
          nombre: datos.nombre.trim(),
          documento: datos.documento ?? null,
          telefono: datos.telefono ?? null,
          email: datos.email ?? null,
          direccion: datos.direccion ?? null,
          notas: datos.notas ?? null,
          creadoEn: momento,
          actualizadoEn: momento,
        };
        await db.add("clientes", cliente);
        return cliente;
      },
      async actualizar(id, datos) {
        validarCliente(datos, false);
        const tx = db.transaction("clientes", "readwrite");
        const actual = await tx.store.get(id);
        if (!actual) throw noEncontrado("El cliente");
        const cliente = {
          ...actual,
          ...datos,
          nombre: datos.nombre?.trim() ?? actual.nombre,
          actualizadoEn: ahora(),
        };
        await tx.store.put(cliente);
        await tx.done;
        return cliente;
      },
      async eliminar(id) {
        const tx = db.transaction(["clientes", "presupuestos"], "readwrite");
        if (!(await tx.objectStore("clientes").get(id))) throw noEncontrado("El cliente");
        if (await tx.objectStore("presupuestos").index("porCliente").count(id)) {
          throw new ErrorDatos(
            "cliente_con_presupuestos",
            "No se puede borrar un cliente que tiene presupuestos.",
          );
        }
        await tx.objectStore("clientes").delete(id);
        await tx.done;
      },
    },

    productos: {
      async listar() {
        const productos = await db.getAll("productos");
        const conVariantes = await Promise.all(
          productos.map(async (p) => ({ ...p, variantes: await variantesDe(p.id) })),
        );
        return conVariantes.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      },
      async obtener(id) {
        const producto = await db.get("productos", id);
        return producto ? { ...producto, variantes: await variantesDe(id) } : null;
      },
      async crear(datos) {
        validarNombre(datos.nombre, true, "El producto");
        const momento = ahora();
        const producto: ProductoGuardado = {
          id: nuevoId(),
          nombre: datos.nombre.trim(),
          descripcion: datos.descripcion ?? null,
          activo: datos.activo ?? true,
          creadoEn: momento,
          actualizadoEn: momento,
        };
        await db.add("productos", producto);
        return { ...producto, variantes: [] };
      },
      async actualizar(id, datos) {
        validarNombre(datos.nombre, false, "El producto");
        const tx = db.transaction("productos", "readwrite");
        const actual = await tx.store.get(id);
        if (!actual) throw noEncontrado("El producto");
        const producto = {
          ...actual,
          ...datos,
          nombre: datos.nombre?.trim() ?? actual.nombre,
          actualizadoEn: ahora(),
        };
        await tx.store.put(producto);
        await tx.done;
        return { ...producto, variantes: await variantesDe(id) };
      },
      async eliminar(id) {
        const tx = db.transaction(["productos", "variantes", "items"], "readwrite");
        if (!(await tx.objectStore("productos").get(id))) throw noEncontrado("El producto");
        const variantes = await tx.objectStore("variantes").index("porProducto").getAll(id);
        for (const variante of variantes) {
          await soltarVariante(tx.objectStore("items"), variante.id);
          await tx.objectStore("variantes").delete(variante.id);
        }
        await tx.objectStore("productos").delete(id);
        await tx.done;
      },
    },

    variantes: {
      async crear(productoId, datos) {
        validarVariante(datos, true);
        const tx = db.transaction(["productos", "variantes"], "readwrite");
        if (!(await tx.objectStore("productos").get(productoId))) throw noEncontrado("El producto");
        const variante: Variante = {
          id: nuevoId(),
          productoId,
          nombre: datos.nombre.trim(),
          precio: datos.precio,
          activo: datos.activo ?? true,
        };
        await tx.objectStore("variantes").add(variante);
        await tx.done;
        return variante;
      },
      async actualizar(id, datos) {
        validarVariante(datos, false);
        const tx = db.transaction("variantes", "readwrite");
        const actual = await tx.store.get(id);
        if (!actual) throw noEncontrado("La variante");
        const variante = { ...actual, ...datos, nombre: datos.nombre?.trim() ?? actual.nombre };
        await tx.store.put(variante);
        await tx.done;
        return variante;
      },
      async eliminar(id) {
        const tx = db.transaction(["variantes", "items"], "readwrite");
        if (!(await tx.objectStore("variantes").get(id))) throw noEncontrado("La variante");
        await soltarVariante(tx.objectStore("items"), id);
        await tx.objectStore("variantes").delete(id);
        await tx.done;
      },
    },

    presupuestos: {
      async listar() {
        const [presupuestos, clientes] = await Promise.all([db.getAll("presupuestos"), db.getAll("clientes")]);
        const nombres = new Map(clientes.map((c) => [c.id, c.nombre]));
        return presupuestos
          .map((p) => ({ ...p, clienteNombre: nombres.get(p.clienteId) ?? "" }))
          .sort((a, b) => b.numero - a.numero);
      },
      async obtener(id) {
        const presupuesto = await db.get("presupuestos", id);
        return presupuesto ? { ...presupuesto, items: await itemsDe(id) } : null;
      },
      async crear(datos) {
        const { ivaPorcentaje: ivaPorDefecto } = await leerAjustes();
        const calculado = prepararPresupuesto(datos, ivaPorDefecto);
        const momento = ahora();

        const tx = db.transaction(["ajustes", "clientes", "presupuestos", "items"], "readwrite");
        if (!(await tx.objectStore("clientes").get(datos.clienteId))) throw noEncontrado("El cliente");

        // Igual que el trigger de Postgres: el contador vive en los ajustes del negocio.
        const ajustes = (await tx.objectStore("ajustes").get(CLAVE_AJUSTES)) ?? AJUSTES_INICIALES;
        await tx.objectStore("ajustes").put(
          { ...ajustes, siguienteNumero: ajustes.siguienteNumero + 1 },
          CLAVE_AJUSTES,
        );

        const presupuesto: PresupuestoGuardado = {
          id: nuevoId(),
          numero: ajustes.siguienteNumero,
          clienteId: datos.clienteId,
          estado: "borrador",
          moneda: datos.moneda,
          tasa: datos.tasa ?? 1,
          descuentoPorcentaje: calculado.descuentoPorcentaje,
          ivaPorcentaje: calculado.ivaPorcentaje,
          subtotal: calculado.subtotal,
          total: calculado.total,
          notas: datos.notas ?? null,
          fechaEmision: datos.fechaEmision ?? hoy(),
          fechaVencimiento: datos.fechaVencimiento ?? null,
          creadoEn: momento,
          actualizadoEn: momento,
        };
        await tx.objectStore("presupuestos").add(presupuesto);
        for (const item of calculado.items) {
          await tx.objectStore("items").add({ ...item, presupuestoId: presupuesto.id });
        }
        await tx.done;
        return { ...presupuesto, items: calculado.items };
      },
      async actualizar(id, datos) {
        const { ivaPorcentaje: ivaPorDefecto } = await leerAjustes();
        const calculado = prepararPresupuesto(datos, ivaPorDefecto);

        const tx = db.transaction(["clientes", "presupuestos", "items"], "readwrite");
        const actual = await tx.objectStore("presupuestos").get(id);
        if (!actual) throw noEncontrado("El presupuesto");
        comprobarEditable(actual.estado);
        if (!(await tx.objectStore("clientes").get(datos.clienteId))) throw noEncontrado("El cliente");

        const presupuesto: PresupuestoGuardado = {
          ...actual,
          clienteId: datos.clienteId,
          moneda: datos.moneda,
          tasa: datos.tasa ?? actual.tasa,
          descuentoPorcentaje: calculado.descuentoPorcentaje,
          ivaPorcentaje: calculado.ivaPorcentaje,
          subtotal: calculado.subtotal,
          total: calculado.total,
          notas: datos.notas ?? actual.notas,
          fechaEmision: datos.fechaEmision ?? actual.fechaEmision,
          fechaVencimiento: datos.fechaVencimiento ?? actual.fechaVencimiento,
          actualizadoEn: ahora(),
        };
        await tx.objectStore("presupuestos").put(presupuesto);

        const items = tx.objectStore("items");
        for (const clave of await items.index("porPresupuesto").getAllKeys(id)) await items.delete(clave);
        for (const item of calculado.items) await items.add({ ...item, presupuestoId: id });

        await tx.done;
        return { ...presupuesto, items: calculado.items };
      },
      async cambiarEstado(id, estado) {
        const tx = db.transaction("presupuestos", "readwrite");
        const actual = await tx.store.get(id);
        if (!actual) throw noEncontrado("El presupuesto");
        comprobarTransicion(actual.estado, estado);
        const presupuesto = { ...actual, estado, actualizadoEn: ahora() };
        await tx.store.put(presupuesto);
        await tx.done;
        return { ...presupuesto, items: await itemsDe(id) };
      },
      async eliminar(id) {
        const tx = db.transaction(["presupuestos", "items"], "readwrite");
        if (!(await tx.objectStore("presupuestos").get(id))) throw noEncontrado("El presupuesto");
        const items = tx.objectStore("items");
        for (const clave of await items.index("porPresupuesto").getAllKeys(id)) await items.delete(clave);
        await tx.objectStore("presupuestos").delete(id);
        await tx.done;
      },
    },

    async restablecer() {
      const tx = db.transaction([...TABLAS], "readwrite");
      await Promise.all(TABLAS.map((tabla) => tx.objectStore(tabla).clear()));
      await tx.done;
      await sembrar(repo);
      await db.put("meta", true, "sembrado");
    },
  };

  if (conDatosDeEjemplo && !(await db.get("meta", "sembrado"))) {
    await repo.restablecer();
  }

  return repo;
}

/** Equivale a "on delete set null (variante_id)" de Postgres. */
async function soltarVariante<Tablas extends ArrayLike<StoreNames<EsquemaDemo>>>(
  items: IDBPObjectStore<EsquemaDemo, Tablas, "items", "readwrite">,
  varianteId: string,
) {
  for (const item of await items.index("porVariante").getAll(varianteId)) {
    await items.put({ ...item, varianteId: null });
  }
}
