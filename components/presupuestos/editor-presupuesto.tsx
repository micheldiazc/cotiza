"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  calcularTotales,
  formatearNumero as formatearNumeroPresupuesto,
  hoy,
  obtenerRepositorio,
  totalesEnMoneda,
  type AjustesNegocio,
  type Cliente,
  type DatosPresupuesto,
  type Presupuesto,
  type Producto,
} from "@/lib/datos";
import { formatearDinero, formatearNumero } from "@/lib/formato";
import { leerNumero } from "@/lib/formularios";
import { mensajeDeError, useDatos } from "@/lib/use-datos";

/** Línea tal como está en el formulario: cantidades y precios como texto escrito. */
interface Linea {
  clave: string;
  varianteId: string | null;
  descripcion: string;
  cantidad: string;
  precio: string;
}

interface Formulario {
  clienteId: string;
  fechaEmision: string;
  fechaVencimiento: string;
  moneda: string;
  tasa: string;
  descuento: string;
  iva: string;
  notas: string;
  lineas: Linea[];
}

const nuevaClave = () => crypto.randomUUID();
const cero = (n: number) => (Number.isFinite(n) ? n : 0);

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function formularioInicial(ajustes: AjustesNegocio, presupuesto: Presupuesto | null): Formulario {
  if (presupuesto) {
    return {
      clienteId: presupuesto.clienteId,
      fechaEmision: presupuesto.fechaEmision,
      fechaVencimiento: presupuesto.fechaVencimiento ?? "",
      moneda: presupuesto.moneda,
      tasa: formatearNumero(presupuesto.tasa, 4),
      descuento: formatearNumero(presupuesto.descuentoPorcentaje),
      iva: formatearNumero(presupuesto.ivaPorcentaje),
      notas: presupuesto.notas ?? "",
      lineas: presupuesto.items.map((item) => ({
        clave: nuevaClave(),
        varianteId: item.varianteId,
        descripcion: item.descripcion,
        cantidad: formatearNumero(item.cantidad).replace(/,00$/, ""),
        precio: formatearNumero(item.precioUnitario),
      })),
    };
  }
  const emision = hoy();
  return {
    clienteId: "",
    fechaEmision: emision,
    fechaVencimiento: sumarDias(emision, 15),
    moneda: ajustes.monedaBase,
    tasa: "1",
    descuento: "0",
    iva: formatearNumero(ajustes.ivaPorcentaje),
    notas: "",
    lineas: [],
  };
}

/** Carga lo necesario y monta el formulario cuando todo está listo. */
export function EditorPresupuesto({ presupuestoId }: { presupuestoId?: string }) {
  const { datos, cargando, error } = useDatos(async (repo) => {
    const [clientes, productos, ajustes, presupuesto] = await Promise.all([
      repo.clientes.listar(),
      repo.productos.listar(),
      repo.ajustes.obtener(),
      presupuestoId ? repo.presupuestos.obtener(presupuestoId) : Promise.resolve(null),
    ]);
    return { clientes, productos, ajustes, presupuesto };
  });

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (cargando || !datos) return <p className="text-zinc-400">Cargando…</p>;

  if (presupuestoId && !datos.presupuesto) {
    return <p className="text-zinc-600">Este presupuesto no existe.</p>;
  }
  if (datos.presupuesto && datos.presupuesto.estado !== "borrador") {
    return (
      <div className="grid gap-3">
        <p className="text-zinc-600">Solo se pueden editar presupuestos en borrador.</p>
        <Link href={`/presupuestos/${datos.presupuesto.id}`} className={buttonVariants({ variant: "outline" })}>
          Volver al presupuesto
        </Link>
      </div>
    );
  }
  if (datos.clientes.length === 0) {
    return (
      <div className="grid justify-items-start gap-3">
        <p className="text-zinc-600">Para hacer un presupuesto necesitas al menos un cliente.</p>
        <Link href="/clientes" className={buttonVariants()}>
          Ir a clientes
        </Link>
      </div>
    );
  }

  return (
    <Formulario
      // Next conserva las páginas ocultas al navegar (Activity). Si al volver
      // se recarga una versión más nueva del presupuesto, el formulario se
      // monta de nuevo con ella en lugar de mostrar lo que había antes.
      key={datos.presupuesto?.actualizadoEn ?? "nuevo"}
      clientes={datos.clientes}
      productos={datos.productos}
      ajustes={datos.ajustes}
      presupuesto={datos.presupuesto}
    />
  );
}

