import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { MODO_DEMO } from "@/lib/modo";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Cotiza</h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        Presupuestos claros para pequeños negocios: clientes, catálogo, PDF y
        multimoneda.
      </p>
      {MODO_DEMO ? (
        <Link href="/panel" className={buttonVariants()}>
          Ver la demo
        </Link>
      ) : (
        <div className="flex gap-3">
          <Link href="/login" className={buttonVariants()}>
            Entrar
          </Link>
          <Link href="/registro" className={buttonVariants({ variant: "outline" })}>
            Crear cuenta
          </Link>
        </div>
      )}
    </main>
  );
}
