"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { mensajeDeError } from "@/lib/use-datos";

interface Props {
  titulo: string;
  descripcion: string;
  /** Texto accesible del botón que abre el diálogo, p. ej. "Borrar Ana Pérez". */
  etiqueta: string;
  onConfirmar: () => Promise<void>;
  mensajeExito: string;
}

export function ConfirmarBorrado({ titulo, descripcion, etiqueta, onConfirmar, mensajeExito }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [borrando, setBorrando] = useState(false);

  async function confirmar() {
    setBorrando(true);
    try {
      await onConfirmar();
      toast.success(mensajeExito);
      setAbierto(false);
    } catch (error) {
      // Por ejemplo: "No se puede borrar un cliente que tiene presupuestos."
      toast.error(mensajeDeError(error));
      setAbierto(false);
    } finally {
      setBorrando(false);
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" aria-label={etiqueta} onClick={() => setAbierto(true)}>
        Borrar
      </Button>
      <AlertDialog open={abierto} onOpenChange={setAbierto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{titulo}</AlertDialogTitle>
            <AlertDialogDescription>{descripcion}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={borrando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmar} disabled={borrando}>
              {borrando ? "Borrando…" : "Borrar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
