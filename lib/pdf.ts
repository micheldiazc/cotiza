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
import { formatearDinero, formatearFecha, formatearNumero } from "@/lib/formato";

export interface DatosPdf {
  presupuesto: Presupuesto;
  cliente: Cliente | null;
  ajustes: AjustesNegocio;
}

// Las fuentes estándar de PDF solo cubren Latin-1: Intl puede usar espacios
// "estrechos" (U+202F) que saldrían como símbolos raros.
const limpiar = (texto: string) => texto.replace(/[  ]/g, " ");

const MARGEN = 15;
const GRIS = 110;

export async function generarPdf({ presupuesto, cliente, ajustes }: DatosPdf): Promise<jsPDF> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
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

  // --- Pie en cada página ---
  const paginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= paginas; pagina++) {
    doc.setPage(pagina);
    doc.setFontSize(8).setTextColor(160);
    const alto = doc.internal.pageSize.getHeight();
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
