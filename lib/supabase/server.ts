import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";

// Cliente para Server Components, Server Actions y Route Handlers.
// Lee la sesión de las cookies de la petición. Crear uno por petición,
// nunca compartirlo en una variable global (mezclaría sesiones de usuarios).
export async function createClient() {
  // Todo lo que pasa por Supabase depende del usuario y de la hora (caducidad
  // del token), así que nunca se pregenera: esperamos a una petición real.
  await connection();
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Los Server Components no pueden escribir cookies. No pasa nada:
            // proxy.ts ya refresca la sesión antes de llegar aquí.
          }
        },
      },
    },
  );
}
