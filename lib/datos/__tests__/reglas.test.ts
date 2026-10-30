import { describe, expect, it } from "vitest";
import {
  calcularTotales,
  convertirItems,
  fechaLocal,
  formatearNumero,
  redondear,
  totalesEnMoneda,
  transicionPermitida,
} from "../reglas";

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

describe("conversión de moneda", () => {
  it("con tasa 1 es lo mismo que calcularTotales", () => {
    const items = [{ cantidad: 3, precioUnitario: 19.99 }];
    expect(totalesEnMoneda(items, 10, 16, 1)).toEqual(calcularTotales(items, 10, 16));
  });

  it("convierte cada precio y redondea antes de multiplicar por la cantidad", () => {
    // 0.333 USD x 40.5 = 13.4865 → 13.49 VES; x 3 = 40.47 (no 40.46 de convertir el total)
    expect(convertirItems([{ cantidad: 3, precioUnitario: 0.333 }], 40.5)[0].precioUnitario).toBe(13.49);
    expect(totalesEnMoneda([{ cantidad: 3, precioUnitario: 0.333 }], 0, 0, 40.5).total).toBe(40.47);
  });

  it("conserva el resto de campos de la línea", () => {
    const [linea] = convertirItems([{ descripcion: "X", cantidad: 1, precioUnitario: 2 }], 0.5);
    expect(linea).toEqual({ descripcion: "X", cantidad: 1, precioUnitario: 1 });
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

describe("fechaLocal", () => {
  it("usa la fecha local, no la UTC", () => {
    // 30 de octubre a las 23:30 hora local: en UTC-4 ya sería 31 en UTC.
    expect(fechaLocal(new Date(2026, 9, 30, 23, 30))).toBe("2026-10-30");
    expect(fechaLocal(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("formatearNumero", () => {
  it("rellena con ceros", () => {
    expect(formatearNumero(7)).toBe("P-0007");
    expect(formatearNumero(12345)).toBe("P-12345");
  });
});
