import { createBrowserClient } from "@supabase/ssr";

// Cliente para componentes que se ejecutan en el navegador ("use client").
// Usa la clave publishable: lo que puede ver cada usuario lo decide RLS.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
