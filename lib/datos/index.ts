// Punto de entrada único a los datos. Las pantallas hacen:
//
//   const repo = await obtenerRepositorio();
//   const clientes = await repo.clientes.listar();
//
// y no saben si hablan con Supabase o con el navegador. Solo se usa en
// componentes de cliente ("use client"): en la demo los datos viven en el
// navegador y el servidor no puede verlos.

import { MODO_DEMO } from "@/lib/modo";
import type { RepositorioNavegador } from "./navegador";
import type { Repositorio } from "./repositorio";

let repositorio: Promise<Repositorio> | undefined;

export function obtenerRepositorio(): Promise<Repositorio> {
  // La condición va escrita aquí con process.env, NO con la constante MODO_DEMO:
  // Turbopack solo descarta el import() de la rama muerta si ve la comparación
  // en este mismo archivo. Con MODO_DEMO generaba igualmente el chunk de
  // Supabase (con la URL y la clave dentro) en el build de la demo.
  // Comprobado buscando la URL del proyecto en .next/static tras `npm run build:demo`.
  repositorio ??= process.env.NEXT_PUBLIC_DEMO_MODE === "true"
    ? import("./navegador").then((m) => m.crearRepositorioNavegador())
    : import("./supabase").then((m) => m.crearRepositorioSupabase());
  return repositorio;
}

/** Solo existe en la demo: borra los datos del visitante y recarga los de ejemplo. */
export async function restablecerDemo() {
  if (!MODO_DEMO) throw new Error("Solo disponible en modo demo.");
  const repo = (await obtenerRepositorio()) as RepositorioNavegador;
  await repo.restablecer();
}

export type { Repositorio } from "./repositorio";
export * from "./tipos";
export {
  calcularTotales,
  convertirItems,
  ErrorDatos,
  formatearNumero,
  hoy,
  totalesEnMoneda,
  transicionPermitida,
} from "./reglas";
