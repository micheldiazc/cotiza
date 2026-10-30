// Datos de ejemplo de la demo: un negocio inventado. Todo es ficticio
// (nombres, documentos, correos @example.com).
//
// Se cargan con la propia API del repositorio, así pasan por las mismas
// validaciones y reglas que los datos que crea un visitante.

import type { Repositorio } from "../repositorio";
import type { EstadoPresupuesto } from "../tipos";

function haceDias(dias: number): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - dias);
  return fecha.toISOString().slice(0, 10);
}

function enDias(desde: string, dias: number): string {
  const fecha = new Date(`${desde}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

// Recorrido de estados hasta llegar al final deseado.
const CAMINO: Record<EstadoPresupuesto, EstadoPresupuesto[]> = {
  borrador: [],
  enviado: ["enviado"],
  aceptado: ["enviado", "aceptado"],
  rechazado: ["enviado", "rechazado"],
};

export async function sembrar(repo: Repositorio) {
  await repo.ajustes.guardar({
    nombreNegocio: "Estudio Lumen",
    documento: "J-00000000-0",
    telefono: "+58 000 000 0000",
    email: "hola@lumen.example.com",
    direccion: "Calle Ficticia 123, Ciudad Ejemplo",
    monedaBase: "USD",
    ivaPorcentaje: 16,
  });

  const [cafe, ferreteria, clinica, academia, ana, pedro] = await Promise.all(
    [
      { nombre: "Café La Esquina", documento: "J-11111111-1", email: "compras@cafe.example.com" },
      { nombre: "Ferretería El Tornillo", documento: "J-22222222-2", telefono: "+58 000 111 2222" },
      { nombre: "Clínica Dental Sonrisa", documento: "J-33333333-3", email: "admin@sonrisa.example.com" },
      { nombre: "Academia de Idiomas Babel", documento: "J-44444444-4" },
      { nombre: "Ana Pérez", documento: "V-5555555", email: "ana@example.com", notas: "Prefiere WhatsApp." },
      { nombre: "Pedro Gómez", documento: "V-6666666", telefono: "+58 000 333 4444" },
    ].map((cliente) => repo.clientes.crear(cliente)),
  );

  const catalogo = [
    { nombre: "Diseño de logotipo", descripcion: "Incluye archivos editables.", variantes: [["Básico (2 propuestas)", 80], ["Completo (manual de marca)", 220]] },
    { nombre: "Tarjetas de presentación", descripcion: "Impresión a color, papel 300 g.", variantes: [["100 unidades", 18], ["500 unidades", 55], ["1000 unidades", 90]] },
    { nombre: "Página web", descripcion: "Diseño adaptable a móvil.", variantes: [["Landing de una página", 350], ["Sitio corporativo (5 páginas)", 900]] },
    { nombre: "Gestión de redes sociales", descripcion: "Plan mensual.", variantes: [["12 publicaciones", 150], ["20 publicaciones + historias", 240]] },
    { nombre: "Pendón publicitario", descripcion: "Lona con ojales.", variantes: [["1 x 2 m", 35], ["2 x 3 m", 70]] },
  ] as const;

  const v: Record<string, { id: string; nombre: string; precio: number }> = {};
  for (const { nombre, descripcion, variantes } of catalogo) {
    const producto = await repo.productos.crear({ nombre, descripcion });
    for (const [nombreVariante, precio] of variantes) {
      const variante = await repo.variantes.crear(producto.id, { nombre: nombreVariante, precio });
      v[`${nombre} · ${nombreVariante}`] = { id: variante.id, nombre: `${nombre} · ${nombreVariante}`, precio };
    }
  }

  const linea = (clave: string, cantidad = 1) => ({
    varianteId: v[clave].id,
    descripcion: v[clave].nombre,
    cantidad,
    precioUnitario: v[clave].precio,
  });

  const presupuestos: {
    clienteId: string;
    dias: number;
    estado: EstadoPresupuesto;
    items: ReturnType<typeof linea>[];
    descuento?: number;
    moneda?: string;
    tasa?: number;
    notas?: string;
  }[] = [
    { clienteId: cafe.id, dias: 40, estado: "aceptado", items: [linea("Diseño de logotipo · Completo (manual de marca)"), linea("Tarjetas de presentación · 500 unidades", 2)] },
    { clienteId: ferreteria.id, dias: 32, estado: "rechazado", items: [linea("Página web · Sitio corporativo (5 páginas)")], notas: "El cliente pidió una opción más económica." },
    { clienteId: ferreteria.id, dias: 25, estado: "aceptado", items: [linea("Página web · Landing de una página"), linea("Pendón publicitario · 2 x 3 m")] },
    { clienteId: clinica.id, dias: 14, estado: "enviado", items: [linea("Gestión de redes sociales · 20 publicaciones + historias", 3)], descuento: 10, notas: "Contrato trimestral con 10 % de descuento." },
    { clienteId: academia.id, dias: 9, estado: "enviado", items: [linea("Tarjetas de presentación · 1000 unidades"), linea("Pendón publicitario · 1 x 2 m", 4)], moneda: "VES", tasa: 40.5 },
    { clienteId: ana.id, dias: 5, estado: "aceptado", items: [linea("Diseño de logotipo · Básico (2 propuestas)"), linea("Tarjetas de presentación · 100 unidades")] },
    { clienteId: pedro.id, dias: 2, estado: "borrador", items: [linea("Gestión de redes sociales · 12 publicaciones")] },
    { clienteId: cafe.id, dias: 0, estado: "borrador", items: [linea("Pendón publicitario · 2 x 3 m", 2)], moneda: "EUR", tasa: 0.92 },
  ];

  for (const p of presupuestos) {
    const fechaEmision = haceDias(p.dias);
    const creado = await repo.presupuestos.crear({
      clienteId: p.clienteId,
      moneda: p.moneda ?? "USD",
      tasa: p.tasa,
      descuentoPorcentaje: p.descuento,
      notas: p.notas,
      fechaEmision,
      fechaVencimiento: enDias(fechaEmision, 15),
      items: p.items,
    });
    for (const estado of CAMINO[p.estado]) {
      await repo.presupuestos.cambiarEstado(creado.id, estado);
    }
  }
}
