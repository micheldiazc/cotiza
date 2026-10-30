-- =============================================================================
-- Prueba de aislamiento entre usuarios (RLS + FK compuestas)
--
-- Se ejecuta entera dentro de una transacción que termina en ROLLBACK:
-- no deja usuarios ni datos. Si alguna comprobación falla, lanza un error
-- explicando cuál. Si todo va bien, el último mensaje es "RLS OK".
--
-- Cómo ejecutarla: pegar el archivo completo en Supabase > SQL Editor y Run
-- (o, si la red lo permite: npx supabase db query --linked -f supabase/tests/rls.sql).
-- =============================================================================
begin;

-- Dos usuarios ficticios ------------------------------------------------------
insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-4000-a000-00000000000a', 'prueba-a@rls.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-00000000000b', 'prueba-b@rls.test', 'authenticated', 'authenticated');


-- Como A: crea un cliente, un producto con variante y dos presupuestos ---------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-a000-00000000000a", "role": "authenticated"}';

insert into public.clientes (id, nombre) values ('00000000-0000-4000-b000-0000000000a1', 'Cliente de A');
insert into public.productos (id, nombre) values ('00000000-0000-4000-b000-0000000000a2', 'Producto de A');
insert into public.variantes (id, producto_id, nombre, precio)
values ('00000000-0000-4000-b000-0000000000a3', '00000000-0000-4000-b000-0000000000a2', 'Única', 10);
insert into public.presupuestos (id, cliente_id, moneda)
values ('00000000-0000-4000-b000-0000000000a4', '00000000-0000-4000-b000-0000000000a1', 'USD'),
       ('00000000-0000-4000-b000-0000000000a5', '00000000-0000-4000-b000-0000000000a1', 'USD');

do $$
begin
  if (select array_agg(numero order by numero) from public.presupuestos) <> array[1, 2] then
    raise exception 'FALLO: A debería tener los presupuestos 1 y 2';
  end if;
  raise notice 'ok: A crea sus datos y sus presupuestos se numeran 1, 2';
end;
$$;


-- Como B: no ve ni toca nada de A ----------------------------------------------
set local request.jwt.claims = '{"sub": "00000000-0000-4000-a000-00000000000b", "role": "authenticated"}';

do $$
declare
  n integer;
begin
  -- Lectura
  if exists (select 1 from public.clientes)
     or exists (select 1 from public.productos)
     or exists (select 1 from public.variantes)
     or exists (select 1 from public.presupuestos)
     or exists (select 1 from public.ajustes_negocio) then
    raise exception 'FALLO: B puede ver datos de A';
  end if;
  raise notice 'ok: B no ve datos de A';

  -- Modificación y borrado: RLS los convierte en "0 filas afectadas"
  update public.clientes set nombre = 'hackeado' where id = '00000000-0000-4000-b000-0000000000a1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO: B pudo editar un cliente de A'; end if;

  delete from public.presupuestos where id = '00000000-0000-4000-b000-0000000000a4';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO: B pudo borrar un presupuesto de A'; end if;
  raise notice 'ok: B no puede editar ni borrar datos de A';

  -- Insertar una fila a nombre de A
  begin
    insert into public.clientes (user_id, nombre)
    values ('00000000-0000-4000-a000-00000000000a', 'Intruso');
    raise exception 'FALLO: B pudo crear un cliente a nombre de A';
  exception when insufficient_privilege then
    raise notice 'ok: B no puede crear filas a nombre de A';
  end;

  -- Colgar un ítem suyo del presupuesto de A (lo frena la FK compuesta)
  begin
    insert into public.presupuesto_items (presupuesto_id, descripcion, cantidad, precio_unitario)
    values ('00000000-0000-4000-b000-0000000000a4', 'Intruso', 1, 1);
    raise exception 'FALLO: B pudo añadir un ítem al presupuesto de A';
  exception when foreign_key_violation then
    raise notice 'ok: B no puede añadir ítems a presupuestos de A';
  end;

  -- Crear un presupuesto suyo apuntando al cliente de A
  begin
    insert into public.presupuestos (cliente_id, moneda)
    values ('00000000-0000-4000-b000-0000000000a1', 'USD');
    raise exception 'FALLO: B pudo usar un cliente de A';
  exception when foreign_key_violation then
    raise notice 'ok: B no puede usar clientes de A';
  end;

  -- Usar una variante de A en un ítem de su propio presupuesto
  insert into public.clientes (id, nombre) values ('00000000-0000-4000-b000-0000000000b1', 'Cliente de B');
  insert into public.presupuestos (id, cliente_id, moneda)
  values ('00000000-0000-4000-b000-0000000000b4', '00000000-0000-4000-b000-0000000000b1', 'USD');
  begin
    insert into public.presupuesto_items (presupuesto_id, variante_id, descripcion, cantidad, precio_unitario)
    values ('00000000-0000-4000-b000-0000000000b4', '00000000-0000-4000-b000-0000000000a3', 'Intruso', 1, 1);
    raise exception 'FALLO: B pudo usar una variante de A';
  exception when foreign_key_violation then
    raise notice 'ok: B no puede usar variantes de A';
  end;

  -- Usar guardar_presupuesto sobre un presupuesto de A: para B "no existe"
  begin
    perform public.guardar_presupuesto(
      '00000000-0000-4000-b000-0000000000a4',
      '{"cliente_id": "00000000-0000-4000-b000-0000000000b1", "moneda": "USD", "subtotal": 0, "total": 0}',
      '[]'
    );
    raise exception 'FALLO: B pudo editar un presupuesto de A con guardar_presupuesto';
  exception when sqlstate 'P0002' then
    raise notice 'ok: B no puede usar guardar_presupuesto sobre presupuestos de A';
  end;

  -- La numeración es independiente por usuario
  if (select numero from public.presupuestos where id = '00000000-0000-4000-b000-0000000000b4') <> 1 then
    raise exception 'FALLO: el primer presupuesto de B debería ser el 1';
  end if;
  raise notice 'ok: B empieza su numeración en 1';
