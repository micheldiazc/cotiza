import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PanelControl } from "@/components/panel/panel-control";
import { MODO_DEMO } from "@/lib/modo";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Panel · Cotiza" };

async function UsuarioActual() {
  const supabase = await createClient();
  // Segunda capa: aunque proxy.ts ya filtra, la página comprueba por sí misma.
  // getUser() pregunta al servidor de Auth, así que detecta sesiones revocadas.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <p className="text-xs text-zinc-500">Sesión iniciada como {user.email}</p>;
}

export default function PanelPage() {
  return (
    <PanelControl
      sesion={
        MODO_DEMO ? null : (
          <Suspense fallback={null}>
            <UsuarioActual />
          </Suspense>
        )
      }
    />
  );
}
