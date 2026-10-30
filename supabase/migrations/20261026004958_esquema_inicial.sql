-- =============================================================================
-- Cotiza — esquema inicial
--
-- Reglas que siguen todas las tablas:
--   * user_id = dueño de la fila. Por defecto auth.uid(), así la app no lo envía.
--   * RLS activado y cuatro políticas (select/insert/update/delete) para el rol
--     authenticated con user_id = auth.uid(). Ninguna política para anon.
--   * Las relaciones entre tablas usan FK compuestas (id, user_id): las FK se
--     comprueban sin RLS, así que sin esto un usuario podría colgar filas suyas
--     de filas de otro usuario si conociera su id.
--   * Dinero en numeric, nunca float.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Funciones auxiliares
-- -----------------------------------------------------------------------------

-- Mantiene updated_at al día en cada UPDATE.
create function public.tocar_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- -----------------------------------------------------------------------------
-- ajustes_negocio: una fila por usuario con los datos del negocio
-- -----------------------------------------------------------------------------
create table public.ajustes_negocio (
  user_id          uuid primary key default auth.uid() references auth.users on delete cascade,
  nombre_negocio   text,
  documento        text,                      -- RIF, NIF, CUIT...
  telefono         text,
  email            text,
  direccion        text,
  moneda_base      text not null default 'USD' check (moneda_base ~ '^[A-Z]{3}$'),
  iva_porcentaje   numeric(5,2) not null default 0 check (iva_porcentaje between 0 and 100),
  siguiente_numero integer not null default 1 check (siguiente_numero > 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);


-- -----------------------------------------------------------------------------
-- tasas: historial de tasas de cambio (1 moneda_origen = valor moneda_destino)
-- -----------------------------------------------------------------------------
create table public.tasas (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  moneda_origen  text not null check (moneda_origen ~ '^[A-Z]{3}$'),
  moneda_destino text not null check (moneda_destino ~ '^[A-Z]{3}$'),
  valor          numeric(18,6) not null check (valor > 0),
  fuente         text not null default 'manual' check (fuente in ('manual', 'bcv')),
  fecha          date not null default current_date,
  created_at     timestamptz not null default now(),
  check (moneda_origen <> moneda_destino)
);
create index tasas_user_par_fecha_idx on public.tasas (user_id, moneda_origen, moneda_destino, fecha desc);


-- -----------------------------------------------------------------------------
-- clientes
-- -----------------------------------------------------------------------------
create table public.clientes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  nombre     text not null check (length(trim(nombre)) > 0),
  documento  text,
  telefono   text,
  email      text,
  direccion  text,
  notas      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index clientes_user_id_idx on public.clientes (user_id);


-- -----------------------------------------------------------------------------
-- productos y variantes (precio en la moneda base del negocio)
-- -----------------------------------------------------------------------------
create table public.productos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  nombre      text not null check (length(trim(nombre)) > 0),
  descripcion text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id)
);
create index productos_user_id_idx on public.productos (user_id);

create table public.variantes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  producto_id uuid not null,
  nombre      text not null check (length(trim(nombre)) > 0),
  precio      numeric(12,2) not null check (precio >= 0),
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id),
  foreign key (producto_id, user_id) references public.productos (id, user_id) on delete cascade
);
create index variantes_user_id_idx on public.variantes (user_id);
create index variantes_producto_id_idx on public.variantes (producto_id);


-- -----------------------------------------------------------------------------
-- presupuestos
-- -----------------------------------------------------------------------------
create table public.presupuestos (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users on delete cascade,
  numero               integer not null,     -- lo asigna el trigger; la app muestra P-0001
  cliente_id           uuid not null,
  estado               text not null default 'borrador'
                         check (estado in ('borrador', 'enviado', 'aceptado', 'rechazado')),
  moneda               text not null check (moneda ~ '^[A-Z]{3}$'),
  tasa                 numeric(18,6) not null default 1 check (tasa > 0), -- 1 moneda base = tasa moneda
  descuento_porcentaje numeric(5,2) not null default 0 check (descuento_porcentaje between 0 and 100),
  iva_porcentaje       numeric(5,2) not null default 0 check (iva_porcentaje between 0 and 100),
  subtotal             numeric(12,2) not null default 0 check (subtotal >= 0),
  total                numeric(12,2) not null default 0 check (total >= 0),
  notas                text,
  fecha_emision        date not null default current_date,
  fecha_vencimiento    date,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, numero),
  check (fecha_vencimiento is null or fecha_vencimiento >= fecha_emision),
  -- Sin "on delete": no se puede borrar un cliente que tenga presupuestos.
  foreign key (cliente_id, user_id) references public.clientes (id, user_id)
);
create index presupuestos_user_estado_idx on public.presupuestos (user_id, estado);
create index presupuestos_cliente_id_idx on public.presupuestos (cliente_id);

