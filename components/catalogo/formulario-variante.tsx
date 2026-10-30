"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { obtenerRepositorio, type Producto, type Variante } from "@/lib/datos";
import { formatearNumero } from "@/lib/formato";
import { numero, texto } from "@/lib/formularios";
import { mensajeDeError } from "@/lib/use-datos";

interface Props {
  abierto: boolean;
  onCambiarAbierto: (abierto: boolean) => void;
  producto: Producto | null;
  /** Si viene, se edita; si no, se añade una nueva al producto. */
  variante: Variante | null;
  moneda: string;
  onGuardado: () => void;
}

export function FormularioVariante({ abierto, onCambiarAbierto, producto, variante, moneda, onGuardado }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!producto) return;
    const formulario = new FormData(evento.currentTarget);
    const datos = { nombre: texto(formulario, "nombre") ?? "", precio: numero(formulario, "precio") };

    setGuardando(true);
    setError(null);
    try {
      const repo = await obtenerRepositorio();
      if (variante) await repo.variantes.actualizar(variante.id, datos);
      else await repo.variantes.crear(producto.id, datos);
      toast.success(variante ? "Variante actualizada." : "Variante añadida.");
      onCambiarAbierto(false);
      onGuardado();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog
      open={abierto}
      onOpenChange={(valor) => {
        if (valor) setError(null);
        onCambiarAbierto(valor);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{variante ? "Editar variante" : "Nueva variante"}</DialogTitle>
          <DialogDescription>{producto?.nombre}</DialogDescription>
        </DialogHeader>
        <form key={variante?.id ?? producto?.id ?? "nueva"} onSubmit={guardar} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="variante-nombre">Nombre</Label>
            <Input
              id="variante-nombre"
              name="nombre"
              placeholder="Ej.: 500 unidades, Plan básico, 2 x 3 m"
              defaultValue={variante?.nombre}
              required
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="variante-precio">Precio ({moneda})</Label>
            <Input
              id="variante-precio"
              name="precio"
              inputMode="decimal"
              placeholder="0,00"
              defaultValue={variante ? formatearNumero(variante.precio) : ""}
              required
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onCambiarAbierto(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
