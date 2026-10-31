import { describe, expect, it } from "vitest";
import type { Presupuesto } from "@/lib/datos";
import { generarPdf } from "../pdf";

const presupuesto: Presupuesto = {
  id: "p1",
  numero: 7,
  clienteId: "c1",
  estado: "enviado",
  moneda: "VES",
  tasa: 40.5,
  descuentoPorcentaje: 10,
  ivaPorcentaje: 16,
  subtotal: 100,
  total: 104.4,
  notas: "Pago al contado.",
  fechaEmision: "2026-10-01",
  fechaVencimiento: "2026-10-16",
  items: [{ id: "i1", varianteId: null, descripcion: "Diseño de logotipo", cantidad: 1, precioUnitario: 100, orden: 0 }],
  creadoEn: "",
  actualizadoEn: "",
};

const cliente = {
  id: "c1",
  nombre: "Café La Esquina",
  documento: "J-11111111-1",
  telefono: null,
  email: null,
  direccion: null,
  notas: null,
  creadoEn: "",
  actualizadoEn: "",
};

const ajustes = {
  nombreNegocio: "Estudio Lumen",
  documento: null,
  telefono: null,
  email: null,
  direccion: null,
  monedaBase: "USD",
  ivaPorcentaje: 16,
};

describe("generarPdf", () => {
  it("incluye número, negocio, cliente, líneas, total convertido y tasa", async () => {
    const doc = await generarPdf({ presupuesto, cliente, ajustes });
    // jsPDF escribe el texto sin comprimir: se puede buscar en el PDF.
    const pdf = doc.output();

    expect(pdf.startsWith("%PDF-")).toBe(true);
    // Los acentos van como bytes Latin-1 (é = 0xE9), que en JS es el mismo carácter "é".
    for (const texto of [
      "P-0007",
      "Estudio Lumen",
      "Café La Esquina",
      "Diseño de logotipo",
      "Pago al contado.",
      "Tasa aplicada: 1 USD = 40,5000 VES",
    ]) {
      expect(pdf).toContain(texto);
    }
    // 100 USD x 40,5 = 4.050 VES; -10 % = 3.645; +16 % IVA = 4.228,20
    expect(pdf).toContain("4.228,20");
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it("firma el pie con los créditos de la autora", async () => {
    const pdf = (await generarPdf({ presupuesto, cliente, ajustes })).output();
    expect(pdf).toContain("Generado con Cotiza · desarrollado por Michel Díaz Cabrera");
  });

  it("pone la marca de agua DEMO solo cuando se pide", async () => {
    const conMarca = (await generarPdf({ presupuesto, cliente, ajustes, marcaDeAgua: true })).output();
    const sinMarca = (await generarPdf({ presupuesto, cliente, ajustes, marcaDeAgua: false })).output();
    expect(conMarca).toContain("(DEMO) Tj");
    expect(sinMarca).not.toContain("(DEMO) Tj");
  });
});
