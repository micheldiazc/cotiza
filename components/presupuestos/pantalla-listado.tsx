"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatearNumero, type EstadoPresupuesto } from "@/lib/datos";
import { coincide, formatearDinero, formatearFecha } from "@/lib/formato";
import { useDatos } from "@/lib/use-datos";
import { cn } from "@/lib/utils";
import { EtiquetaEstado, NOMBRE_ESTADO } from "./etiqueta-estado";

const FILTROS: (EstadoPresupuesto | "todos")[] = ["todos", "borrador", "enviado", "aceptado", "rechazado"];

export function PantallaListado() {
  const router = useRouter();
  const { datos, cargando, error } = useDatos(async (repo) => {
    const [presupuestos, ajustes] = await Promise.all([repo.presupuestos.listar(), repo.ajustes.obtener()]);
    return { presupuestos, monedaBase: ajustes.monedaBase };
  });
  const [filtro, setFiltro] = useState<EstadoPresupuesto | "todos">("todos");
  const [busqueda, setBusqueda] = useState("");

  const presupuestos = datos?.presupuestos ?? [];
  const contar = (estado: EstadoPresupuesto | "todos") =>
    estado === "todos" ? presupuestos.length : presupuestos.filter((p) => p.estado === estado).length;
  const visibles = presupuestos.filter(
    (p) =>
      (filtro === "todos" || p.estado === filtro) &&
      coincide(busqueda, [p.clienteNombre, formatearNumero(p.numero), String(p.numero)]),
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Presupuestos</h1>
        <Link href="/presupuestos/nuevo" className={buttonVariants()}>
          Nuevo presupuesto
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-1">
          {FILTROS.map((estado) => (
            <button
              key={estado}
              type="button"
              aria-pressed={filtro === estado}
              onClick={() => setFiltro(estado)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                filtro === estado ? "border-zinc-900 bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100",
              )}
            >
              {estado === "todos" ? "Todos" : NOMBRE_ESTADO[estado]} ({contar(estado)})
            </button>
          ))}
        </div>
        <Input
          type="search"
          placeholder="Buscar por cliente o número"
          aria-label="Buscar presupuestos"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {cargando && <p className="text-zinc-400">Cargando presupuestos…</p>}

      {datos && presupuestos.length === 0 && (
        <p className="rounded-lg border border-dashed p-8 text-center text-zinc-500">
          Todavía no hay presupuestos. Crea el primero con «Nuevo presupuesto».
        </p>
      )}

      {presupuestos.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden sm:table-cell">Fecha</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total ({datos?.monedaBase})</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibles.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/presupuestos/${p.id}`)}
                >
                  <TableCell>
                    {/* El enlace hace la fila accesible con teclado y lectores de pantalla. */}
                    <Link href={`/presupuestos/${p.id}`} className="font-mono underline-offset-4 hover:underline">
                      {formatearNumero(p.numero)}
                    </Link>
                  </TableCell>
                  <TableCell>{p.clienteNombre}</TableCell>
                  <TableCell className="hidden sm:table-cell">{formatearFecha(p.fechaEmision)}</TableCell>
                  <TableCell>
                    <EtiquetaEstado estado={p.estado} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatearDinero(p.total, datos!.monedaBase)}
                    {p.moneda !== datos!.monedaBase && (
                      <span className="ml-1 text-xs text-zinc-500">({p.moneda})</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {visibles.length === 0 && (
            <p className="text-center text-sm text-zinc-500">Ningún presupuesto coincide con el filtro.</p>
          )}
        </>
      )}
    </>
  );
}
