"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ConfirmarBorrado } from "@/components/confirmar-borrado";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { obtenerRepositorio, type Producto, type Variante } from "@/lib/datos";
import { coincide, formatearDinero } from "@/lib/formato";
import { mensajeDeError, useDatos } from "@/lib/use-datos";
import { FormularioProducto } from "./formulario-producto";
import { FormularioVariante } from "./formulario-variante";

export function PantallaCatalogo() {
  const { datos, cargando, error, recargar } = useDatos(async (repo) => {
    const [productos, ajustes] = await Promise.all([repo.productos.listar(), repo.ajustes.obtener()]);
    return { productos, moneda: ajustes.monedaBase };
  });
  const [busqueda, setBusqueda] = useState("");

  const [productoAbierto, setProductoAbierto] = useState(false);
  const [productoEditando, setProductoEditando] = useState<Producto | null>(null);

  const [varianteAbierta, setVarianteAbierta] = useState(false);
  const [varianteProducto, setVarianteProducto] = useState<Producto | null>(null);
  const [varianteEditando, setVarianteEditando] = useState<Variante | null>(null);

  const moneda = datos?.moneda ?? "USD";
  const visibles = (datos?.productos ?? []).filter((p) =>
    coincide(busqueda, [p.nombre, p.descripcion, ...p.variantes.map((v) => v.nombre)]),
  );

  function abrirProducto(producto: Producto | null) {
    setProductoEditando(producto);
    setProductoAbierto(true);
  }

  function abrirVariante(producto: Producto, variante: Variante | null) {
    setVarianteProducto(producto);
    setVarianteEditando(variante);
    setVarianteAbierta(true);
  }

  async function cambiarActivo(producto: Producto, activo: boolean) {
    try {
      const repo = await obtenerRepositorio();
      await repo.productos.actualizar(producto.id, { activo });
      toast.success(activo ? `«${producto.nombre}» vuelve a estar disponible.` : `«${producto.nombre}» desactivado.`);
      recargar();
    } catch (e) {
      toast.error(mensajeDeError(e));
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Catálogo</h1>
          <p className="text-sm text-zinc-500">Precios en {moneda}, la moneda base del negocio.</p>
        </div>
        <Button onClick={() => abrirProducto(null)}>Nuevo producto</Button>
      </div>

      <Input
        type="search"
        placeholder="Buscar productos o variantes"
        aria-label="Buscar en el catálogo"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="max-w-md"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {cargando && <p className="text-zinc-400">Cargando catálogo…</p>}

      {datos && datos.productos.length === 0 && (
        <p className="rounded-lg border border-dashed p-8 text-center text-zinc-500">
          Tu catálogo está vacío. Crea tu primer producto o servicio con «Nuevo producto».
        </p>
      )}

      <div className="grid gap-4">
        {visibles.map((producto) => (
          <Card key={producto.id} className={producto.activo ? undefined : "opacity-70"}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="grid gap-1">
                  <CardTitle className="flex items-center gap-2">
                    {producto.nombre}
                    {!producto.activo && <Badge variant="secondary">Inactivo</Badge>}
                  </CardTitle>
                  {producto.descripcion && <CardDescription>{producto.descripcion}</CardDescription>}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <label className="mr-2 flex items-center gap-2 text-sm text-zinc-600">
                    <Switch
                      checked={producto.activo}
                      onCheckedChange={(activo) => cambiarActivo(producto, activo)}
                      aria-label={`${producto.nombre} disponible para presupuestos nuevos`}
                    />
                    Disponible
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Editar ${producto.nombre}`}
                    onClick={() => abrirProducto(producto)}
                  >
                    Editar
                  </Button>
                  <ConfirmarBorrado
                    etiqueta={`Borrar ${producto.nombre}`}
                    titulo={`¿Borrar «${producto.nombre}»?`}
                    descripcion="Se borrarán también sus variantes. Los presupuestos ya hechos conservan sus líneas. Si solo quieres dejar de ofrecerlo, desactívalo."
                    mensajeExito="Producto borrado."
                    onConfirmar={async () => {
                      const repo = await obtenerRepositorio();
                      await repo.productos.eliminar(producto.id);
                      recargar();
                    }}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3">
              {producto.variantes.length === 0 ? (
                <p className="text-sm text-zinc-500">Sin variantes todavía: añade al menos una con su precio.</p>
              ) : (
                <Table>
                  <TableBody>
                    {producto.variantes.map((variante) => (
                      <TableRow key={variante.id}>
                        <TableCell>{variante.nombre}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatearDinero(variante.precio, moneda)}
                        </TableCell>
                        <TableCell className="w-0">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Editar variante ${variante.nombre}`}
                              onClick={() => abrirVariante(producto, variante)}
                            >
                              Editar
                            </Button>
                            <ConfirmarBorrado
                              etiqueta={`Borrar variante ${variante.nombre}`}
                              titulo={`¿Borrar la variante «${variante.nombre}»?`}
                              descripcion="Los presupuestos que la usaban conservan la línea con su descripción y precio."
                              mensajeExito="Variante borrada."
                              onConfirmar={async () => {
                                const repo = await obtenerRepositorio();
                                await repo.variantes.eliminar(variante.id);
                                recargar();
                              }}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <div>
                <Button variant="outline" size="sm" onClick={() => abrirVariante(producto, null)}>
                  Añadir variante
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {datos && datos.productos.length > 0 && visibles.length === 0 && (
        <p className="text-center text-sm text-zinc-500">Nada coincide con «{busqueda}».</p>
      )}

      <FormularioProducto
        abierto={productoAbierto}
        onCambiarAbierto={setProductoAbierto}
        producto={productoEditando}
        onGuardado={recargar}
      />
      <FormularioVariante
        abierto={varianteAbierta}
        onCambiarAbierto={setVarianteAbierta}
        producto={varianteProducto}
        variante={varianteEditando}
        moneda={moneda}
        onGuardado={recargar}
      />
    </>
  );
}
