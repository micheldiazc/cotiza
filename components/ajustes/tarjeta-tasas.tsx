"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { obtenerTasasBcv } from "@/lib/bcv";
import { obtenerRepositorio, type Repositorio } from "@/lib/datos";
import { formatearFecha, formatearNumero } from "@/lib/formato";
import { leerNumero } from "@/lib/formularios";
import { mensajeDeError, useDatos } from "@/lib/use-datos";

/** Registra la tasa salvo que ya exista la misma ese día (evita duplicados al pulsar dos veces). */
async function registrarSiCambia(repo: Repositorio, monedaOrigen: string, valor: number, fecha: string) {
  const ultima = await repo.tasas.ultima(monedaOrigen, "VES");
  if (ultima && ultima.fecha === fecha && ultima.valor === valor) return false;
  await repo.tasas.registrar({ monedaOrigen, monedaDestino: "VES", valor, fuente: "bcv", fecha });
  return true;
}

export function TarjetaTasas({ monedaBase }: { monedaBase: string }) {
  const { datos: tasas, cargando, error, recargar } = useDatos((repo) => repo.tasas.listar());
  const [ocupado, setOcupado] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);

  async function traerBcv() {
    setOcupado(true);
    try {
      const bcv = await obtenerTasasBcv();
      const repo = await obtenerRepositorio();
      const nuevas = [
        await registrarSiCambia(repo, "USD", bcv.usd, bcv.fecha),
        await registrarSiCambia(repo, "EUR", bcv.eur, bcv.fecha),
      ].filter(Boolean).length;
      const resumen = `1 USD = ${formatearNumero(bcv.usd, 4)} Bs · 1 EUR = ${formatearNumero(bcv.eur, 4)} Bs`;
      if (bcv.ejemplo) toast.info(`Demo: tasas de ejemplo. ${resumen}`);
      else if (nuevas === 0) toast.info(`Ya tenías la tasa BCV de hoy. ${resumen}`);
      else toast.success(`Tasa BCV del ${formatearFecha(bcv.fecha)} guardada. ${resumen}`);
      recargar();
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  }

  async function anadirManual(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const datos = new FormData(formulario);
    setErrorFormulario(null);
    setOcupado(true);
    try {
      const repo = await obtenerRepositorio();
      await repo.tasas.registrar({
        monedaOrigen: String(datos.get("origen") ?? "").trim().toUpperCase(),
        monedaDestino: String(datos.get("destino") ?? "").trim().toUpperCase(),
        valor: leerNumero(String(datos.get("valor") ?? "")),
        fuente: "manual",
      });
      toast.success("Tasa guardada.");
      formulario.reset();
      recargar();
    } catch (e) {
      setErrorFormulario(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Tasas de cambio</CardTitle>
        <CardDescription>
          Al hacer un presupuesto en otra moneda se propone la última tasa registrada. Cada presupuesto guarda la
          suya, así que cambiar la tasa no altera los ya hechos.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={traerBcv} disabled={ocupado}>
            {ocupado ? "Consultando…" : "Traer tasa BCV"}
          </Button>
          <p className="text-sm text-zinc-500">Tasa oficial de bolívares por dólar y por euro.</p>
        </div>

        <form onSubmit={anadirManual} className="grid gap-3 sm:grid-cols-[6rem_6rem_1fr_auto] sm:items-end">
          <div className="grid gap-1">
            <Label htmlFor="tasa-origen" className="text-xs">
              De
            </Label>
            <Input id="tasa-origen" name="origen" maxLength={3} className="uppercase" defaultValue={monedaBase} required />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="tasa-destino" className="text-xs">
              A
            </Label>
            <Input id="tasa-destino" name="destino" maxLength={3} className="uppercase" placeholder="VES" required />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="tasa-valor" className="text-xs">
              Valor (1 de origen = ?)
            </Label>
            <Input id="tasa-valor" name="valor" inputMode="decimal" placeholder="0,00" required />
          </div>
          <Button type="submit" variant="outline" disabled={ocupado}>
            Añadir a mano
          </Button>
          {errorFormulario && (
            <p role="alert" className="text-sm text-red-600 sm:col-span-4">
              {errorFormulario}
            </p>
          )}
        </form>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {cargando && <p className="text-zinc-400">Cargando tasas…</p>}
        {tasas && tasas.length === 0 && <p className="text-sm text-zinc-500">Todavía no hay tasas registradas.</p>}
        {tasas && tasas.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Par</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Fuente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasas.slice(0, 15).map((tasa) => (
                <TableRow key={tasa.id}>
                  <TableCell>{formatearFecha(tasa.fecha)}</TableCell>
                  <TableCell>
                    {tasa.monedaOrigen} → {tasa.monedaDestino}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatearNumero(tasa.valor, 4)}</TableCell>
                  <TableCell>
                    <Badge variant={tasa.fuente === "bcv" ? "default" : "secondary"}>
                      {tasa.fuente === "bcv" ? "BCV" : "Manual"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
