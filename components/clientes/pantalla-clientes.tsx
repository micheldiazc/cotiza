"use client";

import { useState } from "react";
import { ConfirmarBorrado } from "@/components/confirmar-borrado";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { obtenerRepositorio, type Cliente } from "@/lib/datos";
import { coincide } from "@/lib/formato";
import { useDatos } from "@/lib/use-datos";
import { FormularioCliente } from "./formulario-cliente";

export function PantallaClientes() {
  const { datos: clientes, cargando, error, recargar } = useDatos((repo) => repo.clientes.listar());
  const [busqueda, setBusqueda] = useState("");
  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);

  const visibles = (clientes ?? []).filter((c) =>
    coincide(busqueda, [c.nombre, c.documento, c.email, c.telefono]),
  );

  function abrir(cliente: Cliente | null) {
    setEditando(cliente);
    setFormularioAbierto(true);
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Clientes</h1>
        <Button onClick={() => abrir(null)}>Nuevo cliente</Button>
      </div>

      <Input
        type="search"
        placeholder="Buscar por nombre, documento, correo o teléfono"
        aria-label="Buscar clientes"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="max-w-md"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {cargando && <p className="text-zinc-400">Cargando clientes…</p>}

      {clientes && clientes.length === 0 && (
        <p className="rounded-lg border border-dashed p-8 text-center text-zinc-500">
          Todavía no tienes clientes. Crea el primero con «Nuevo cliente».
        </p>
      )}

      {clientes && clientes.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="hidden sm:table-cell">Documento</TableHead>
                <TableHead className="hidden md:table-cell">Contacto</TableHead>
                <TableHead className="w-0">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibles.map((cliente) => (
                <TableRow key={cliente.id}>
                  <TableCell className="font-medium">{cliente.nombre}</TableCell>
                  <TableCell className="hidden sm:table-cell">{cliente.documento}</TableCell>
                  <TableCell className="hidden text-zinc-600 md:table-cell">
                    {[cliente.email, cliente.telefono].filter(Boolean).join(" · ")}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Editar ${cliente.nombre}`}
                        onClick={() => abrir(cliente)}
                      >
                        Editar
                      </Button>
                      <ConfirmarBorrado
                        etiqueta={`Borrar ${cliente.nombre}`}
                        titulo={`¿Borrar a ${cliente.nombre}?`}
                        descripcion="Esta acción no se puede deshacer."
                        mensajeExito="Cliente borrado."
                        onConfirmar={async () => {
                          const repo = await obtenerRepositorio();
                          await repo.clientes.eliminar(cliente.id);
                          recargar();
                        }}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {visibles.length === 0 && (
            <p className="text-center text-sm text-zinc-500">Ningún cliente coincide con «{busqueda}».</p>
          )}
        </>
      )}

      <FormularioCliente
        abierto={formularioAbierto}
        onCambiarAbierto={setFormularioAbierto}
        cliente={editando}
        onGuardado={recargar}
      />
    </>
  );
}
