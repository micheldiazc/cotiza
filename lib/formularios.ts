// Ayudantes para leer <form> con FormData.

/** Texto recortado; null si está vacío (así la base de datos guarda NULL, no ""). */
export function texto(datos: FormData, campo: string): string | null {
  const valor = String(datos.get(campo) ?? "").trim();
  return valor === "" ? null : valor;
}

/** Número escrito por una persona: acepta "1.234,5", "1234,5" y "1234.5". */
export function numero(datos: FormData, campo: string): number {
  return leerNumero(String(datos.get(campo) ?? ""));
}

export function leerNumero(entrada: string): number {
  let valor = entrada.trim().replace(/\s/g, "");
  if (valor === "") return Number.NaN;
  if (valor.includes(",")) {
    // Formato español: el punto es separador de miles y la coma, decimal.
    valor = valor.replace(/\./g, "").replace(",", ".");
  }
  return Number(valor);
}