-- Asigna el siguiente número del usuario. El upsert bloquea la fila de
-- ajustes_negocio hasta el final de la transacción, así que dos presupuestos
-- creados a la vez nunca reciben el mismo número. Corre con los permisos del
-- usuario (security invoker), por lo que RLS sigue aplicando.
create function public.asignar_numero_presupuesto()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.ajustes_negocio as a (user_id, siguiente_numero)
  values (new.user_id, 2)
  on conflict (user_id) do update set siguiente_numero = a.siguiente_numero + 1
  returning a.siguiente_numero - 1 into new.numero;
  return new;
end;
$$;

create trigger presupuestos_asignar_numero
  before insert on public.presupuestos
  for each row execute function public.asignar_numero_presupuesto();


-- -----------------------------------------------------------------------------
-- presupuesto_items: copian descripción y precio para que el presupuesto no
-- cambie si luego se edita el catálogo
-- -----------------------------------------------------------------------------
create table public.presupuesto_items (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users on delete cascade,
  presupuesto_id  uuid not null,
  variante_id     uuid,
  descripcion     text not null check (length(trim(descripcion)) > 0),
  cantidad        numeric(12,2) not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null check (precio_unitario >= 0),
  orden           integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (presupuesto_id, user_id) references public.presupuestos (id, user_id) on delete cascade,
  -- Si se borra la variante, el ítem se queda (con su descripción copiada).
  -- "set null (variante_id)" solo vacía esa columna, no user_id.
  foreign key (variante_id, user_id) references public.variantes (id, user_id) on delete set null (variante_id)
);
create index presupuesto_items_user_id_idx on public.presupuesto_items (user_id);
create index presupuesto_items_presupuesto_id_idx on public.presupuesto_items (presupuesto_id, orden);
create index presupuesto_items_variante_id_idx on public.presupuesto_items (variante_id);


-- -----------------------------------------------------------------------------
-- Triggers de updated_at
-- -----------------------------------------------------------------------------
create trigger ajustes_negocio_updated_at before update on public.ajustes_negocio
  for each row execute function public.tocar_updated_at();
create trigger clientes_updated_at before update on public.clientes
  for each row execute function public.tocar_updated_at();
create trigger productos_updated_at before update on public.productos
  for each row execute function public.tocar_updated_at();
create trigger variantes_updated_at before update on public.variantes
  for each row execute function public.tocar_updated_at();
create trigger presupuestos_updated_at before update on public.presupuestos
  for each row execute function public.tocar_updated_at();
create trigger presupuesto_items_updated_at before update on public.presupuesto_items
  for each row execute function public.tocar_updated_at();


-- -----------------------------------------------------------------------------
-- Row Level Security: mismas cuatro políticas en cada tabla
--
--   using      → qué filas existentes puedes ver/modificar/borrar
--   with check → cómo deben quedar las filas que escribes (evita, por ejemplo,
--                cambiar el user_id de tu fila para "regalársela" a otro)
--
-- (select auth.uid()) entre paréntesis: Postgres lo evalúa una vez por
-- consulta y no una vez por fila.
-- -----------------------------------------------------------------------------
do $$
declare
  tabla text;
begin
  foreach tabla in array array[
    'ajustes_negocio', 'tasas', 'clientes', 'productos',
    'variantes', 'presupuestos', 'presupuesto_items'
  ]
  loop
    execute format('alter table public.%I enable row level security', tabla);

    execute format(
      'create policy "%1$s: ver los propios" on public.%1$I for select to authenticated
         using ((select auth.uid()) = user_id)', tabla);
    execute format(
      'create policy "%1$s: crear los propios" on public.%1$I for insert to authenticated
         with check ((select auth.uid()) = user_id)', tabla);
    execute format(
      'create policy "%1$s: editar los propios" on public.%1$I for update to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)', tabla);
    execute format(
      'create policy "%1$s: borrar los propios" on public.%1$I for delete to authenticated
         using ((select auth.uid()) = user_id)', tabla);

    -- Segundo cerrojo: el rol anónimo no tiene ni permisos sobre la tabla.
    execute format('revoke all on table public.%I from anon', tabla);
  end loop;
end;
$$;

-- Las tablas que se creen en el futuro tampoco darán permisos a anon por defecto.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- Las funciones de trigger no se llaman directamente.
revoke execute on function public.tocar_updated_at() from public, anon, authenticated;
revoke execute on function public.asignar_numero_presupuesto() from public, anon, authenticated;
