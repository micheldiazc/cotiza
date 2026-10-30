import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ResumenDatos } from "@/components/resumen-datos";
import { MODO_DEMO } from "@/lib/modo";
import { createClient } from "@/lib/supabase/server";

async function UsuarioActual() {
  const supabase = await createClient();
  // Segunda capa: aunque proxy.ts ya filtra, la página comprueba por sí misma.
  // getUser() pregunta al servidor de Auth, así que detecta sesiones revocadas.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <p className="text-zinc-600">
      Sesión iniciada como <strong>{user.email}</strong>.
    </p>
  );
}

export default function PanelPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Panel</h1>
      {!MODO_DEMO && (
        <Suspense fallback={<p className="text-zinc-400">Cargando…</p>}>
          <UsuarioActual />
        </Suspense>
      )}
      <ResumenDatos />
    </>
  );
}
