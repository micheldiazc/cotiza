// fake-indexeddb implementa IndexedDB en memoria para que los tests corran en
// Node, sin navegador.
import "fake-indexeddb/auto";
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
