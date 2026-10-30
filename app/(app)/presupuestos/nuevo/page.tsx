import type { Metadata } from "next";
import { EditorPresupuesto } from "@/components/presupuestos/editor-presupuesto";

export const metadata: Metadata = { title: "Nuevo presupuesto · Cotiza" };

export default function NuevoPresupuestoPage() {
  return <EditorPresupuesto />;
}
