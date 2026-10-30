"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ENLACES = [
  { href: "/panel", texto: "Panel" },
  { href: "/presupuestos", texto: "Presupuestos" },
  { href: "/clientes", texto: "Clientes" },
  { href: "/catalogo", texto: "Catálogo" },
  { href: "/ajustes", texto: "Ajustes" },
];

export function Navegacion() {
  const ruta = usePathname();

  return (
    <nav aria-label="Principal" className="flex flex-wrap gap-1">
      {ENLACES.map(({ href, texto }) => {
        const activo = ruta === href || ruta.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={activo ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              activo ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-600 hover:bg-zinc-100",
            )}
          >
            {texto}
          </Link>
        );
      })}
    </nav>
  );
}