end;
$$;


-- Como A: guardar_presupuesto es atómico y respeta el estado --------------------
set local request.jwt.claims = '{"sub": "00000000-0000-4000-a000-00000000000a", "role": "authenticated"}';

do $$
declare
  v_id uuid;
begin
  v_id := public.guardar_presupuesto(
    null,
    '{"cliente_id": "00000000-0000-4000-b000-0000000000a1", "moneda": "USD", "subtotal": 30, "total": 30}',
    '[{"descripcion": "Uno", "cantidad": 1, "precio_unitario": 10},
      {"descripcion": "Dos", "cantidad": 2, "precio_unitario": 10}]'
  );
  if (select numero from public.presupuestos where id = v_id) <> 3
     or (select string_agg(descripcion, ',' order by orden) from public.presupuesto_items where presupuesto_id = v_id) <> 'Uno,Dos' then
    raise exception 'FALLO: guardar_presupuesto no creó bien el presupuesto 3 con sus líneas';
  end if;

  perform public.guardar_presupuesto(
    v_id,
    '{"cliente_id": "00000000-0000-4000-b000-0000000000a1", "moneda": "USD", "subtotal": 5, "total": 5}',
    '[{"descripcion": "Solo una", "cantidad": 1, "precio_unitario": 5}]'
  );
  if (select count(*) from public.presupuesto_items where presupuesto_id = v_id) <> 1 then
    raise exception 'FALLO: al editar no se sustituyeron las líneas';
  end if;

  -- Una línea inválida deshace TODO (atomicidad): el presupuesto no cambia.
  begin
    perform public.guardar_presupuesto(
      v_id,
      '{"cliente_id": "00000000-0000-4000-b000-0000000000a1", "moneda": "USD", "subtotal": 99, "total": 99}',
      '[{"descripcion": "Bien", "cantidad": 1, "precio_unitario": 99},
        {"descripcion": "Mal", "cantidad": -1, "precio_unitario": 1}]'
    );
    raise exception 'FALLO: se aceptó una línea con cantidad negativa';
  exception when check_violation then
    if (select total from public.presupuestos where id = v_id) <> 5
       or (select count(*) from public.presupuesto_items where presupuesto_id = v_id) <> 1 then
      raise exception 'FALLO: un error a mitad dejó el presupuesto a medias';
    end if;
  end;

  update public.presupuestos set estado = 'enviado' where id = v_id;
  begin
    perform public.guardar_presupuesto(v_id, '{"cliente_id": "00000000-0000-4000-b000-0000000000a1", "moneda": "USD", "subtotal": 0, "total": 0}', '[]');
    raise exception 'FALLO: se pudo editar un presupuesto enviado';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'no_editable' then raise; end if;
  end;

  -- Deja a A con sus 2 presupuestos originales para la comprobación final.
  delete from public.presupuestos where id = v_id;
  raise notice 'ok: guardar_presupuesto crea, sustituye líneas, es atómico y respeta el estado';
end;
$$;


-- Como anónimo: sin acceso a ninguna tabla --------------------------------------
reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

do $$
declare
  tabla text;
begin
  foreach tabla in array array[
    'ajustes_negocio', 'tasas', 'clientes', 'productos',
    'variantes', 'presupuestos', 'presupuesto_items'
  ]
  loop
    begin
      execute format('select 1 from public.%I limit 1', tabla);
      raise exception 'FALLO: anon puede leer %', tabla;
    exception when insufficient_privilege then
      null;
    end;
  end loop;
  raise notice 'ok: anon no puede leer ninguna tabla';
end;
$$;


-- Los datos de A siguen intactos -------------------------------------------------
reset role;
do $$
begin
  if (select nombre from public.clientes where id = '00000000-0000-4000-b000-0000000000a1') <> 'Cliente de A'
     or (select count(*) from public.presupuestos where user_id = '00000000-0000-4000-a000-00000000000a') <> 2 then
    raise exception 'FALLO: los datos de A cambiaron';
  end if;
  raise notice 'RLS OK';
end;
$$;

rollback;

-- Solo se llega aquí si ninguna comprobación anterior lanzó un error.
select 'RLS OK' as resultado;
