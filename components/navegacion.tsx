"use client";

import { FileText, LayoutDashboard, Package, Settings, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ENLACES: { href: string; texto: string; icono: LucideIcon }[] = [
  { href: "/panel", texto: "Panel", icono: LayoutDashboard },
  { href: "/presupuestos", texto: "Presupuestos", icono: FileText },
  { href: "/clientes", texto: "Clientes", icono: Users },
  { href: "/catalogo", texto: "Catálogo", icono: Package },
  { href: "/ajustes", texto: "Ajustes", icono: Settings },
];

export function Navegacion() {
  const ruta = usePathname();

  return (
    <nav aria-label="Principal" className="flex flex-wrap gap-1">
      {ENLACES.map(({ href, texto, icono: Icono }) => {
        // "/presupuestos/nuevo" tiene su propio botón en la cabecera.
        const activo = (ruta === href || ruta.startsWith(`${href}/`)) && ruta !== "/presupuestos/nuevo";
        return (
          <Link
            key={href}
            href={href}
            aria-current={activo ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              activo
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
            )}
          >
            <Icono className="size-4" aria-hidden />
            {texto}
          </Link>
        );
      })}
    </nav>
  );
}
