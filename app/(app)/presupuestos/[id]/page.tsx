import type { Metadata } from "next";
import { Suspense } from "react";
import { FichaDesdeRuta } from "@/components/presupuestos/desde-ruta";

export const metadata: Metadata = { title: "Presupuesto · Cotiza" };

export default function PresupuestoPage() {
  return (
    <Suspense fallback={<p className="text-zinc-400">Cargando presupuesto…</p>}>
      <FichaDesdeRuta />
    </Suspense>
  );
}
