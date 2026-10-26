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
6. **Demo**: cuenta de demostración con datos ficticios (seed) para el portafolio.

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
3. Primera migración con tablas + RLS, y pruebas de que un usuario no ve datos de otro.
4. Clientes y catálogo.
5. Presupuestos, estados y PDF.
6. Multimoneda y tasa BCV.
7. Seed de demo y despliegue en Vercel.
   - SMTP propio (p. ej. Resend): el correo por defecto de Supabase solo envía
     a miembros del equipo del proyecto.
   - Plantilla "Confirm signup" en español con
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`, para
     que el enlace funcione en cualquier navegador o dispositivo (la ruta
     `/auth/confirm` ya lo admite).
   - Reactivar "Confirm email" y probar el enlace de confirmación.
   - Actualizar Site URL y Redirect URLs con el dominio de Vercel.
