# Cotiza

Gestor de presupuestos para pequeños negocios: clientes, catálogo con variantes,
presupuestos con estados y PDF, y multimoneda con la tasa oficial del BCV.

**[Probar la demo →](https://cotiza-demo-iota.vercel.app)** · sin registro, con datos de ejemplo de un negocio ficticio.

## Qué hace

- **Clientes** con búsqueda que ignora tildes y mayúsculas.
- **Catálogo** de productos y servicios con variantes y precios; los productos se
  pueden desactivar sin perder los presupuestos antiguos.
- **Presupuestos**: editor con líneas del catálogo o libres, totales en vivo,
  descuento e IVA, numeración correlativa por negocio (`P-0001`) y flujo de
  estados *borrador → enviado → aceptado / rechazado*. Solo se editan borradores.
- **PDF** generado en el navegador con los datos del negocio y del cliente.
- **Multimoneda**: precios en la moneda base y presupuestos en cualquier otra con
  su tasa. Botón para traer la tasa oficial del BCV (USD/EUR → Bs).

## Demo

La demo funciona **solo en el navegador**: no hay login ni servidor de datos.
Todo se guarda en IndexedDB del visitante y el botón «Restablecer demo» vuelve a
los datos de ejemplo. Así está siempre disponible y cada visitante ve solo lo suyo.

## Stack

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS 4 + shadcn/ui ·
Supabase (Postgres + Auth) · jsPDF · Vitest · Vercel.

## Decisiones técnicas

### Seguridad en la base de datos, no en el frontend

- **Row Level Security en todas las tablas** desde la primera migración: cuatro
  políticas por tabla con `user_id = (select auth.uid())`, solo para `authenticated`.
  El rol anónimo no tiene ni permisos sobre las tablas.
- **Claves foráneas compuestas `(id, user_id)`**. Las FK se comprueban sin RLS:
  con una FK simple, un usuario podría colgar sus filas de las de otro usuario si
  conociera su id. Con la compuesta, la base de datos garantiza que ambas filas
  son del mismo dueño.
- **Guardado atómico**: `guardar_presupuesto` es una función de Postgres
  (`security invoker`, así que RLS sigue aplicando) que guarda el presupuesto y
  sus líneas en una transacción y rechaza editar presupuestos ya enviados.
- **Prueba de aislamiento** en [`supabase/tests/rls.sql`](supabase/tests/rls.sql):
  crea dos usuarios dentro de una transacción con `rollback` y demuestra que uno
  no puede ver, modificar ni referenciar los datos del otro.
- Rutas protegidas en tres capas: `proxy.ts` redirige sin sesión, cada página
  vuelve a comprobar el usuario y RLS tiene la última palabra.

### Un mismo código, dos almacenes

Las pantallas usan una interfaz, [`Repositorio`](lib/datos/repositorio.ts), con
dos implementaciones: Supabase (versión real) e IndexedDB (demo). La variable
`NEXT_PUBLIC_DEMO_MODE` elige una **al compilar**: el build de la demo no contiene
ni el cliente de Supabase ni su URL o clave (verificado buscando en `.next/static`).

Las reglas de negocio (validaciones, totales, transiciones de estado) están en un
solo módulo que usan las dos implementaciones, y una **batería de tests de
contrato** comprueba que el repositorio las cumple.

### Dinero

`numeric` en Postgres, redondeo a céntimos en cada línea y, en otra moneda, el
precio unitario se convierte y redondea antes de multiplicar: lo que ve el
cliente en el PDF siempre suma al céntimo.

## Desarrollo local

Requisitos: Node.js 22 o superior.

```bash
npm install
npm run dev:demo   # demo: no necesita Supabase
npm test           # 66 tests (reglas, repositorio, PDF, formatos, BCV)
```

Para la versión real, copia `.env.example` como `.env.local` con los datos de un
proyecto de Supabase, aplica las migraciones de `supabase/migrations/` y ejecuta
`npm run dev`. El plan y las decisiones de cada etapa están en
[docs/plan.md](docs/plan.md).

## Estructura

```
app/(auth)/        login y registro (Server Actions)
app/(app)/         zona privada: panel, presupuestos, clientes, catálogo, ajustes
app/api/tasas/bcv  consulta de la tasa oficial desde el servidor
lib/datos/         tipos, reglas, interfaz Repositorio e implementaciones
lib/pdf.ts         generación del PDF
supabase/          migraciones SQL y prueba de RLS
```
