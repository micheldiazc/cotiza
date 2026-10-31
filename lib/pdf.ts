// PDF del presupuesto, generado en el navegador con jsPDF (funciona igual en la
// demo y en la versión real). Las librerías se importan dentro de la función:
// solo se descargan cuando alguien pulsa "Descargar PDF".

import type { jsPDF } from "jspdf";
import {
  convertirItems,
  formatearNumero as formatearNumeroPresupuesto,
  totalesEnMoneda,
  type AjustesNegocio,
  type Cliente,
  type Presupuesto,
} from "@/lib/datos";
import { AUTORA } from "@/lib/creditos";
import { formatearDinero, formatearFecha, formatearNumero } from "@/lib/formato";

export interface DatosPdf {
  presupuesto: Presupuesto;
  cliente: Cliente | null;
  ajustes: AjustesNegocio;
  /** "DEMO" en diagonal. Por defecto, solo en el build de la demo. */
  marcaDeAgua?: boolean;
}

/**
 * La "M de nodos" de la autora, dibujada con líneas y círculos (mismas
 * coordenadas que su SVG de 64x64) en un cuadrado de `lado` mm.
 */
function dibujarFirma(doc: jsPDF, x: number, y: number, lado: number) {
  const e = lado / 64;
  const p = (px: number, py: number): [number, number] => [x + px * e, y + py * e];
  const puntos: [number, number][] = [p(12, 50), p(12, 14), p(32, 38), p(52, 14), p(52, 50)];

  doc.setLineWidth(3 * e).setDrawColor(169, 155, 214).setLineJoin("round");
  for (let i = 1; i < puntos.length; i++) doc.line(...puntos[i - 1], ...puntos[i]);

  doc.setDrawColor(91, 63, 209).setFillColor(247, 246, 250);
  for (const punto of puntos.slice(0, 4)) doc.circle(...punto, 5.5 * e, "FD");
  doc.setFillColor(91, 63, 209).circle(...puntos[4], 7.5 * e, "F");
}

// Las fuentes estándar de PDF solo cubren Latin-1: Intl puede usar espacios
// "estrechos" (U+202F) que saldrían como símbolos raros.
const limpiar = (texto: string) => texto.replace(/[  ]/g, " ");

const MARGEN = 15;
const GRIS = 110;

