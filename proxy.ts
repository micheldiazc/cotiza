import { NextResponse, type NextRequest } from "next/server";
import { MODO_DEMO } from "@/lib/modo";
import { updateSession } from "@/lib/supabase/proxy";

// Primera capa de protección: redirige a /login si no hay sesión.
// No es la única: cada página privada vuelve a comprobar el usuario
// y la base de datos aplica RLS.
//
// En la demo no hay login ni Supabase: se entra directamente al panel.
export async function proxy(request: NextRequest) {
  if (MODO_DEMO) {
    const { pathname } = request.nextUrl;
    if (["/login", "/registro", "/auth"].some((ruta) => pathname.startsWith(ruta))) {
      return NextResponse.redirect(new URL("/panel", request.url));
    }
    return NextResponse.next();
  }

  return updateSession(request);
}

export const config = {
  // Todo menos archivos estáticos e imágenes.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
