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
import { Textarea } from "@/components/ui/textarea";
import { obtenerRepositorio, type Producto } from "@/lib/datos";
import { texto } from "@/lib/formularios";
import { mensajeDeError } from "@/lib/use-datos";

interface Props {
  abierto: boolean;
  onCambiarAbierto: (abierto: boolean) => void;
  producto: Producto | null;
  onGuardado: () => void;
}

export function FormularioProducto({ abierto, onCambiarAbierto, producto, onGuardado }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = new FormData(evento.currentTarget);
    const datos = {
      nombre: texto(formulario, "nombre") ?? "",
      descripcion: texto(formulario, "descripcion"),
    };

    setGuardando(true);
    setError(null);
    try {
      const repo = await obtenerRepositorio();
      if (producto) await repo.productos.actualizar(producto.id, datos);
      else await repo.productos.crear(datos);
      toast.success(producto ? "Producto actualizado." : "Producto creado. Ahora añádele variantes con su precio.");
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
          <DialogTitle>{producto ? "Editar producto" : "Nuevo producto o servicio"}</DialogTitle>
          <DialogDescription>
            Los precios van en las variantes (por ejemplo, «100 unidades» o «Plan básico»).
          </DialogDescription>
        </DialogHeader>
        <form key={producto?.id ?? "nuevo"} onSubmit={guardar} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="producto-nombre">Nombre</Label>
            <Input id="producto-nombre" name="nombre" defaultValue={producto?.nombre} required autoFocus />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="producto-descripcion">Descripción</Label>
            <Textarea
              id="producto-descripcion"
              name="descripcion"
              rows={2}
              defaultValue={producto?.descripcion ?? ""}
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
