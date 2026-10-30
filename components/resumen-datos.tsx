"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatearNumero, obtenerRepositorio, type PresupuestoResumen } from "@/lib/datos";

interface Resumen {
  negocio: string | null;
  clientes: number;
  productos: number;
  presupuestos: PresupuestoResumen[];
}

// Provisional (etapa 3b): comprueba que el repositorio responde en ambos modos.
// Se sustituirá por el panel de verdad cuando existan las pantallas.
export function ResumenDatos() {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      try {
        const repo = await obtenerRepositorio();
        const [ajustes, clientes, productos, presupuestos] = await Promise.all([
          repo.ajustes.obtener(),
          repo.clientes.listar(),
          repo.productos.listar(),
          repo.presupuestos.listar(),
        ]);
        setResumen({
          negocio: ajustes.nombreNegocio,
          clientes: clientes.length,
          productos: productos.length,
          presupuestos,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudieron cargar los datos.");
      }
    }
    cargar();
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!resumen) return <p className="text-zinc-400">Cargando datos…</p>;

  return (
    <section className="flex flex-col gap-4">
      {resumen.negocio && <p className="text-lg font-medium">{resumen.negocio}</p>}
      <p className="text-zinc-600">
        {resumen.clientes} clientes · {resumen.productos} productos · {resumen.presupuestos.length} presupuestos
      </p>
      {resumen.presupuestos.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {resumen.presupuestos.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-4 px-4 py-2 text-sm">
              <Link href={`/presupuestos/${p.id}`} className="font-mono underline-offset-4 hover:underline">
                {formatearNumero(p.numero)}
              </Link>
              <span className="flex-1 truncate">{p.clienteNombre}</span>
              <span className="text-zinc-500">{p.estado}</span>
              <span className="tabular-nums">
                {/* Totales en moneda base; tasa = cuántas unidades de la moneda del presupuesto vale 1 de la base. */}
                {(p.total * p.tasa).toFixed(2)} {p.moneda}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
