import { describe, expect, it } from "vitest";
import { leerNumero, texto } from "../formularios";

describe("leerNumero", () => {
  it.each([
    ["1234.5", 1234.5],
    ["1234,5", 1234.5],
    ["1.234,50", 1234.5],
    [" 18 ", 18],
    ["0,99", 0.99],
  ])("«%s» → %d", (entrada, esperado) => {
    expect(leerNumero(entrada)).toBe(esperado);
  });

  it("devuelve NaN si no es un número (y la validación lo rechaza)", () => {
    expect(leerNumero("")).toBeNaN();
    expect(leerNumero("doce")).toBeNaN();
  });
});

describe("texto", () => {
  it("convierte los campos vacíos en null", () => {
    const datos = new FormData();
    datos.set("vacio", "   ");
    datos.set("lleno", "  Ana  ");
    expect(texto(datos, "vacio")).toBeNull();
    expect(texto(datos, "lleno")).toBe("Ana");
    expect(texto(datos, "inexistente")).toBeNull();
  });
});
