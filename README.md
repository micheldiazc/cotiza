# Cotiza

Gestor de presupuestos para pequeños negocios: clientes, catálogo con
variantes, presupuestos con PDF y estados, y multimoneda (con tasa BCV opcional).

Construido con Next.js 16, TypeScript, Tailwind CSS y Supabase (Auth + Postgres
con Row Level Security).

> En desarrollo. El alcance y las decisiones están en [docs/plan.md](docs/plan.md).

## Desarrollo local

Requisitos: Node.js 20 o superior.

```bash
npm install
cp .env.example .env.local   # rellenar con los datos del proyecto de Supabase
npm run dev
```

Abre http://localhost:3000.
