import type { Metadata } from "next";
import { PantallaClientes } from "@/components/clientes/pantalla-clientes";

export const metadata: Metadata = { title: "Clientes · Cotiza" };

export default function ClientesPage() {
  return <PantallaClientes />;
}
