"use client";

import { ArrowRight, CheckCircle2, Clock, FileText, Plus, TrendingUp, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { EtiquetaEstado } from "@/components/presupuestos/etiqueta-estado";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatearNumero as formatearNumeroPresupuesto, hoy } from "@/lib/datos";
import { formatearDinero, formatearDineroCorto, formatearFecha } from "@/lib/formato";
import { calcularMetricas, type VentasMes } from "@/lib/metricas";
import { useDatos } from "@/lib/use-datos";
import { cn } from "@/lib/utils";

function Tarjeta({
  titulo,
  valor,
  detalle,
  icono: Icono,
  estilo,
}: {
  titulo: string;
  valor: string;
  detalle: string;
  icono: LucideIcon;
  estilo: string;
}) {
  return (
    <div className={cn("grid gap-1 rounded-xl border p-5 shadow-xs", estilo)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider opacity-80">{titulo}</span>
        <Icono className="size-4 opacity-80" aria-hidden />
      </div>
      <p className="text-2xl font-bold tabular-nums">{valor}</p>
      <p className="text-xs opacity-70">{detalle}</p>
    </div>
  );
}

function GraficoVentas({ meses, moneda }: { meses: VentasMes[]; moneda: string }) {
  const maximo = Math.max(...meses.map((m) => m.total), 0);
  const resumen = meses.map((m) => `${m.etiqueta}: ${formatearDinero(m.total, moneda)}`).join(", ");

  return (
    <figure className="grid gap-3">
      {/* Para lectores de pantalla, el gráfico se describe como texto. */}
      <ul aria-label={`Ventas aceptadas por mes. ${resumen}`} className="flex h-48 items-end gap-2 sm:gap-4">
        {meses.map((m) => {
          const altura = maximo > 0 ? Math.max((m.total / maximo) * 100, m.total > 0 ? 3 : 0) : 0;
          return (
            <li key={m.mes} className="flex h-full flex-1 flex-col items-center gap-1" aria-hidden>
              {/* La barra vive en su propio contenedor (flex-1): así el % se calcula sobre
                  el espacio libre y no sobre la columna entera con sus etiquetas. */}
              <div className="flex w-full flex-1 items-end justify-center pt-5">
                <div
                  className="relative w-full max-w-14 rounded-t-md bg-primary/80 transition-colors hover:bg-primary"
                  style={{ height: `${altura}%` }}
                  title={`${m.etiqueta}: ${formatearDinero(m.total, moneda)}`}
                >
                  {m.total > 0 && (
                    <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap text-[11px] text-zinc-500 tabular-nums">
                      {formatearDineroCorto(m.total, moneda)}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-xs text-zinc-600">{m.etiqueta}</span>
            </li>
          );
        })}
      </ul>
      <figcaption className="text-xs text-zinc-500">
        Presupuestos aceptados, agrupados por su mes de emisión. Importes en {moneda}.
      </figcaption>
    </figure>
  );
}

export function PanelControl({ sesion }: { sesion?: React.ReactNode }) {
  const { datos, cargando, error } = useDatos(async (repo) => {
    const [presupuestos, ajustes] = await Promise.all([repo.presupuestos.listar(), repo.ajustes.obtener()]);
    return { presupuestos, ajustes };
  });

  const moneda = datos?.ajustes.monedaBase ?? "USD";
  const metricas = datos ? calcularMetricas(datos.presupuestos, hoy()) : null;
  const ultimos = datos?.presupuestos.slice(0, 5) ?? [];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Panel de control</h1>
          <p className="text-sm text-zinc-500">
            {datos?.ajustes.nombreNegocio ? `Resumen de ${datos.ajustes.nombreNegocio}.` : "Resumen de tu negocio."}
          </p>
          {sesion}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {cargando && <p className="text-zinc-400">Cargando panel…</p>}

      {metricas && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Tarjeta
            titulo="Ventas aceptadas"
            valor={formatearDinero(metricas.ventasAceptadas, moneda)}
            detalle={`${metricas.aceptados} presupuesto${metricas.aceptados === 1 ? "" : "s"} aceptado${metricas.aceptados === 1 ? "" : "s"}`}
            icono={TrendingUp}
            estilo="border-primary/20 bg-primary/5 text-primary"
          />
          <Tarjeta
            titulo="Emitidos"
            valor={String(metricas.emitidos)}
            detalle={`Sin contar ${metricas.borradores} borrador${metricas.borradores === 1 ? "" : "es"}`}
            icono={FileText}
            estilo="bg-card text-zinc-800 dark:text-zinc-100"
          />
          <Tarjeta
            titulo="Pendientes"
            valor={String(metricas.pendientes)}
            detalle="Enviados, esperando respuesta"
            icono={Clock}
            estilo="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
          />
          <Tarjeta
            titulo="Tasa de aceptación"
            valor={metricas.tasaAceptacion === null ? "—" : `${Math.round(metricas.tasaAceptacion * 100)} %`}
            detalle={`${metricas.aceptados} de ${metricas.aceptados + metricas.rechazados} con respuesta`}
            icono={CheckCircle2}
            estilo="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
          />
        </div>
      )}

      {metricas && datos && datos.presupuestos.length === 0 && (
        <div className="grid justify-items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <p className="text-zinc-600">Todavía no hay presupuestos. Cuando los hagas, aquí verás tus ventas.</p>
          <Link href="/presupuestos/nuevo" className={buttonVariants()}>
            <Plus className="size-4" aria-hidden />
            Crear el primero
          </Link>
        </div>
      )}

      {metricas && datos && datos.presupuestos.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Ventas de los últimos 6 meses</CardTitle>
              <CardDescription>Total aceptado por mes.</CardDescription>
            </CardHeader>
            <CardContent>
              <GraficoVentas meses={metricas.ventasPorMes} moneda={moneda} />
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Últimos presupuestos</CardTitle>
                <Link
                  href="/presupuestos"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Ver todos <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ultimos.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link
                          href={`/presupuestos/${p.id}`}
                          className="font-mono text-sm underline-offset-4 hover:underline"
                        >
                          {formatearNumeroPresupuesto(p.numero)}
                        </Link>
                        <div className="mt-1">
                          <EtiquetaEstado estado={p.estado} />
                        </div>
                      </TableCell>
                      <TableCell className="max-w-32 truncate whitespace-nowrap">
                        {p.clienteNombre}
                        <div className="text-xs text-zinc-500">{formatearFecha(p.fechaEmision)}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatearDinero(p.total, moneda)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
