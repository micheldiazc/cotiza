// Repositorio de la versión real: habla con Supabase desde el navegador.
// La seguridad no depende de este código: cada consulta lleva el token del
// usuario y RLS solo devuelve o deja modificar sus propias filas. user_id no
// se envía nunca; la base de datos lo rellena con auth.uid().

import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  calcularTotales,
  comprobarEditable,
  comprobarTransicion,
  ErrorDatos,
  validarCliente,
  validarNombre,
  validarPresupuesto,
  validarVariante,
} from "./reglas";
import type { Repositorio } from "./repositorio";
import type {
  AjustesNegocio,
  Cliente,
  DatosPresupuesto,
  EstadoPresupuesto,
  ItemPresupuesto,
  Presupuesto,
  PresupuestoResumen,
  Producto,
  Variante,
} from "./tipos";

// --- Filas tal como vienen de Postgres (numeric llega como number o string) ---

type Num = number | string;

interface FilaAjustes {
  nombre_negocio: string | null;
  documento: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  moneda_base: string;
  iva_porcentaje: Num;
}

interface FilaCliente {
  id: string;
  nombre: string;
  documento: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

interface FilaVariante {
  id: string;
  producto_id: string;
  nombre: string;
  precio: Num;
  activo: boolean;
}

interface FilaProducto {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
  variantes?: FilaVariante[];
}

interface FilaItem {
  id: string;
  variante_id: string | null;
  descripcion: string;
  cantidad: Num;
  precio_unitario: Num;
  orden: number;
}

interface FilaPresupuesto {
  id: string;
  numero: number;
  cliente_id: string;
  estado: EstadoPresupuesto;
  moneda: string;
  tasa: Num;
  descuento_porcentaje: Num;
  iva_porcentaje: Num;
  subtotal: Num;
  total: Num;
  notas: string | null;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  created_at: string;
  updated_at: string;
  presupuesto_items?: FilaItem[];
  clientes?: { nombre: string } | null;
}

// --- Traducción fila → dominio ------------------------------------------------

const aAjustes = (f: FilaAjustes): AjustesNegocio => ({
  nombreNegocio: f.nombre_negocio,
  documento: f.documento,
  telefono: f.telefono,
  email: f.email,
  direccion: f.direccion,
  monedaBase: f.moneda_base,
  ivaPorcentaje: Number(f.iva_porcentaje),
});

const aCliente = (f: FilaCliente): Cliente => ({
  id: f.id,
  nombre: f.nombre,
  documento: f.documento,
  telefono: f.telefono,
  email: f.email,
  direccion: f.direccion,
  notas: f.notas,
  creadoEn: f.created_at,
  actualizadoEn: f.updated_at,
});

const aVariante = (f: FilaVariante): Variante => ({
  id: f.id,
  productoId: f.producto_id,
  nombre: f.nombre,
  precio: Number(f.precio),
  activo: f.activo,
});

const aProducto = (f: FilaProducto): Producto => ({
  id: f.id,
  nombre: f.nombre,
  descripcion: f.descripcion,
  activo: f.activo,
  variantes: (f.variantes ?? []).map(aVariante).sort((a, b) => a.precio - b.precio),
  creadoEn: f.created_at,
  actualizadoEn: f.updated_at,
});

const aItem = (f: FilaItem): ItemPresupuesto => ({
  id: f.id,
  varianteId: f.variante_id,
  descripcion: f.descripcion,
  cantidad: Number(f.cantidad),
  precioUnitario: Number(f.precio_unitario),
  orden: f.orden,
});

function aResumen(f: FilaPresupuesto): PresupuestoResumen {
  return {
    id: f.id,
    numero: f.numero,
    clienteId: f.cliente_id,
    clienteNombre: f.clientes?.nombre ?? "",
    estado: f.estado,
    moneda: f.moneda,
    tasa: Number(f.tasa),
    descuentoPorcentaje: Number(f.descuento_porcentaje),
    ivaPorcentaje: Number(f.iva_porcentaje),
    subtotal: Number(f.subtotal),
    total: Number(f.total),
    notas: f.notas,
    fechaEmision: f.fecha_emision,
    fechaVencimiento: f.fecha_vencimiento,
    creadoEn: f.created_at,
    actualizadoEn: f.updated_at,
  };
}

function aPresupuesto(f: FilaPresupuesto): Presupuesto {
  const { clienteNombre: _, ...resto } = aResumen(f);
  return {
    ...resto,
    items: (f.presupuesto_items ?? []).map(aItem).sort((a, b) => a.orden - b.orden),
  };
}

// --- Errores -------------------------------------------------------------------

const AJUSTES_POR_DEFECTO: AjustesNegocio = {
  nombreNegocio: null,
  documento: null,
  telefono: null,
  email: null,
  direccion: null,
  monedaBase: "USD",
  ivaPorcentaje: 0,
};

const noEncontrado = (que: string) => new ErrorDatos("no_encontrado", `${que} no existe.`);

/** Lanza el error de Supabase traducido a nuestros códigos. */
function comprobar(error: PostgrestError | null, contexto?: { fk?: ErrorDatos }) {
  if (!error) return;
  // 23503 = foreign_key_violation
  if (error.code === "23503" && contexto?.fk) throw contexto.fk;
  // 23514 = check_violation (la base de datos repite nuestras validaciones)
  if (error.code === "23514") throw new ErrorDatos("validacion", "Algún dato no es válido.");
  throw new Error(error.message);
}

/** null si no existe o si RLS lo oculta: para el usuario es lo mismo. */
function exigirFila<T>(fila: T | null, que: string): T {
  if (!fila) throw noEncontrado(que);
  return fila;
}

const COLUMNAS_PRESUPUESTO = "*, presupuesto_items(*)";

export function crearRepositorioSupabase(): Repositorio {
  const supabase = createClient();

  async function ivaPorDefecto() {
    const { data } = await supabase.from("ajustes_negocio").select("iva_porcentaje").maybeSingle();
    return data ? Number(data.iva_porcentaje) : 0;
  }

  /**
   * Crea (id = null) o actualiza un presupuesto con sus líneas en una sola
   * transacción, mediante la función de Postgres guardar_presupuesto
   * (supabase/migrations/…_guardar_presupuesto_atomico.sql). Devuelve el id.
   */
  async function guardarPresupuesto(id: string | null, datos: DatosPresupuesto): Promise<string> {
    validarPresupuesto(datos);
    const descuento_porcentaje = datos.descuentoPorcentaje ?? 0;
    const iva_porcentaje = datos.ivaPorcentaje ?? (await ivaPorDefecto());
    const { subtotal, total } = calcularTotales(datos.items, descuento_porcentaje, iva_porcentaje);

    const { data, error } = await supabase.rpc("guardar_presupuesto", {
      p_id: id,
      p_presupuesto: {
        cliente_id: datos.clienteId,
        moneda: datos.moneda,
        tasa: datos.tasa,
        descuento_porcentaje,
        iva_porcentaje,
        subtotal,
        total,
        notas: datos.notas ?? null,
        fecha_emision: datos.fechaEmision,
        fecha_vencimiento: datos.fechaVencimiento ?? null,
      },
      p_items: datos.items.map((item) => ({
        variante_id: item.varianteId ?? null,
        descripcion: item.descripcion.trim(),
        cantidad: item.cantidad,
        precio_unitario: item.precioUnitario,
      })),
    });

    // La función señala sus errores con el mensaje (raise exception 'no_editable').
    if (error?.message === "no_encontrado") throw noEncontrado("El presupuesto");
    if (error?.message === "no_editable") comprobarEditable("enviado");
    comprobar(error, { fk: noEncontrado("El cliente") });
    return data as string;
  }

  async function obtenerPresupuesto(id: string): Promise<Presupuesto | null> {
    const { data, error } = await supabase
      .from("presupuestos")
      .select(COLUMNAS_PRESUPUESTO)
      .eq("id", id)
      .maybeSingle();
    comprobar(error);
    return data ? aPresupuesto(data) : null;
  }


  return {
    ajustes: {
      async obtener() {
        const { data, error } = await supabase.from("ajustes_negocio").select("*").maybeSingle();
        comprobar(error);
        return data ? aAjustes(data) : AJUSTES_POR_DEFECTO;
      },
      async guardar(datos) {
        // Upsert: la fila se crea la primera vez (user_id = auth.uid() por defecto).
        const { data, error } = await supabase
          .from("ajustes_negocio")
          .upsert(
            {
              nombre_negocio: datos.nombreNegocio,
              documento: datos.documento,
              telefono: datos.telefono,
              email: datos.email,
              direccion: datos.direccion,
              moneda_base: datos.monedaBase,
              iva_porcentaje: datos.ivaPorcentaje,
            },
            { onConflict: "user_id" },
          )
          .select()
          .single();
        comprobar(error);
        return aAjustes(data!);
      },
    },

    clientes: {
      async listar() {
        const { data, error } = await supabase.from("clientes").select("*").order("nombre");
        comprobar(error);
        return (data ?? []).map(aCliente);
      },
      async obtener(id) {
        const { data, error } = await supabase.from("clientes").select("*").eq("id", id).maybeSingle();
        comprobar(error);
        return data ? aCliente(data) : null;
      },
      async crear(datos) {
        validarCliente(datos, true);
        const { data, error } = await supabase
          .from("clientes")
          .insert({ ...datos, nombre: datos.nombre.trim() })
          .select()
          .single();
        comprobar(error);
        return aCliente(data!);
      },
      async actualizar(id, datos) {
        validarCliente(datos, false);
        const { data, error } = await supabase
          .from("clientes")
          .update({ ...datos, nombre: datos.nombre?.trim() })
          .eq("id", id)
          .select()
          .maybeSingle();
        comprobar(error);
        return aCliente(exigirFila(data, "El cliente"));
      },
      async eliminar(id) {
        const { data, error } = await supabase.from("clientes").delete().eq("id", id).select("id");
        comprobar(error, {
          fk: new ErrorDatos("cliente_con_presupuestos", "No se puede borrar un cliente que tiene presupuestos."),
        });
        exigirFila(data?.[0] ?? null, "El cliente");
      },
    },

    productos: {
      async listar() {
        const { data, error } = await supabase.from("productos").select("*, variantes(*)").order("nombre");
        comprobar(error);
        return (data ?? []).map(aProducto);
      },
      async obtener(id) {
        const { data, error } = await supabase
          .from("productos")
          .select("*, variantes(*)")
          .eq("id", id)
          .maybeSingle();
        comprobar(error);
        return data ? aProducto(data) : null;
      },
      async crear(datos) {
        validarNombre(datos.nombre, true, "El producto");
        const { data, error } = await supabase
          .from("productos")
          .insert({ ...datos, nombre: datos.nombre.trim() })
          .select("*, variantes(*)")
          .single();
        comprobar(error);
        return aProducto(data!);
      },
      async actualizar(id, datos) {
        validarNombre(datos.nombre, false, "El producto");
        const { data, error } = await supabase
          .from("productos")
          .update({ ...datos, nombre: datos.nombre?.trim() })
          .eq("id", id)
          .select("*, variantes(*)")
          .maybeSingle();
        comprobar(error);
        return aProducto(exigirFila(data, "El producto"));
      },
      async eliminar(id) {
        // Las variantes se borran en cascada (FK on delete cascade).
        const { data, error } = await supabase.from("productos").delete().eq("id", id).select("id");
        comprobar(error);
        exigirFila(data?.[0] ?? null, "El producto");
      },
    },

    variantes: {
      async crear(productoId, datos) {
        validarVariante(datos, true);
        const { data, error } = await supabase
          .from("variantes")
          .insert({ producto_id: productoId, ...datos, nombre: datos.nombre.trim() })
          .select()
          .single();
        comprobar(error, { fk: noEncontrado("El producto") });
        return aVariante(data!);
      },
      async actualizar(id, datos) {
        validarVariante(datos, false);
        const { data, error } = await supabase
          .from("variantes")
          .update({ ...datos, nombre: datos.nombre?.trim() })
          .eq("id", id)
          .select()
          .maybeSingle();
        comprobar(error);
        return aVariante(exigirFila(data, "La variante"));
      },
      async eliminar(id) {
        // Los ítems que la usaban se quedan (FK on delete set null).
        const { data, error } = await supabase.from("variantes").delete().eq("id", id).select("id");
        comprobar(error);
        exigirFila(data?.[0] ?? null, "La variante");
      },
    },

    presupuestos: {
      async listar() {
        const { data, error } = await supabase
          .from("presupuestos")
          .select("*, clientes(nombre)")
          .order("numero", { ascending: false });
        comprobar(error);
        return (data ?? []).map(aResumen);
      },
      obtener: obtenerPresupuesto,
      async crear(datos) {
        return exigirFila(await obtenerPresupuesto(await guardarPresupuesto(null, datos)), "El presupuesto");
      },
      async actualizar(id, datos) {
        return exigirFila(await obtenerPresupuesto(await guardarPresupuesto(id, datos)), "El presupuesto");
      },
      async cambiarEstado(id, estado) {
        const actual = exigirFila(await obtenerPresupuesto(id), "El presupuesto");
        comprobarTransicion(actual.estado, estado);
        const { data, error } = await supabase
          .from("presupuestos")
          .update({ estado })
          .eq("id", id)
          .select(COLUMNAS_PRESUPUESTO)
          .single();
        comprobar(error);
        return aPresupuesto(data!);
      },
      async eliminar(id) {
        // Los ítems se borran en cascada.
        const { data, error } = await supabase.from("presupuestos").delete().eq("id", id).select("id");
        comprobar(error);
        exigirFila(data?.[0] ?? null, "El presupuesto");
      },
    },
  };
}
