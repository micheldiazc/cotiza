import { describe, expect, it } from "vitest";
import { coincide, formatearDinero, formatearFecha, formatearNumero, normalizar } from "../formato";

describe("formatearDinero", () => {
  it("usa coma decimal y punto de miles", () => {
    expect(formatearDinero(1234.5, "USD")).toContain("1.234,50");
  });

  it("no falla con un código de moneda desconocido", () => {
    expect(formatearDinero(10, "XYZ")).toContain("10,00");
  });
});

describe("formatearNumero", () => {
  it("respeta los decimales pedidos", () => {
    expect(formatearNumero(40.5, 4)).toBe("40,5000");
  });
});

describe("formatearFecha", () => {
  it("convierte AAAA-MM-DD a DD/MM/AAAA sin moverse de día", () => {
    expect(formatearFecha("2026-01-01")).toBe("01/01/2026");
    expect(formatearFecha(null)).toBe("");
  });
});

describe("búsqueda", () => {
  it("ignora mayúsculas y tildes", () => {
    expect(normalizar("  Ñandú PÉREZ ")).toBe("nandu perez");
    expect(coincide("perez", ["Ana Pérez"])).toBe(true);
    expect(coincide("PÉR", [null, "ana perez"])).toBe(true);
  });

  it("una búsqueda vacía coincide con todo", () => {
    expect(coincide("   ", ["lo que sea"])).toBe(true);
  });

  it("busca en cualquiera de los campos", () => {
    expect(coincide("J-111", ["Café", "J-11111111-1", null])).toBe(true);
    expect(coincide("zzz", ["Café", "J-11111111-1", null])).toBe(false);
  });
});
