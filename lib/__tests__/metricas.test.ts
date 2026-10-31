import { describe, expect, it } from "vitest";
import type { EstadoPresupuesto } from "@/lib/datos";
import { calcularMetricas, ultimosMeses } from "../metricas";

const p = (estado: EstadoPresupuesto, total: number, fechaEmision: string) => ({ estado, total, fechaEmision });

describe("ultimosMeses", () => {
  it("cuenta hacia atrás cruzando el cambio de año", () => {
    expect(ultimosMeses("2026-02-15", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});

describe("calcularMetricas", () => {
  const presupuestos = [
    p("aceptado", 100.1, "2026-10-05"),
    p("aceptado", 50.2, "2026-08-20"),
    p("aceptado", 999, "2025-01-01"), // fuera de los 6 meses del gráfico, pero cuenta en el total
    p("rechazado", 300, "2026-09-10"),
    p("enviado", 80, "2026-10-20"),
    p("enviado", 20, "2026-10-21"),
    p("borrador", 10, "2026-10-29"),
  ];
  const metricas = calcularMetricas(presupuestos, "2026-10-30");

  it("cuenta por estado y no considera emitidos los borradores", () => {
    expect(metricas).toMatchObject({ emitidos: 6, borradores: 1, pendientes: 2, aceptados: 3, rechazados: 1 });
  });

  it("suma las ventas aceptadas redondeando a céntimos", () => {
    expect(metricas.ventasAceptadas).toBe(1149.3);
  });

  it("tasa de aceptación = aceptados / decididos", () => {
    expect(metricas.tasaAceptacion).toBe(0.75);
    expect(calcularMetricas([p("enviado", 1, "2026-10-01")], "2026-10-30").tasaAceptacion).toBeNull();
  });

  it("agrupa las ventas aceptadas por mes de emisión en los últimos 6 meses", () => {
    expect(metricas.ventasPorMes).toEqual([
      { mes: "2026-05", etiqueta: "may 26", total: 0 },
      { mes: "2026-06", etiqueta: "jun 26", total: 0 },
      { mes: "2026-07", etiqueta: "jul 26", total: 0 },
      { mes: "2026-08", etiqueta: "ago 26", total: 50.2 },
      { mes: "2026-09", etiqueta: "sep 26", total: 0 },
      { mes: "2026-10", etiqueta: "oct 26", total: 100.1 },
    ]);
  });

  it("sin presupuestos todo es 0", () => {
    const vacio = calcularMetricas([], "2026-10-30");
    expect(vacio).toMatchObject({ ventasAceptadas: 0, emitidos: 0, tasaAceptacion: null });
    expect(vacio.ventasPorMes.every((m) => m.total === 0)).toBe(true);
  });
});
