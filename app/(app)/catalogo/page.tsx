import type { Metadata } from "next";
import { PantallaCatalogo } from "@/components/catalogo/pantalla-catalogo";

export const metadata: Metadata = { title: "Catálogo · Cotiza" };

export default function CatalogoPage() {
  return <PantallaCatalogo />;
}
