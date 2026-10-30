import { describe, expect, it } from "vitest";
import { calcularTotales, formatearNumero, redondear, transicionPermitida } from "../reglas";

describe("redondear", () => {
  it("evita los errores clásicos de coma flotante", () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(redondear(0.1 + 0.2)).toBe(0.3);
    expect(redondear(1.005)).toBe(1.01);
  });
});

describe("calcularTotales", () => {
  it("sin líneas todo es 0", () => {
    expect(calcularTotales([])).toEqual({ subtotal: 0, descuento: 0, baseImponible: 0, iva: 0, total: 0 });
  });

  it("aplica primero el descuento y luego el IVA sobre la base", () => {
    expect(calcularTotales([{ cantidad: 1, precioUnitario: 100 }], 10, 16)).toEqual({
      subtotal: 100,
      descuento: 10,
      baseImponible: 90,
      iva: 14.4,
      total: 104.4,
    });
  });

  it("redondea cada línea a céntimos", () => {
    // 3 x 0.333 = 0.999 → 1.00
    expect(calcularTotales([{ cantidad: 3, precioUnitario: 0.333 }]).subtotal).toBe(1);
  });
});

describe("transiciones de estado", () => {
  it.each([
    ["borrador", "enviado", true],
    ["enviado", "aceptado", true],
    ["enviado", "rechazado", true],
    ["enviado", "borrador", true],
    ["rechazado", "borrador", true],
    ["borrador", "aceptado", false],
    ["aceptado", "borrador", false],
    ["aceptado", "rechazado", false],
  ] as const)("%s → %s: %s", (desde, hacia, esperado) => {
    expect(transicionPermitida(desde, hacia)).toBe(esperado);
  });
});

describe("formatearNumero", () => {
  it("rellena con ceros", () => {
    expect(formatearNumero(7)).toBe("P-0007");
    expect(formatearNumero(12345)).toBe("P-12345");
  });
});
