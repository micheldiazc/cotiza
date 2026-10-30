import type { Metadata } from "next";
import { Suspense } from "react";
import { EditorDesdeRuta } from "@/components/presupuestos/desde-ruta";

export const metadata: Metadata = { title: "Editar presupuesto · Cotiza" };

export default function EditarPresupuestoPage() {
  return (
    <Suspense fallback={<p className="text-zinc-400">Cargando…</p>}>
      <EditorDesdeRuta />
    </Suspense>
  );
}
