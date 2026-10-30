# Cotiza

Gestor de presupuestos para pequeños negocios: clientes, catálogo con
variantes, presupuestos con PDF y estados, y multimoneda (con tasa BCV opcional).

Construido con Next.js 16, TypeScript, Tailwind CSS y Supabase (Auth + Postgres
con Row Level Security).

> En desarrollo. El alcance y las decisiones están en [docs/plan.md](docs/plan.md).

## Dos modos, un mismo código

| | Versión real | Demo |
| --- | --- | --- |
| Datos | Supabase (Postgres + RLS) | IndexedDB, en el navegador del visitante |
| Login | Correo y contraseña | No hace falta |
| Variable | `NEXT_PUBLIC_DEMO_MODE=false` | `NEXT_PUBLIC_DEMO_MODE=true` |

Las pantallas usan una interfaz común (`lib/datos/repositorio.ts`) con dos
implementaciones. El build de la demo no incluye ni el cliente de Supabase ni
su URL o clave.

## Desarrollo local

Requisitos: Node.js 22 o superior.

```bash
npm install
cp .env.example .env.local   # rellenar con los datos del proyecto de Supabase
npm run dev                  # versión real
npm run dev:demo             # demo (no necesita Supabase)
npm test                     # tests de reglas y del repositorio
```

Abre http://localhost:3000.

## Base de datos

El esquema está en `supabase/migrations/` y la prueba de aislamiento entre
usuarios en `supabase/tests/rls.sql` (ver "Cómo aplicar migraciones" en el plan).
