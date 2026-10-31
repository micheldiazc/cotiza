// Métricas del panel de control. Función pura: recibe los presupuestos y la
// fecha de hoy, y no depende de dónde estén guardados (demo o Supabase).

import { redondear } from "@/lib/datos/reglas";
import type { PresupuestoResumen } from "@/lib/datos/tipos";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export interface VentasMes {
  /** AAAA-MM */
  mes: string;
  /** "oct 26" */
  etiqueta: string;
  total: number;
}

export interface Metricas {
  /** Suma de los aceptados, en moneda base. */
  ventasAceptadas: number;
  /** Todos menos los borradores. */
  emitidos: number;
  borradores: number;
  /** Enviados, esperando respuesta del cliente. */
  pendientes: number;
  aceptados: number;
  rechazados: number;
  /** aceptados / (aceptados + rechazados); null si aún no hay ninguno decidido. */
  tasaAceptacion: number | null;
  /** Ventas aceptadas por mes de emisión, del más antiguo al actual. */
  ventasPorMes: VentasMes[];
}

/** Las claves AAAA-MM de los últimos `cuantos` meses, terminando en el de `hoy`. */
export function ultimosMeses(hoy: string, cuantos: number): string[] {
  const [anio, mes] = hoy.split("-").map(Number);
  return Array.from({ length: cuantos }, (_, i) => {
    const total = anio * 12 + (mes - 1) - (cuantos - 1 - i);
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
  });
}

export function calcularMetricas(
  presupuestos: Pick<PresupuestoResumen, "estado" | "total" | "fechaEmision">[],
  hoy: string,
  meses = 6,
): Metricas {
  const contar = (estado: PresupuestoResumen["estado"]) => presupuestos.filter((p) => p.estado === estado).length;
  const aceptadosLista = presupuestos.filter((p) => p.estado === "aceptado");
  const aceptados = aceptadosLista.length;
  const rechazados = contar("rechazado");
  const borradores = contar("borrador");

  const ventasPorMes = ultimosMeses(hoy, meses).map((mes) => {
    const [anio, numeroMes] = mes.split("-");
    const total = aceptadosLista
      .filter((p) => p.fechaEmision.startsWith(mes))
      .reduce((suma, p) => suma + p.total, 0);
    return { mes, etiqueta: `${MESES[Number(numeroMes) - 1]} ${anio.slice(2)}`, total: redondear(total) };
  });

  return {
    ventasAceptadas: redondear(aceptadosLista.reduce((suma, p) => suma + p.total, 0)),
    emitidos: presupuestos.length - borradores,
    borradores,
    pendientes: contar("enviado"),
    aceptados,
    rechazados,
    tasaAceptacion: aceptados + rechazados > 0 ? aceptados / (aceptados + rechazados) : null,
    ventasPorMes,
  };
}
