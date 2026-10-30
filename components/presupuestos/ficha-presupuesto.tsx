"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmarBorrado } from "@/components/confirmar-borrado";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  convertirItems,
  formatearNumero as formatearNumeroPresupuesto,
  obtenerRepositorio,
  totalesEnMoneda,
  transicionPermitida,
  type EstadoPresupuesto,
} from "@/lib/datos";
import { formatearDinero, formatearFecha, formatearNumero } from "@/lib/formato";
import { mensajeDeError, useDatos } from "@/lib/use-datos";
import { TablaTotales } from "./editor-presupuesto";
import { EtiquetaEstado, NOMBRE_ESTADO } from "./etiqueta-estado";

const ACCIONES: { hacia: EstadoPresupuesto; texto: string; variante: "default" | "outline" }[] = [
  { hacia: "enviado", texto: "Marcar como enviado", variante: "default" },
  { hacia: "aceptado", texto: "Marcar como aceptado", variante: "default" },
  { hacia: "rechazado", texto: "Marcar como rechazado", variante: "outline" },
  { hacia: "borrador", texto: "Volver a borrador", variante: "outline" },
];

export function FichaPresupuesto({ id }: { id: string }) {
  const router = useRouter();
  const { datos, cargando, error, recargar } = useDatos(async (repo) => {
    const presupuesto = await repo.presupuestos.obtener(id);
    const [cliente, ajustes] = await Promise.all([
      presupuesto ? repo.clientes.obtener(presupuesto.clienteId) : Promise.resolve(null),
      repo.ajustes.obtener(),
    ]);
    return { presupuesto, cliente, ajustes };
  });
  const [ocupado, setOcupado] = useState(false);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (cargando || !datos) return <p className="text-zinc-400">Cargando presupuesto…</p>;

  const { presupuesto, cliente, ajustes } = datos;
  if (!presupuesto) {
    return (
      <div className="grid justify-items-start gap-3">
        <p className="text-zinc-600">Este presupuesto no existe.</p>
        <Link href="/presupuestos" className={buttonVariants({ variant: "outline" })}>
          Ver todos los presupuestos
        </Link>
      </div>
    );
  }

  const numero = formatearNumeroPresupuesto(presupuesto.numero);
  const items = convertirItems(presupuesto.items, presupuesto.tasa);
  const totales = totalesEnMoneda(
    presupuesto.items,
    presupuesto.descuentoPorcentaje,
    presupuesto.ivaPorcentaje,
    presupuesto.tasa,
  );
  const otraMoneda = presupuesto.moneda !== ajustes.monedaBase;

  async function cambiarEstado(hacia: EstadoPresupuesto) {
    setOcupado(true);
    try {
      const repo = await obtenerRepositorio();
      await repo.presupuestos.cambiarEstado(id, hacia);
      toast.success(`${numero} ahora está ${NOMBRE_ESTADO[hacia].toLowerCase()}.`);
      recargar();
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  }

  async function pdf() {
    setOcupado(true);
    try {
      const { descargarPdf } = await import("@/lib/pdf");
      await descargarPdf({ presupuesto: presupuesto!, cliente, ajustes });
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <Link href="/presupuestos" className="text-sm text-zinc-500 hover:underline">
            ← Presupuestos
          </Link>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold">
            <span className="font-mono">{numero}</span>
            <EtiquetaEstado estado={presupuesto.estado} />
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={pdf} disabled={ocupado}>
            Descargar PDF
          </Button>
          {presupuesto.estado === "borrador" && (
            <Link href={`/presupuestos/${id}/editar`} className={buttonVariants({ variant: "outline" })}>
              Editar
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Cambiar estado">
        {ACCIONES.filter((a) => transicionPermitida(presupuesto.estado, a.hacia)).map((accion) => (
          <Button
            key={accion.hacia}
            variant={accion.variante}
            size="sm"
            disabled={ocupado}
            onClick={() => cambiarEstado(accion.hacia)}
          >
            {accion.texto}
          </Button>
        ))}
        {presupuesto.estado === "aceptado" && (
          <p className="text-sm text-zinc-500">Presupuesto aceptado: ya no cambia de estado.</p>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cliente</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm">
            <p className="font-medium">{cliente?.nombre ?? "—"}</p>
            {[cliente?.documento, cliente?.email, cliente?.telefono, cliente?.direccion]
              .filter(Boolean)
              .map((dato) => (
                <p key={dato} className="text-zinc-600">
                  {dato}
                </p>
              ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Datos</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-zinc-500">Emisión</dt>
              <dd>{formatearFecha(presupuesto.fechaEmision)}</dd>
              <dt className="text-zinc-500">Válido hasta</dt>
              <dd>{formatearFecha(presupuesto.fechaVencimiento) || "—"}</dd>
              <dt className="text-zinc-500">Moneda</dt>
              <dd>
                {presupuesto.moneda}
                {otraMoneda &&
                  ` (1 ${ajustes.monedaBase} = ${formatearNumero(presupuesto.tasa, 4)} ${presupuesto.moneda})`}
              </dd>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Líneas</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Cant.</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Importe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="whitespace-normal">{item.descripcion}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatearNumero(item.cantidad).replace(/,00$/, "")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatearDinero(item.precioUnitario, presupuesto.moneda)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatearDinero(item.cantidad * item.precioUnitario, presupuesto.moneda)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="ml-auto w-full max-w-sm">
            <TablaTotales
              totales={totales}
              moneda={presupuesto.moneda}
              descuento={presupuesto.descuentoPorcentaje}
              iva={presupuesto.ivaPorcentaje}
            />
            {otraMoneda && (
              <p className="mt-2 text-right text-xs text-zinc-500">
                Equivale a {formatearDinero(presupuesto.total, ajustes.monedaBase)}
              </p>
            )}
          </div>
          {presupuesto.notas && (
            <div className="grid gap-1">
              <p className="text-xs uppercase text-zinc-500">Notas</p>
              <p className="whitespace-pre-line text-sm">{presupuesto.notas}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <ConfirmarBorrado
          etiqueta={`Borrar el presupuesto ${numero}`}
          titulo={`¿Borrar ${numero}?`}
          descripcion="Se borrará con todas sus líneas. Esta acción no se puede deshacer."
          mensajeExito={`${numero} borrado.`}
          onConfirmar={async () => {
            const repo = await obtenerRepositorio();
            await repo.presupuestos.eliminar(id);
            router.push("/presupuestos");
          }}
        />
      </div>
    </>
  );
}
