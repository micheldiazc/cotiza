import { NextResponse } from "next/server";
import { interpretarRespuesta, URL_DOLAR, URL_EURO, type TasasBcv } from "@/lib/bcv";
import { MODO_DEMO } from "@/lib/modo";
import { createClient } from "@/lib/supabase/server";

// Consulta las tasas oficiales del BCV desde el servidor. Solo para usuarios
// con sesión: proxy.ts ya filtra, y aquí se vuelve a comprobar.
export async function GET() {
  if (MODO_DEMO) {
    return NextResponse.json({ error: "No disponible en la demo." }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Inicia sesión para consultar la tasa." }, { status: 401 });
  }

  try {
    const [dolar, euro] = await Promise.all(
      [URL_DOLAR, URL_EURO].map(async (url) => {
        const respuesta = await fetch(url, {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(8000),
        });
        if (!respuesta.ok) throw new Error(`${url} respondió ${respuesta.status}`);
        return interpretarRespuesta(await respuesta.json());
      }),
    );

    const tasas: TasasBcv = { usd: dolar.valor, eur: euro.valor, fecha: dolar.fecha, ejemplo: false };
    return NextResponse.json(tasas);
  } catch (error) {
    console.error("Error al consultar el BCV:", error);
    return NextResponse.json(
      { error: "No se pudo consultar la tasa del BCV. Inténtalo más tarde o escríbela a mano." },
      { status: 502 },
    );
  }
}
