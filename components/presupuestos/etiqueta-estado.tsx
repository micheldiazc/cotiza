import { cn } from "@/lib/utils";
import type { EstadoPresupuesto } from "@/lib/datos";

export const NOMBRE_ESTADO: Record<EstadoPresupuesto, string> = {
  borrador: "Borrador",
  enviado: "Enviado",
  aceptado: "Aceptado",
  rechazado: "Rechazado",
};

const COLORES: Record<EstadoPresupuesto, string> = {
  borrador: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  enviado: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  aceptado: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  rechazado: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
};

export function EtiquetaEstado({ estado }: { estado: EstadoPresupuesto }) {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", COLORES[estado])}>
      {NOMBRE_ESTADO[estado]}
    </span>
  );
}
