"use client";

// Leen el id de la URL con useParams. En la demo los datos solo existen en el
// navegador, así que la página no puede cargarlos en el servidor.
// Las páginas los envuelven en <Suspense>: la URL solo se conoce al pedir la
// página, y Next necesita esa frontera para pregenerar el resto (Cache Components).

import { useParams } from "next/navigation";
import { EditorPresupuesto } from "./editor-presupuesto";
import { FichaPresupuesto } from "./ficha-presupuesto";

export function FichaDesdeRuta() {
  const { id } = useParams<{ id: string }>();
  return <FichaPresupuesto id={id} />;
}

export function EditorDesdeRuta() {
  const { id } = useParams<{ id: string }>();
  return <EditorPresupuesto presupuestoId={id} />;
}
