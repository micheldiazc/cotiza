// fake-indexeddb implementa IndexedDB en memoria para que los tests corran en
// Node, sin navegador.
import "fake-indexeddb/auto";
import { openDB } from "idb";
import { describe, expect, it } from "vitest";
import { crearRepositorioNavegador } from "../navegador";
import { probarContrato } from "./contrato";

// Una base de datos nueva y vacía para cada test.
const repoVacio = () =>
  crearRepositorioNavegador({ nombreBd: `prueba-${crypto.randomUUID()}`, conDatosDeEjemplo: false });

probarContrato("navegador (IndexedDB)", repoVacio);

describe("modo demo", () => {
  it("carga los datos de ejemplo la primera vez", async () => {
    const repo = await crearRepositorioNavegador({ nombreBd: `demo-${crypto.randomUUID()}` });
    const presupuestos = await repo.presupuestos.listar();

    expect((await repo.ajustes.obtener()).nombreNegocio).toBe("Estudio Lumen");
    expect(await repo.clientes.listar()).toHaveLength(6);
    expect(presupuestos).toHaveLength(8);
    expect((await repo.tasas.ultima("USD", "VES"))?.valor).toBe(880);
    expect(new Set(presupuestos.map((p) => p.estado))).toEqual(
      new Set(["borrador", "enviado", "aceptado", "rechazado"]),
    );
  });

  it("no vuelve a sembrar al abrir otra vez la misma base de datos", async () => {
    const nombreBd = `demo-${crypto.randomUUID()}`;
    const primera = await crearRepositorioNavegador({ nombreBd });
    const cliente = (await primera.clientes.listar())[0];
    await primera.clientes.actualizar(cliente.id, { nombre: "Cambiado por el visitante" });

    const segunda = await crearRepositorioNavegador({ nombreBd });
    expect(await segunda.clientes.obtener(cliente.id)).toMatchObject({ nombre: "Cambiado por el visitante" });
  });

  it("actualiza una base de datos de la versión 1 sin perder los datos del visitante", async () => {
    const nombreBd = `v1-${crypto.randomUUID()}`;
    // Así estaba el esquema antes de añadir las tasas.
    const v1 = await openDB(nombreBd, 1, {
      upgrade(db) {
        db.createObjectStore("ajustes");
        db.createObjectStore("meta");
        db.createObjectStore("clientes", { keyPath: "id" });
        db.createObjectStore("productos", { keyPath: "id" });
        db.createObjectStore("variantes", { keyPath: "id" }).createIndex("porProducto", "productoId");
        db.createObjectStore("presupuestos", { keyPath: "id" }).createIndex("porCliente", "clienteId");
        const items = db.createObjectStore("items", { keyPath: "id" });
        items.createIndex("porPresupuesto", "presupuestoId");
        items.createIndex("porVariante", "varianteId");
      },
    });
    await v1.put("clientes", { id: "c1", nombre: "Cliente de antes", creadoEn: "", actualizadoEn: "" });
    await v1.put("meta", true, "sembrado");
    v1.close();

    const repo = await crearRepositorioNavegador({ nombreBd });

    expect(await repo.clientes.obtener("c1")).toMatchObject({ nombre: "Cliente de antes" });
    await repo.tasas.registrar({ monedaOrigen: "USD", monedaDestino: "VES", valor: 880 });
    expect((await repo.tasas.ultima("USD", "VES"))?.valor).toBe(880);
  });

  it("restablecer vuelve a los datos de ejemplo", async () => {
    const repo = await crearRepositorioNavegador({ nombreBd: `demo-${crypto.randomUUID()}` });
    await repo.clientes.crear({ nombre: "Cliente del visitante" });
    expect(await repo.clientes.listar()).toHaveLength(7);

    await repo.restablecer();

    const nombres = (await repo.clientes.listar()).map((c) => c.nombre);
    expect(nombres).toHaveLength(6);
    expect(nombres).not.toContain("Cliente del visitante");
    expect((await repo.presupuestos.listar()).map((p) => p.numero)).toEqual([8, 7, 6, 5, 4, 3, 2, 1]);
  });
});
