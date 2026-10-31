import { Code2 } from "lucide-react";
import { AUTORA, URL_CODIGO, URL_PORTAFOLIO } from "@/lib/creditos";

/** Créditos de la autora: su marca (la M de nodos) enlaza a su portafolio. */
export function PiePagina() {
  return (
    <footer className="border-t bg-background print:hidden">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm text-zinc-500">
        <p className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-zinc-700">Cotiza</span>
          <span aria-hidden>·</span>
          <span>Desarrollado por</span>
          <a
            href={URL_PORTAFOLIO}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-medium text-zinc-700 hover:text-primary"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG de 1 KB: no necesita optimización. */}
            <img src="/marca/michel-claro.svg" alt="" width={20} height={20} className="size-5" />
            {AUTORA}
          </a>
        </p>
        <a
          href={URL_CODIGO}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 hover:text-primary"
        >
          <Code2 className="size-4" aria-hidden />
          Código en GitHub
        </a>
      </div>
    </footer>
  );
}
