// Tasa oficial del BCV (bolívares por dólar y por euro).
//
// Versión real: el navegador pide /api/tasas/bcv y es el SERVIDOR quien consulta
// ve.dolarapi.com (la misma fuente que usaba el proyecto original). Así no
// dependemos del CORS de un servicio externo y la ruta exige sesión.
// Demo: valores fijos de ejemplo, sin ninguna llamada externa.

import { ErrorDatos, hoy } from "@/lib/datos";

export const URL_DOLAR = "https://ve.dolarapi.com/v1/dolares/oficial";
export const URL_EURO = "https://ve.dolarapi.com/v1/euros/oficial";

export interface TasasBcv {
  /** Bolívares por 1 USD. */
  usd: number;
  /** Bolívares por 1 EUR. */
  eur: number;
  /** Fecha de la publicación, AAAA-MM-DD. */
  fecha: string;
  /** true en la demo: no son las tasas del día. */
  ejemplo: boolean;
}

/**
 * Valida una respuesta de dolarapi ({ promedio: 888.8909, fechaActualizacion: "2026-10-29T00:00:00-04:00" }).
 * Si algo no cuadra, lanza en lugar de devolver una tasa absurda.
 */
export function interpretarRespuesta(json: unknown): { valor: number; fecha: string } {
  const datos = (json ?? {}) as { promedio?: unknown; fechaActualizacion?: unknown };
  const valor = Number(datos.promedio);
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error("La respuesta del BCV no trae una tasa válida.");
  }
  const fecha = typeof datos.fechaActualizacion === "string" ? datos.fechaActualizacion.slice(0, 10) : "";
  return {
    valor: Math.round(valor * 10_000) / 10_000,
    // La fecha viene con la hora de Venezuela (-04:00): sus 10 primeros caracteres ya son la fecha local.
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : hoy(),
  };
}

export async function obtenerTasasBcv(): Promise<TasasBcv> {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    return { usd: 880, eur: 975, fecha: hoy(), ejemplo: true };
  }
  const respuesta = await fetch("/api/tasas/bcv", { cache: "no-store" });
  const cuerpo = await respuesta.json().catch(() => null);
  if (!respuesta.ok || !cuerpo) {
    throw new ErrorDatos("validacion", cuerpo?.error ?? "No se pudo consultar la tasa del BCV. Inténtalo más tarde.");
  }
  return cuerpo as TasasBcv;
}
