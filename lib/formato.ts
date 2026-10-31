// Formatos para mostrar datos. Usan Intl, la API estándar de internacionalización
// del navegador, con convenciones de español (1.234,50).

const LOCALE = "es-VE";

export function formatearDinero(valor: number, moneda: string): string {
  try {
    return new Intl.NumberFormat(LOCALE, { style: "currency", currency: moneda }).format(valor);
  } catch {
    // Código de moneda que Intl no conoce: número y código a mano.
    return `${formatearNumero(valor)} ${moneda}`;
  }
}

/** Sin decimales, redondeando: para etiquetas de gráficos ("USD 499"). */
export function formatearDineroCorto(valor: number, moneda: string): string {
  try {
    return new Intl.NumberFormat(LOCALE, { style: "currency", currency: moneda, maximumFractionDigits: 0 }).format(
      valor,
    );
  } catch {
    return `${formatearNumero(valor, 0)} ${moneda}`;
  }
}

export function formatearNumero(valor: number, decimales = 2): string {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor);
}

/** "2026-10-29" → "29/10/2026". Sin pasar por Date, para que la zona horaria no mueva el día. */
export function formatearFecha(fecha: string | null): string {
  if (!fecha) return "";
  const [anio, mes, dia] = fecha.slice(0, 10).split("-");
  return `${dia}/${mes}/${anio}`;
}

/** Minúsculas y sin tildes: "Ñandú Pérez" → "nandu perez". Para búsquedas. */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/** true si el texto buscado aparece en alguno de los campos. */
export function coincide(busqueda: string, campos: (string | null | undefined)[]): boolean {
  const buscado = normalizar(busqueda);
  if (!buscado) return true;
  return campos.some((campo) => campo && normalizar(campo).includes(buscado));
}
