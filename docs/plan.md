# Cotiza — plan del proyecto

Gestor de presupuestos genérico para pequeños negocios: clientes, catálogo con
variantes, presupuestos con PDF y estados, y multimoneda. Se enlaza desde el
portafolio (https://micheldiazc.github.io) con una demo pública de datos ficticios.

Nace de la experiencia con un sistema hecho a medida para un negocio de
impresión. Se reutilizan ideas, nunca datos, nombres ni marca del original.

## Alcance del MVP

1. **Autenticación**: Supabase Auth con correo y contraseña. Cada usuario
   (negocio) ve y modifica solo sus propios datos.
2. **Clientes**: alta, edición, búsqueda y baja (nombre, documento, teléfono, correo).
3. **Catálogo**: productos/servicios con variantes (p. ej. tamaño o acabado),
   cada variante con su precio en la moneda base.
4. **Presupuestos**:
   - Líneas con variante, cantidad y precio unitario (editable).
   - Descuento e IVA opcionales.
   - Estados: `borrador` → `enviado` → `aceptado` / `rechazado`.
   - PDF descargable.
5. **Multimoneda**: moneda base del negocio, tasas configurables a mano y
   botón opcional para traer la tasa oficial BCV (USD/EUR → Bs). El presupuesto
   guarda la tasa usada, así el total no cambia si la tasa cambia después.
6. **Demo**: versión que funciona solo en el navegador, sin Supabase, con datos
   ficticios (ver "Modo demo").

### Extras posteriores (por orden de valor)

1. Marca del negocio en el PDF (logo, colores, datos de contacto).
2. Convertir un presupuesto aceptado en pedido/factura simple.
3. Dashboard: ventas y tasa de aceptación.
4. Enlace público de solo lectura para que el cliente vea y acepte el presupuesto.

## Stack

| Capa | Elección |
| --- | --- |
| Framework | Next.js 16 (App Router) + TypeScript |
| UI | Tailwind CSS 4 + shadcn/ui |
| Datos y auth | Supabase (Postgres + Auth) con `@supabase/ssr` |
| PDF | jsPDF + jspdf-autotable |
| Despliegue | Vercel |

## Seguridad (no negociable)

- Proyecto de Supabase **nuevo**, exclusivo de Cotiza.
- **RLS activado en todas las tablas desde la primera migración.** Cada tabla
  tiene `user_id uuid not null default auth.uid() references auth.users`
  y políticas para `select`, `insert`, `update` y `delete` con
  `user_id = auth.uid()`.
- Nada accesible de forma anónima: ninguna política para el rol `anon`.
- La clave `service_role` nunca llega al navegador ni al repositorio; solo se
  usa, si hace falta, en scripts locales (p. ej. el seed).
- Rutas protegidas en el servidor: `proxy.ts` (antes `middleware.ts`) refresca
  la sesión y redirige a `/login`; además, cada página o acción del servidor
  comprueba el usuario con `supabase.auth.getUser()`.
- El esquema vive en `supabase/migrations/` como SQL versionado.
- FK compuestas `(id, user_id)` entre tablas: las FK se comprueban sin RLS, así
  que sin ellas un usuario podría relacionar sus filas con filas de otro.
- `supabase/tests/rls.sql` demuestra el aislamiento entre usuarios. Se ejecuta
  tras cada cambio de esquema y debe terminar en "RLS OK".

### Cómo aplicar migraciones

La red de desarrollo corta las conexiones Postgres al pooler de Supabase, así
que `supabase db push` no funciona desde aquí. Mientras tanto:

1. Pegar la migración nueva en *SQL Editor* dentro de `begin … commit`, junto con
   `insert into supabase_migrations.schema_migrations (version, name) values (…)`
   para que la CLI la considere aplicada.
2. Pegar `supabase/tests/rls.sql` y comprobar "RLS OK".
3. Revisar *Advisors → Security Advisor*.

## Modo demo

La demo pública no usa Supabase: en el plan gratuito los proyectos inactivos se
pausan, y la demo del portafolio tiene que estar siempre disponible.

- **Capa de repositorio**: las pantallas piden "listar clientes", "guardar
  presupuesto", etc. a una interfaz de TypeScript. Hay dos implementaciones:
  - `RepositorioSupabase`: versión real, con login y RLS.
  - `RepositorioNavegador`: IndexedDB, los datos se quedan en el navegador del visitante.
- `NEXT_PUBLIC_DEMO_MODE=true` elige la implementación al compilar; el código de
  Supabase queda fuera del bundle de la demo, y ese despliegue no tiene la URL
  ni la clave de Supabase.
- Las pantallas de datos leen y escriben desde el navegador (en la versión real
  la seguridad la pone RLS). El login sigue con Server Actions y `proxy.ts`, y
  en modo demo no existe: se entra directamente.
- Datos de ejemplo de un negocio inventado, aviso fijo "Demo: tus datos se
  guardan solo en este navegador" y botón "Restablecer demo".
- Tasas BCV fijas de ejemplo, sin llamadas externas.
- Publicación: dos proyectos de Vercel desde el mismo repo (`cotiza` real y
  `cotiza-demo` con la variable activada). GitHub Pages no sirve: la exportación
  estática de Next no admite `proxy.ts`, Server Actions ni cookies.

## Modelo de datos previsto

Todas las tablas incluyen `id`, `user_id`, `created_at`.

- `ajustes_negocio`: nombre, moneda base, IVA por defecto, datos de contacto (una fila por usuario).
- `tasas`: moneda origen, moneda destino, valor, fuente (`manual` / `bcv`), fecha.
- `clientes`: nombre, documento, teléfono, correo, notas.
- `productos`: nombre, descripción, activo.
- `variantes`: `producto_id`, nombre, precio.
- `presupuestos`: código, `cliente_id`, estado, moneda, tasa aplicada,
  descuento, IVA, totales, notas, fechas de emisión y vencimiento.
- `presupuesto_items`: `presupuesto_id`, `variante_id` (opcional), descripción
  copiada, cantidad, precio unitario. Se copia la descripción para que el
  presupuesto no cambie si luego se edita el catálogo.

## Etapas

1. ✅ Alcance, stack y esqueleto que arranca en local.
2. ✅ Conectar Supabase: proyecto nuevo, variables de entorno, clientes de
   `@supabase/ssr`, `proxy.ts`, login/registro/logout.
   - **Pendiente:** "Confirm email" está **desactivado** en Supabase mientras
     desarrollamos (el correo por defecto tiene un límite muy bajo y no permite
     editar plantillas). Se reactiva en la etapa 7.
3. ✅ Primera migración con tablas + RLS, y prueba de que un usuario no ve
   datos de otro ("RLS OK").
   - Security Advisor revisado: se cerró `rls_auto_enable()` a la API (función
     de Supabase para RLS automático, quedó ejecutable por anon/authenticated).
   - Aviso aceptado: "Leaked Password Protection" (HaveIBeenPwned) no está
     disponible en el plan gratuito. Compensación: longitud mínima de
     contraseña 8 también en Supabase Auth, no solo en el formulario.
3b. ✅ Capa de repositorio y modo demo.
   - `lib/datos/`: tipos, reglas compartidas (validaciones, totales, estados),
     interfaz `Repositorio` e implementaciones `supabase.ts` y `navegador/`.
   - 35 tests con Vitest (`npm test`): reglas y contrato del repositorio contra
     IndexedDB en memoria (fake-indexeddb).
   - Verificado: el build demo no contiene la URL ni la clave de Supabase ni su
     cliente; el build real no contiene el código ni los datos de la demo.
   - Resuelto en la etapa 5: guardar presupuesto + líneas es atómico en Supabase
     (función `guardar_presupuesto`).
   - Resuelto en la etapa 4: repositorio de Supabase probado con sesión real.
4. ✅ Clientes, catálogo y ajustes del negocio.
   - Zona privada `app/(app)/` con cabecera y menú comunes.
   - Formularios en ventana modal; avisos con sonner; borrados con confirmación.
   - Probado en la demo: crear/editar/borrar, reglas de borrado, búsqueda sin
     tildes, precios "1.234,50", productos inactivos y persistencia al recargar.
5. ✅ Presupuestos, estados y PDF.
   - Listado con filtro por estado, editor a página completa (líneas del
     catálogo o libres, totales en vivo, moneda y tasa) y ficha con acciones
     según el estado.
   - PDF con jsPDF en el navegador (se carga solo al pulsar el botón).
   - Precios en moneda base; en otra moneda se convierte cada precio unitario
     y se redondea antes de calcular, para que el PDF cuadre al céntimo.
   - `guardar_presupuesto` (Postgres, security invoker): crea/actualiza con sus
     líneas en una transacción y solo edita borradores. Cubierto en `rls.sql`.
   - Next 16 conserva las páginas ocultas al navegar (`<Activity>`): el editor
     se reinicia tras crear, y las rutas con `[id]` usan `<Suspense>`.
6. Multimoneda y tasa BCV.
7. Despliegue en Vercel (versión real y demo).
   - SMTP propio (p. ej. Resend): el correo por defecto de Supabase solo envía
     a miembros del equipo del proyecto.
   - Plantilla "Confirm signup" en español con
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`, para
     que el enlace funcione en cualquier navegador o dispositivo (la ruta
     `/auth/confirm` ya lo admite).
   - Reactivar "Confirm email" y probar el enlace de confirmación.
   - Actualizar Site URL y Redirect URLs con el dominio de Vercel.
