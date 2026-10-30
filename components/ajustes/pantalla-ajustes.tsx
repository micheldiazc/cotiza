"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorDatos, obtenerRepositorio, type AjustesNegocio } from "@/lib/datos";
import { formatearNumero } from "@/lib/formato";
import { numero, texto } from "@/lib/formularios";
import { mensajeDeError, useDatos } from "@/lib/use-datos";
import { TarjetaTasas } from "./tarjeta-tasas";

const MONEDAS_SUGERIDAS = [
  ["USD", "Dólar estadounidense"],
  ["EUR", "Euro"],
  ["VES", "Bolívar venezolano"],
  ["COP", "Peso colombiano"],
  ["MXN", "Peso mexicano"],
  ["ARS", "Peso argentino"],
  ["CLP", "Peso chileno"],
  ["PEN", "Sol peruano"],
];

function validar(ajustes: AjustesNegocio) {
  if (!/^[A-Z]{3}$/.test(ajustes.monedaBase)) {
    throw new ErrorDatos("validacion", "La moneda debe ser un código de 3 letras, como USD.");
  }
  if (!Number.isFinite(ajustes.ivaPorcentaje) || ajustes.ivaPorcentaje < 0 || ajustes.ivaPorcentaje > 100) {
    throw new ErrorDatos("validacion", "El IVA debe estar entre 0 y 100.");
  }
}

export function PantallaAjustes() {
  const { datos: ajustes, cargando, error: errorCarga, recargar } = useDatos((repo) => repo.ajustes.obtener());
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [moneda, setMoneda] = useState<string | null>(null);

  async function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = new FormData(evento.currentTarget);
    const nuevos: AjustesNegocio = {
      nombreNegocio: texto(formulario, "nombreNegocio"),
      documento: texto(formulario, "documento"),
      telefono: texto(formulario, "telefono"),
      email: texto(formulario, "email"),
      direccion: texto(formulario, "direccion"),
      monedaBase: (texto(formulario, "monedaBase") ?? "").toUpperCase(),
      ivaPorcentaje: numero(formulario, "ivaPorcentaje"),
    };

    setGuardando(true);
    setError(null);
    try {
      validar(nuevos);
      const repo = await obtenerRepositorio();
      await repo.ajustes.guardar(nuevos);
      toast.success("Ajustes guardados.");
      setMoneda(null);
      recargar();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  }

  const cambiaMoneda = ajustes && moneda !== null && moneda.toUpperCase() !== ajustes.monedaBase;

  return (
    <>
      <h1 className="text-2xl font-semibold">Ajustes del negocio</h1>
      {errorCarga && <p className="text-sm text-red-600">{errorCarga}</p>}
      {cargando && <p className="text-zinc-400">Cargando ajustes…</p>}

      {ajustes && (
        <form onSubmit={guardar} className="grid max-w-2xl gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Datos del negocio</CardTitle>
              <CardDescription>Aparecerán en la cabecera de tus presupuestos.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="ajustes-nombre">Nombre comercial</Label>
                <Input id="ajustes-nombre" name="nombreNegocio" defaultValue={ajustes.nombreNegocio ?? ""} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="ajustes-documento">Documento fiscal (RIF, NIF…)</Label>
                  <Input id="ajustes-documento" name="documento" defaultValue={ajustes.documento ?? ""} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ajustes-telefono">Teléfono</Label>
                  <Input id="ajustes-telefono" name="telefono" type="tel" defaultValue={ajustes.telefono ?? ""} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ajustes-email">Correo</Label>
                <Input id="ajustes-email" name="email" type="email" defaultValue={ajustes.email ?? ""} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ajustes-direccion">Dirección</Label>
                <Input id="ajustes-direccion" name="direccion" defaultValue={ajustes.direccion ?? ""} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Precios e impuestos</CardTitle>
              <CardDescription>Valores por defecto para los presupuestos nuevos.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="ajustes-moneda">Moneda base</Label>
                <Input
                  id="ajustes-moneda"
                  name="monedaBase"
                  list="monedas-sugeridas"
                  maxLength={3}
                  className="uppercase"
                  defaultValue={ajustes.monedaBase}
                  onChange={(e) => setMoneda(e.target.value)}
                  required
                />
                <datalist id="monedas-sugeridas">
                  {MONEDAS_SUGERIDAS.map(([codigo, nombre]) => (
                    <option key={codigo} value={codigo}>
                      {nombre}
                    </option>
                  ))}
                </datalist>
                <p className="text-xs text-zinc-500">La moneda de los precios del catálogo.</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ajustes-iva">IVA por defecto (%)</Label>
                <Input
                  id="ajustes-iva"
                  name="ivaPorcentaje"
                  inputMode="decimal"
                  defaultValue={formatearNumero(ajustes.ivaPorcentaje)}
                  required
                />
                <p className="text-xs text-zinc-500">Se puede cambiar en cada presupuesto.</p>
              </div>
              {cambiaMoneda && (
                <p role="status" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 sm:col-span-2">
                  Cambiar la moneda base no convierte los precios del catálogo: seguirán con el mismo número.
                  Revísalos después de guardar.
                </p>
              )}
            </CardContent>
          </Card>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <div>
            <Button type="submit" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar ajustes"}
            </Button>
          </div>
        </form>
      )}

      {ajustes && <TarjetaTasas monedaBase={ajustes.monedaBase} />}
    </>
  );
}
