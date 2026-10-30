// NEXT_PUBLIC_* se sustituye por su valor al compilar, así que esto es una
// constante: en el build de la demo, el código de la versión real (Supabase)
// queda en ramas que nunca se ejecutan y el compilador lo elimina.
export const MODO_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
