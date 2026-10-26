import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Primera capa de protección: redirige a /login si no hay sesión.
// No es la única: cada página privada vuelve a comprobar el usuario
// y la base de datos aplica RLS.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Todo menos archivos estáticos e imágenes.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
