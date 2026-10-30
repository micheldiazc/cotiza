import Link from "next/link";
import { Suspense } from "react";
import { Navegacion } from "@/components/navegacion";
import { Button } from "@/components/ui/button";
import { MODO_DEMO } from "@/lib/modo";
import { cerrarSesion } from "../(auth)/actions";

// Zona privada: todas las páginas de este grupo comparten cabecera y menú.
// La protección la ponen proxy.ts (redirige a /login sin sesión) y RLS.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/panel" className="text-lg font-semibold tracking-tight">
              Cotiza
            </Link>
            {/* usePathname depende de la URL: en rutas con [id] solo se conoce al pedir la página. */}
            <Suspense fallback={<nav aria-label="Principal" className="h-8" />}>
              <Navegacion />
            </Suspense>
          </div>
          {!MODO_DEMO && (
            <form action={cerrarSesion}>
              <Button variant="outline" size="sm" type="submit">
                Cerrar sesión
              </Button>
            </form>
          )}
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6">{children}</main>
    </div>
  );
}