export async function generarPdf({
  presupuesto,
  cliente,
  ajustes,
  marcaDeAgua = process.env.NEXT_PUBLIC_DEMO_MODE === "true",
}: DatosPdf): Promise<jsPDF> {
  const [{ jsPDF, GState }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const ancho = doc.internal.pageSize.getWidth();
  const derecha = ancho - MARGEN;

  const moneda = presupuesto.moneda;
  const dinero = (valor: number) => limpiar(formatearDinero(valor, moneda));
  const items = convertirItems(presupuesto.items, presupuesto.tasa);
  const totales = totalesEnMoneda(
    presupuesto.items,
    presupuesto.descuentoPorcentaje,
    presupuesto.ivaPorcentaje,
    presupuesto.tasa,
  );

  // --- Cabecera: negocio a la izquierda, datos del presupuesto a la derecha ---
  let y = MARGEN + 5;
  doc.setFont("helvetica", "bold").setFontSize(16);
  doc.text(ajustes.nombreNegocio ?? "Mi negocio", MARGEN, y);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(GRIS);
  const datosNegocio = [ajustes.documento, ajustes.direccion, ajustes.telefono, ajustes.email].filter(Boolean) as string[];
  datosNegocio.forEach((linea, i) => doc.text(linea, MARGEN, y + 5 + i * 4.2));

  doc.setTextColor(0).setFont("helvetica", "bold").setFontSize(14);
  doc.text("PRESUPUESTO", derecha, y, { align: "right" });
  doc.setFontSize(11).text(formatearNumeroPresupuesto(presupuesto.numero), derecha, y + 6, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(GRIS);
  doc.text(`Fecha: ${formatearFecha(presupuesto.fechaEmision)}`, derecha, y + 11, { align: "right" });
  if (presupuesto.fechaVencimiento) {
    doc.text(`Válido hasta: ${formatearFecha(presupuesto.fechaVencimiento)}`, derecha, y + 15.2, { align: "right" });
  }

  // --- Cliente ---
  y += Math.max(18, 9 + datosNegocio.length * 4.2) + 4;
  doc.setDrawColor(220).line(MARGEN, y, derecha, y);
  y += 6;
  doc.setTextColor(GRIS).setFontSize(8).text("PARA", MARGEN, y);
  doc.setTextColor(0).setFont("helvetica", "bold").setFontSize(11);
  doc.text(cliente?.nombre ?? "—", MARGEN, y + 5);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(GRIS);
  const datosCliente = [cliente?.documento, cliente?.direccion, cliente?.email, cliente?.telefono].filter(
    Boolean,
  ) as string[];
  datosCliente.forEach((linea, i) => doc.text(linea, MARGEN, y + 9.5 + i * 4.2));
  y += 10 + datosCliente.length * 4.2 + 4;

  // --- Líneas ---
  autoTable(doc, {
    startY: y,
    margin: { left: MARGEN, right: MARGEN },
    head: [["#", "Descripción", "Cant.", "Precio", "Importe"]],
    body: items.map((item, i) => [
      String(i + 1),
      item.descripcion,
      limpiar(formatearNumero(item.cantidad).replace(/,00$/, "")),
      dinero(item.precioUnitario),
      dinero(item.cantidad * item.precioUnitario),
    ]),
    theme: "striped",
    headStyles: { fillColor: [40, 40, 40], fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      2: { cellWidth: 16, halign: "right" },
      3: { cellWidth: 30, halign: "right" },
      4: { cellWidth: 32, halign: "right" },
    },
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // --- Totales, alineados a la derecha ---
  const filas: [string, number, boolean][] = [["Subtotal", totales.subtotal, false]];
  if (presupuesto.descuentoPorcentaje > 0) {
    filas.push([`Descuento (${formatearNumero(presupuesto.descuentoPorcentaje)} %)`, -totales.descuento, false]);
  }
  if (presupuesto.ivaPorcentaje > 0) {
    filas.push([`IVA (${formatearNumero(presupuesto.ivaPorcentaje)} %)`, totales.iva, false]);
  }
  filas.push(["Total", totales.total, true]);

  for (const [etiqueta, valor, fuerte] of filas) {
    if (fuerte) {
      doc.setDrawColor(200).line(derecha - 70, y - 4, derecha, y - 4);
      y += 1;
    }
    doc.setFont("helvetica", fuerte ? "bold" : "normal").setFontSize(fuerte ? 12 : 10).setTextColor(0);
    doc.text(etiqueta, derecha - 70, y);
    doc.text(dinero(valor), derecha, y, { align: "right" });
    y += fuerte ? 7 : 5.5;
  }

  if (presupuesto.moneda !== ajustes.monedaBase) {
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(GRIS);
    doc.text(
      `Importes en ${moneda}. Tasa aplicada: 1 ${ajustes.monedaBase} = ${limpiar(formatearNumero(presupuesto.tasa, 4))} ${moneda}.`,
      derecha,
      y,
      { align: "right" },
    );
    y += 6;
  }

  // --- Notas ---
  if (presupuesto.notas) {
    y += 4;
    doc.setTextColor(GRIS).setFontSize(8).text("NOTAS", MARGEN, y);
    doc.setTextColor(0).setFontSize(9);
    doc.text(doc.splitTextToSize(presupuesto.notas, ancho - MARGEN * 2), MARGEN, y + 5);
  }

  // --- En cada página: marca de agua (solo demo) y pie con la firma ---
  const paginas = doc.getNumberOfPages();
  const alto = doc.internal.pageSize.getHeight();
  for (let pagina = 1; pagina <= paginas; pagina++) {
    doc.setPage(pagina);

    if (marcaDeAgua) {
      // Casi transparente (GState = estado gráfico de PDF) para no tapar el contenido.
      doc.saveGraphicsState();
      doc.setGState(new GState({ opacity: 0.07 }));
      doc.setFont("helvetica", "bold").setFontSize(150).setTextColor(91, 63, 209);
      doc.text("DEMO", ancho / 2, alto / 2 + 20, { align: "center", angle: 45 });
      doc.restoreGraphicsState();
    }

    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(150);
    dibujarFirma(doc, MARGEN, alto - 11.2, 4);
    doc.text(`Generado con Cotiza · desarrollado por ${AUTORA}`, MARGEN + 5.5, alto - 8);
    doc.text(`${formatearNumeroPresupuesto(presupuesto.numero)} · página ${pagina} de ${paginas}`, derecha, alto - 8, {
      align: "right",
    });
  }

  return doc;
}

export async function descargarPdf(datos: DatosPdf) {
  const doc = await generarPdf(datos);
  doc.save(`${formatearNumeroPresupuesto(datos.presupuesto.numero)}.pdf`);
}
