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
import { obtenerRepositorio, type Cliente, type DatosCliente } from "@/lib/datos";
import { texto } from "@/lib/formularios";
import { mensajeDeError } from "@/lib/use-datos";

interface Props {
  abierto: boolean;
  onCambiarAbierto: (abierto: boolean) => void;
  /** Si viene, se edita; si no, se crea uno nuevo. */
  cliente: Cliente | null;
  onGuardado: () => void;
}

export function FormularioCliente({ abierto, onCambiarAbierto, cliente, onGuardado }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = new FormData(evento.currentTarget);
    const datos: DatosCliente = {
      nombre: texto(formulario, "nombre") ?? "",
      documento: texto(formulario, "documento"),
      telefono: texto(formulario, "telefono"),
      email: texto(formulario, "email"),
      direccion: texto(formulario, "direccion"),
      notas: texto(formulario, "notas"),
    };

    setGuardando(true);
    setError(null);
    try {
      const repo = await obtenerRepositorio();
      if (cliente) await repo.clientes.actualizar(cliente.id, datos);
      else await repo.clientes.crear(datos);
      toast.success(cliente ? "Cliente actualizado." : "Cliente creado.");
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{cliente ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
          <DialogDescription>Solo el nombre es obligatorio.</DialogDescription>
        </DialogHeader>

        {/* key: al cambiar de cliente, el formulario se vuelve a montar con sus valores. */}
        <form key={cliente?.id ?? "nuevo"} onSubmit={guardar} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="cliente-nombre">Nombre o razón social</Label>
            <Input id="cliente-nombre" name="nombre" defaultValue={cliente?.nombre} required autoFocus />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="cliente-documento">Documento (RIF, cédula…)</Label>
              <Input id="cliente-documento" name="documento" defaultValue={cliente?.documento ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cliente-telefono">Teléfono</Label>
              <Input id="cliente-telefono" name="telefono" type="tel" defaultValue={cliente?.telefono ?? ""} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cliente-email">Correo</Label>
            <Input id="cliente-email" name="email" type="email" defaultValue={cliente?.email ?? ""} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cliente-direccion">Dirección</Label>
            <Input id="cliente-direccion" name="direccion" defaultValue={cliente?.direccion ?? ""} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cliente-notas">Notas</Label>
            <Textarea id="cliente-notas" name="notas" rows={2} defaultValue={cliente?.notas ?? ""} />
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