function Formulario({
  clientes,
  productos,
  ajustes,
  presupuesto,
}: {
  clientes: Cliente[];
  productos: Producto[];
  ajustes: AjustesNegocio;
  presupuesto: Presupuesto | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState(() => formularioInicial(ajustes, presupuesto));
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const monedaBase = ajustes.monedaBase;
  const enOtraMoneda = form.moneda.toUpperCase() !== monedaBase;
  const tasa = enOtraMoneda ? leerNumero(form.tasa) : 1;

  const itemsNumericos = form.lineas.map((l) => ({
    cantidad: cero(leerNumero(l.cantidad)),
    precioUnitario: cero(leerNumero(l.precio)),
  }));
  const descuento = cero(leerNumero(form.descuento));
  const iva = cero(leerNumero(form.iva));
  const totales = calcularTotales(itemsNumericos, descuento, iva);
  const totalesConvertidos = enOtraMoneda && tasa > 0 ? totalesEnMoneda(itemsNumericos, descuento, iva, tasa) : null;

  // Solo se ofrecen productos y variantes activos; las líneas ya puestas se respetan.
  const opcionesCatalogo = productos
    .filter((p) => p.activo)
    .flatMap((p) =>
      p.variantes
        .filter((v) => v.activo)
        .map((v) => ({ id: v.id, descripcion: `${p.nombre} · ${v.nombre}`, precio: v.precio })),
    );

  const cambiar = <K extends keyof Formulario>(campo: K, valor: Formulario[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const cambiarLinea = (clave: string, cambios: Partial<Linea>) =>
    setForm((f) => ({ ...f, lineas: f.lineas.map((l) => (l.clave === clave ? { ...l, ...cambios } : l)) }));

  const quitarLinea = (clave: string) => setForm((f) => ({ ...f, lineas: f.lineas.filter((l) => l.clave !== clave) }));

  const moverLinea = (indice: number, direccion: -1 | 1) =>
    setForm((f) => {
      const lineas = [...f.lineas];
      const destino = indice + direccion;
      if (destino < 0 || destino >= lineas.length) return f;
      [lineas[indice], lineas[destino]] = [lineas[destino], lineas[indice]];
      return { ...f, lineas };
    });

  function anadirDelCatalogo(varianteId: string) {
    const opcion = opcionesCatalogo.find((o) => o.id === varianteId);
    if (!opcion) return;
    setForm((f) => ({
      ...f,
      lineas: [
        ...f.lineas,
        {
          clave: nuevaClave(),
          varianteId: opcion.id,
          descripcion: opcion.descripcion,
          cantidad: "1",
          precio: formatearNumero(opcion.precio),
        },
      ],
    }));
  }

  function anadirLibre() {
    setForm((f) => ({
      ...f,
      lineas: [...f.lineas, { clave: nuevaClave(), varianteId: null, descripcion: "", cantidad: "1", precio: "" }],
    }));
  }

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);
    if (form.lineas.length === 0) {
      setError("Añade al menos una línea.");
      return;
    }
    const datos: DatosPresupuesto = {
      clienteId: form.clienteId,
      moneda: form.moneda.trim().toUpperCase(),
      tasa,
      descuentoPorcentaje: leerNumero(form.descuento),
      ivaPorcentaje: leerNumero(form.iva),
      notas: form.notas.trim() || null,
      fechaEmision: form.fechaEmision,
      fechaVencimiento: form.fechaVencimiento || null,
      items: form.lineas.map((l) => ({
        varianteId: l.varianteId,
        descripcion: l.descripcion,
        cantidad: leerNumero(l.cantidad),
        precioUnitario: leerNumero(l.precio),
      })),
    };

    setGuardando(true);
    try {
      const repo = await obtenerRepositorio();
      const guardado = presupuesto
        ? await repo.presupuestos.actualizar(presupuesto.id, datos)
        : await repo.presupuestos.crear(datos);
      toast.success(`Presupuesto ${formatearNumeroPresupuesto(guardado.numero)} guardado.`);
      // La página queda oculta pero viva (Activity): sin esto, al volver a
      // "Nuevo presupuesto" aparecería el que acabamos de guardar.
      if (!presupuesto) setForm(formularioInicial(ajustes, null));
      setGuardando(false);
      router.push(`/presupuestos/${guardado.id}`);
    } catch (e) {
      setError(mensajeDeError(e));
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          {presupuesto ? `Editar ${formatearNumeroPresupuesto(presupuesto.numero)}` : "Nuevo presupuesto"}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos generales</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="grid gap-2 sm:col-span-2 lg:col-span-1">
            <Label htmlFor="p-cliente">Cliente</Label>
            <select
              id="p-cliente"
              required
              value={form.clienteId}
              onChange={(e) => cambiar("clienteId", e.target.value)}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="" disabled>
                Elige un cliente…
              </option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-emision">Fecha de emisión</Label>
            <Input
              id="p-emision"
              type="date"
              required
              value={form.fechaEmision}
              onChange={(e) => cambiar("fechaEmision", e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-vencimiento">Válido hasta</Label>
            <Input
              id="p-vencimiento"
              type="date"
              value={form.fechaVencimiento}
              min={form.fechaEmision}
              onChange={(e) => cambiar("fechaVencimiento", e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-moneda">Moneda del presupuesto</Label>
            <Input
              id="p-moneda"
              list="p-monedas"
              maxLength={3}
              className="uppercase"
              required
              value={form.moneda}
              onChange={(e) => cambiar("moneda", e.target.value.toUpperCase())}
            />
            <datalist id="p-monedas">
              {[monedaBase, "USD", "EUR", "VES"]
                .filter((m, i, todas) => todas.indexOf(m) === i)
                .map((m) => (
                  <option key={m} value={m} />
                ))}
            </datalist>
          </div>
          {enOtraMoneda && (
            <div className="grid gap-2">
              <Label htmlFor="p-tasa">
                Tasa (1 {monedaBase} = ? {form.moneda || "…"})
              </Label>
              <Input
                id="p-tasa"
                inputMode="decimal"
                required
                value={form.tasa}
                onChange={(e) => cambiar("tasa", e.target.value)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Líneas</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm text-zinc-500">Precios unitarios en {monedaBase}, la moneda base.</p>

          {form.lineas.length === 0 && (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-zinc-500">
              Añade productos del catálogo o una línea libre.
            </p>
          )}

          <ol className="grid gap-3">
            {form.lineas.map((linea, indice) => {
              const importe = itemsNumericos[indice].cantidad * itemsNumericos[indice].precioUnitario;
              return (
                <li
                  key={linea.clave}
                  className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_6rem_8rem_8rem_auto] sm:items-end"
                >
                  <div className="grid gap-1">
                    <Label htmlFor={`l-desc-${linea.clave}`} className="text-xs text-zinc-500">
                      Descripción
                    </Label>
                    <Input
                      id={`l-desc-${linea.clave}`}
                      required
                      value={linea.descripcion}
                      onChange={(e) => cambiarLinea(linea.clave, { descripcion: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor={`l-cant-${linea.clave}`} className="text-xs text-zinc-500">
                      Cantidad
                    </Label>
                    <Input
                      id={`l-cant-${linea.clave}`}
                      inputMode="decimal"
                      required
                      value={linea.cantidad}
                      onChange={(e) => cambiarLinea(linea.clave, { cantidad: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor={`l-precio-${linea.clave}`} className="text-xs text-zinc-500">
                      Precio unitario
                    </Label>
                    <Input
                      id={`l-precio-${linea.clave}`}
                      inputMode="decimal"
                      required
                      value={linea.precio}
                      onChange={(e) => cambiarLinea(linea.clave, { precio: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1">
                    <span className="text-xs text-zinc-500">Importe</span>
                    <span className="flex h-8 items-center justify-end tabular-nums">
                      {formatearDinero(importe, monedaBase)}
                    </span>
                  </div>
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Subir línea ${indice + 1}`}
                      disabled={indice === 0}
                      onClick={() => moverLinea(indice, -1)}
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Bajar línea ${indice + 1}`}
                      disabled={indice === form.lineas.length - 1}
                      onClick={() => moverLinea(indice, 1)}
                    >
                      ↓
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Quitar línea ${indice + 1}`}
                      onClick={() => quitarLinea(linea.clave)}
                    >
                      ✕
                    </Button>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Añadir del catálogo"
              value=""
              onChange={(e) => anadirDelCatalogo(e.target.value)}
              disabled={opcionesCatalogo.length === 0}
              className="h-8 max-w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="">
                {opcionesCatalogo.length === 0 ? "El catálogo está vacío" : "Añadir del catálogo…"}
              </option>
              {opcionesCatalogo.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.descripcion} — {formatearDinero(o.precio, monedaBase)}
                </option>
              ))}
            </select>
            <Button type="button" variant="outline" size="sm" onClick={anadirLibre}>
              Añadir línea libre
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Condiciones</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="p-descuento">Descuento (%)</Label>
              <Input
                id="p-descuento"
                inputMode="decimal"
                value={form.descuento}
                onChange={(e) => cambiar("descuento", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-iva">IVA (%)</Label>
              <Input id="p-iva" inputMode="decimal" value={form.iva} onChange={(e) => cambiar("iva", e.target.value)} />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="p-notas">Notas para el cliente</Label>
              <Textarea
                id="p-notas"
                rows={3}
                placeholder="Condiciones de pago, plazos de entrega…"
                value={form.notas}
                onChange={(e) => cambiar("notas", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Totales</CardTitle>
          </CardHeader>
          <CardContent>
            <TablaTotales totales={totales} moneda={monedaBase} descuento={descuento} iva={iva} />
            {totalesConvertidos && (
              <div className="mt-4 border-t pt-4">
                <p className="mb-2 text-sm text-zinc-500">
                  Lo que verá el cliente, en {form.moneda} (1 {monedaBase} = {formatearNumero(tasa, 4)} {form.moneda})
                </p>
                <TablaTotales totales={totalesConvertidos} moneda={form.moneda} descuento={descuento} iva={iva} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar presupuesto"}
        </Button>
        <Link
          href={presupuesto ? `/presupuestos/${presupuesto.id}` : "/presupuestos"}
          className={buttonVariants({ variant: "outline" })}
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}

export function TablaTotales({
  totales,
  moneda,
  descuento,
  iva,
}: {
  totales: ReturnType<typeof calcularTotales>;
  moneda: string;
  descuento: number;
  iva: number;
}) {
  const fila = (etiqueta: string, valor: number, fuerte = false) => (
    <div className={`flex justify-between gap-4 ${fuerte ? "border-t pt-2 text-base font-semibold" : "text-sm"}`}>
      <dt>{etiqueta}</dt>
      <dd className="tabular-nums">{formatearDinero(valor, moneda)}</dd>
    </div>
  );
  return (
    <dl className="grid gap-1.5">
      {fila("Subtotal", totales.subtotal)}
      {descuento > 0 && fila(`Descuento (${formatearNumero(descuento)} %)`, -totales.descuento)}
      {iva > 0 && fila(`IVA (${formatearNumero(iva)} %)`, totales.iva)}
      {fila("Total", totales.total, true)}
    </dl>
  );
}
