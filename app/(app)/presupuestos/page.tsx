import type { Metadata } from "next";
import { PantallaListado } from "@/components/presupuestos/pantalla-listado";

export const metadata: Metadata = { title: "Presupuestos · Cotiza" };

export default function PresupuestosPage() {
  return <PantallaListado />;
}
