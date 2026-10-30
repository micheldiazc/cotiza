import { describe, expect, it } from "vitest";
import { interpretarRespuesta } from "../bcv";

describe("interpretarRespuesta (dolarapi)", () => {
  it("toma el promedio, lo redondea a 4 decimales y usa la fecha de Venezuela", () => {
    expect(
      interpretarRespuesta({ promedio: 989.38890515, fechaActualizacion: "2026-10-29T00:00:00-04:00" }),
    ).toEqual({ valor: 989.3889, fecha: "2026-10-29" });
  });

  it("acepta el promedio como texto", () => {
    expect(interpretarRespuesta({ promedio: "888.8909", fechaActualizacion: "2026-10-29T00:00:00-04:00" }).valor).toBe(
      888.8909,
    );
  });

  it.each([[{}], [null], [{ promedio: 0 }], [{ promedio: -5 }], [{ promedio: "abc" }]])(
    "rechaza respuestas sin una tasa válida: %j",
    (respuesta) => {
      expect(() => interpretarRespuesta(respuesta)).toThrow("tasa válida");
    },
  );

  it("si la fecha no tiene el formato esperado, usa la de hoy", () => {
    expect(interpretarRespuesta({ promedio: 1, fechaActualizacion: "ayer" }).fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
