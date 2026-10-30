// Tests de contrato: las reglas que debe cumplir CUALQUIER implementación del
// repositorio. Hoy se ejecutan contra la del navegador; si mañana hubiera otra
// (o un entorno de pruebas de Supabase), se le pasaría la misma batería.

import { beforeEach, describe, expect, it } from "vitest";
import type { Repositorio } from "../repositorio";
import type { DatosPresupuesto } from "../tipos";

async function esperarError(promesa: Promise<unknown>, codigo: string) {
  await expect(promesa).rejects.toMatchObject({ name: "ErrorDatos", codigo });
}

export function probarContrato(nombre: string, crearRepo: () => Promise<Repositorio>) {
  describe(`Repositorio: ${nombre}`, () => {
    let repo: Repositorio;

    beforeEach(async () => {
      repo = await crearRepo();
    });

    async function presupuestoBase(extra: Partial<DatosPresupuesto> = {}) {
      const cliente = await repo.clientes.crear({ nombre: "Cliente de prueba" });
      return repo.presupuestos.crear({
        clienteId: cliente.id,
        moneda: "USD",
        items: [{ descripcion: "Servicio", cantidad: 2, precioUnitario: 10 }],
        ...extra,
      });
    }

    describe("clientes", () => {
      it("crea, lista, actualiza y elimina", async () => {
        const creado = await repo.clientes.crear({ nombre: "  Zeta  ", email: "z@example.com" });
        await repo.clientes.crear({ nombre: "Alfa" });

        expect(creado.nombre).toBe("Zeta");
        expect((await repo.clientes.listar()).map((c) => c.nombre)).toEqual(["Alfa", "Zeta"]);

        const actualizado = await repo.clientes.actualizar(creado.id, { telefono: "123" });
        expect(actualizado).toMatchObject({ nombre: "Zeta", email: "z@example.com", telefono: "123" });

        await repo.clientes.eliminar(creado.id);
        expect(await repo.clientes.obtener(creado.id)).toBeNull();
      });

      it("exige un nombre", async () => {
        await esperarError(repo.clientes.crear({ nombre: "   " }), "validacion");
      });

      it("no deja borrar un cliente con presupuestos", async () => {
        const presupuesto = await presupuestoBase();
        await esperarError(repo.clientes.eliminar(presupuesto.clienteId), "cliente_con_presupuestos");
        expect(await repo.clientes.obtener(presupuesto.clienteId)).not.toBeNull();
      });

      it("avisa si el cliente no existe", async () => {
        await esperarError(repo.clientes.actualizar(crypto.randomUUID(), { nombre: "X" }), "no_encontrado");
      });
    });

    describe("productos y variantes", () => {
      it("lista los productos con sus variantes", async () => {
        const producto = await repo.productos.crear({ nombre: "Tarjetas" });
        await repo.variantes.crear(producto.id, { nombre: "500 u", precio: 55 });
        await repo.variantes.crear(producto.id, { nombre: "100 u", precio: 18 });

        const [listado] = await repo.productos.listar();
        expect(listado.variantes.map((v) => v.nombre)).toEqual(["100 u", "500 u"]);
      });

      it("rechaza precios negativos", async () => {
        const producto = await repo.productos.crear({ nombre: "Tarjetas" });
        await esperarError(repo.variantes.crear(producto.id, { nombre: "Mal", precio: -1 }), "validacion");
      });

      it("al borrar un producto borra sus variantes", async () => {
        const producto = await repo.productos.crear({ nombre: "Tarjetas" });
        await repo.variantes.crear(producto.id, { nombre: "100 u", precio: 18 });
        await repo.productos.eliminar(producto.id);
        expect(await repo.productos.listar()).toEqual([]);
      });

      it("al borrar una variante, los presupuestos conservan la línea", async () => {
        const producto = await repo.productos.crear({ nombre: "Tarjetas" });
        const variante = await repo.variantes.crear(producto.id, { nombre: "100 u", precio: 18 });
        const presupuesto = await presupuestoBase({
          items: [{ varianteId: variante.id, descripcion: "Tarjetas 100 u", cantidad: 1, precioUnitario: 18 }],
        });

        await repo.variantes.eliminar(variante.id);

        const [item] = (await repo.presupuestos.obtener(presupuesto.id))!.items;
        expect(item).toMatchObject({ varianteId: null, descripcion: "Tarjetas 100 u", precioUnitario: 18 });
      });
    });

    describe("presupuestos", () => {
      it("numera de forma correlativa", async () => {
        const a = await presupuestoBase();
        const b = await presupuestoBase();
        const c = await presupuestoBase();
        expect([a.numero, b.numero, c.numero]).toEqual([1, 2, 3]);
      });

      it("calcula subtotal y total con descuento e IVA", async () => {
        const presupuesto = await presupuestoBase({
          items: [
            { descripcion: "A", cantidad: 3, precioUnitario: 19.99 },
            { descripcion: "B", cantidad: 1, precioUnitario: 40 },
          ],
          descuentoPorcentaje: 10,
          ivaPorcentaje: 16,
        });
        // 59.97 + 40 = 99.97 → -10 % = 89.97 → +16 % (14.40) = 104.37
        expect(presupuesto.subtotal).toBe(99.97);
        expect(presupuesto.total).toBe(104.37);
      });

      it("usa el IVA de los ajustes si no se indica", async () => {
        await repo.ajustes.guardar({ ivaPorcentaje: 16 });
        const presupuesto = await presupuestoBase();
        expect(presupuesto.ivaPorcentaje).toBe(16);
        expect(presupuesto.total).toBe(23.2);
      });

      it("nace en borrador y conserva el orden de las líneas", async () => {
        const presupuesto = await presupuestoBase({
          items: ["uno", "dos", "tres"].map((descripcion) => ({ descripcion, cantidad: 1, precioUnitario: 1 })),
        });
        const leido = await repo.presupuestos.obtener(presupuesto.id);
        expect(leido?.estado).toBe("borrador");
        expect(leido?.items.map((i) => i.descripcion)).toEqual(["uno", "dos", "tres"]);
      });

      it("rechaza un cliente inexistente y datos inválidos", async () => {
        await expect(
          repo.presupuestos.crear({ clienteId: crypto.randomUUID(), moneda: "USD", items: [] }),
        ).rejects.toThrow();
        const cliente = await repo.clientes.crear({ nombre: "C" });
        await esperarError(
          repo.presupuestos.crear({ clienteId: cliente.id, moneda: "dolares", items: [] }),
          "validacion",
        );
        await esperarError(
          repo.presupuestos.crear({
            clienteId: cliente.id,
            moneda: "USD",
            items: [{ descripcion: "X", cantidad: 0, precioUnitario: 1 }],
          }),
          "validacion",
        );
      });

      it("actualizar sustituye las líneas y recalcula", async () => {
        const presupuesto = await presupuestoBase();
        const actualizado = await repo.presupuestos.actualizar(presupuesto.id, {
          clienteId: presupuesto.clienteId,
          moneda: "USD",
          items: [{ descripcion: "Nuevo", cantidad: 1, precioUnitario: 5 }],
        });
        expect(actualizado.items.map((i) => i.descripcion)).toEqual(["Nuevo"]);
        expect(actualizado.subtotal).toBe(5);
        expect(actualizado.numero).toBe(presupuesto.numero);
      });

      it("sigue el flujo de estados permitido", async () => {
        const presupuesto = await presupuestoBase();
        await esperarError(repo.presupuestos.cambiarEstado(presupuesto.id, "aceptado"), "transicion_invalida");
        await repo.presupuestos.cambiarEstado(presupuesto.id, "enviado");
        const aceptado = await repo.presupuestos.cambiarEstado(presupuesto.id, "aceptado");
        expect(aceptado.estado).toBe("aceptado");
        await esperarError(repo.presupuestos.cambiarEstado(presupuesto.id, "borrador"), "transicion_invalida");
      });

      it("no deja editar un presupuesto enviado", async () => {
        const presupuesto = await presupuestoBase();
        await repo.presupuestos.cambiarEstado(presupuesto.id, "enviado");
        await esperarError(
          repo.presupuestos.actualizar(presupuesto.id, {
            clienteId: presupuesto.clienteId,
            moneda: "USD",
            items: [],
          }),
          "no_editable",
        );
      });

      it("lista del más reciente al más antiguo con el nombre del cliente", async () => {
        await presupuestoBase();
        await presupuestoBase();
        const listado = await repo.presupuestos.listar();
        expect(listado.map((p) => p.numero)).toEqual([2, 1]);
        expect(listado[0].clienteNombre).toBe("Cliente de prueba");
      });

      it("eliminar borra el presupuesto y sus líneas", async () => {
        const presupuesto = await presupuestoBase();
        await repo.presupuestos.eliminar(presupuesto.id);
        expect(await repo.presupuestos.obtener(presupuesto.id)).toBeNull();
        await repo.clientes.eliminar(presupuesto.clienteId);
      });
    });

    describe("tasas", () => {
      it("registra y devuelve la última por par de monedas", async () => {
        await repo.tasas.registrar({ monedaOrigen: "USD", monedaDestino: "VES", valor: 880, fecha: "2026-10-01" });
        await repo.tasas.registrar({ monedaOrigen: "USD", monedaDestino: "VES", valor: 888.89, fecha: "2026-10-29", fuente: "bcv" });
        await repo.tasas.registrar({ monedaOrigen: "USD", monedaDestino: "VES", valor: 850, fecha: "2026-09-15" });
        await repo.tasas.registrar({ monedaOrigen: "EUR", monedaDestino: "VES", valor: 989.39, fecha: "2026-10-29" });

        expect(await repo.tasas.ultima("USD", "VES")).toMatchObject({ valor: 888.89, fuente: "bcv" });
        expect(await repo.tasas.ultima("EUR", "VES")).toMatchObject({ valor: 989.39, fuente: "manual" });
        expect(await repo.tasas.ultima("USD", "COP")).toBeNull();
        expect((await repo.tasas.listar()).map((t) => t.fecha)).toEqual([
          "2026-10-29",
          "2026-10-29",
          "2026-10-01",
          "2026-09-15",
        ]);
      });

      it("a igual fecha gana la última registrada", async () => {
        await repo.tasas.registrar({ monedaOrigen: "USD", monedaDestino: "VES", valor: 1, fecha: "2026-10-29" });
        await new Promise((r) => setTimeout(r, 5));
        await repo.tasas.registrar({ monedaOrigen: "USD", monedaDestino: "VES", valor: 2, fecha: "2026-10-29" });
        expect((await repo.tasas.ultima("USD", "VES"))?.valor).toBe(2);
      });

      it("valida monedas y valor", async () => {
        await esperarError(repo.tasas.registrar({ monedaOrigen: "USD", monedaDestino: "USD", valor: 1 }), "validacion");
        await esperarError(repo.tasas.registrar({ monedaOrigen: "USD", monedaDestino: "VES", valor: 0 }), "validacion");
        await esperarError(repo.tasas.registrar({ monedaOrigen: "usd", monedaDestino: "VES", valor: 1 }), "validacion");
      });
    });

    describe("ajustes", () => {
      it("devuelve valores por defecto y guarda cambios parciales", async () => {
        expect((await repo.ajustes.obtener()).monedaBase).toBe("USD");
        await repo.ajustes.guardar({ nombreNegocio: "Mi negocio" });
        await repo.ajustes.guardar({ ivaPorcentaje: 16 });
        expect(await repo.ajustes.obtener()).toMatchObject({ nombreNegocio: "Mi negocio", ivaPorcentaje: 16 });
      });
    });
  });
}
