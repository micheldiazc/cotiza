import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rutas que se pueden visitar sin sesión. Todo lo demás exige usuario.
const RUTAS_PUBLICAS = ["/", "/login", "/registro", "/auth"];
const RUTAS_SOLO_INVITADOS = ["/login", "/registro"];

function coincide(pathname: string, rutas: string[]) {
  return rutas.some((ruta) =>
    ruta === "/" ? pathname === "/" : pathname === ruta || pathname.startsWith(`${ruta}/`),
  );
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          // Si Supabase renueva el token, las cookies nuevas deben llegar
          // tanto a la petición (para el resto del servidor) como a la respuesta
          // (para el navegador).
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // getClaims() verifica la firma del token (no se fía de la cookie a ciegas)
  // y lo renueva si ha caducado. No meter código entre createServerClient y esta llamada.
  const { data } = await supabase.auth.getClaims();
  const hayUsuario = Boolean(data?.claims);
  const { pathname } = request.nextUrl;

  if (!hayUsuario && !coincide(pathname, RUTAS_PUBLICAS)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (hayUsuario && coincide(pathname, RUTAS_SOLO_INVITADOS)) {
    const url = request.nextUrl.clone();
    url.pathname = "/panel";
    return NextResponse.redirect(url);
  }

  return response;
}
