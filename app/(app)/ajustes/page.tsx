import type { Metadata } from "next";
import { PantallaAjustes } from "@/components/ajustes/pantalla-ajustes";

export const metadata: Metadata = { title: "Ajustes · Cotiza" };

export default function AjustesPage() {
  return <PantallaAjustes />;
}
