-- =============================================================================
-- guardar_presupuesto: crea o actualiza un presupuesto y sus líneas en UNA
-- transacción (una función de Postgres siempre es atómica). Antes eran varias
-- peticiones HTTP y un fallo a mitad podía dejar un presupuesto sin líneas.
--
-- security invoker: corre con los permisos del usuario que la llama, así que
-- RLS se aplica igual que en una consulta normal. Un presupuesto de otro usuario
-- es invisible y la función responde "no_encontrado".
--
-- La app calcula subtotal y total con las mismas reglas que la demo
-- (lib/datos/reglas.ts); la base de datos repite los checks (>= 0, porcentajes...).
--
-- Errores (en el campo message, la app los traduce):
--   no_encontrado  → el presupuesto no existe o no es tuyo
--   no_editable    → solo se editan presupuestos en borrador
-- =============================================================================
create function public.guardar_presupuesto(
  p_id uuid,              -- null = crear uno nuevo
  p_presupuesto jsonb,    -- columnas de presupuestos (snake_case)
  p_items jsonb           -- array de líneas, en orden
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_estado text;
begin
  if p_id is null then
    -- numero lo asigna el trigger presupuestos_asignar_numero.
    insert into public.presupuestos (
      cliente_id, moneda, tasa, descuento_porcentaje, iva_porcentaje,
      subtotal, total, notas, fecha_emision, fecha_vencimiento
    )
    values (
      (p_presupuesto->>'cliente_id')::uuid,
      p_presupuesto->>'moneda',
      coalesce((p_presupuesto->>'tasa')::numeric, 1),
      coalesce((p_presupuesto->>'descuento_porcentaje')::numeric, 0),
      coalesce((p_presupuesto->>'iva_porcentaje')::numeric, 0),
      (p_presupuesto->>'subtotal')::numeric,
      (p_presupuesto->>'total')::numeric,
      p_presupuesto->>'notas',
      coalesce((p_presupuesto->>'fecha_emision')::date, current_date),
      (p_presupuesto->>'fecha_vencimiento')::date
    )
    returning id into v_id;
  else
    -- "for update" bloquea la fila: nadie puede cambiar su estado mientras la editamos.
    select estado into v_estado from public.presupuestos where id = p_id for update;
    if not found then
      raise exception 'no_encontrado' using errcode = 'P0002';
    end if;
    if v_estado <> 'borrador' then
      raise exception 'no_editable' using errcode = 'P0001';
    end if;

    update public.presupuestos set
      cliente_id           = (p_presupuesto->>'cliente_id')::uuid,
      moneda               = p_presupuesto->>'moneda',
      tasa                 = coalesce((p_presupuesto->>'tasa')::numeric, tasa),
      descuento_porcentaje = coalesce((p_presupuesto->>'descuento_porcentaje')::numeric, 0),
      iva_porcentaje       = coalesce((p_presupuesto->>'iva_porcentaje')::numeric, 0),
      subtotal             = (p_presupuesto->>'subtotal')::numeric,
      total                = (p_presupuesto->>'total')::numeric,
      notas                = p_presupuesto->>'notas',
      fecha_emision        = coalesce((p_presupuesto->>'fecha_emision')::date, fecha_emision),
      fecha_vencimiento    = (p_presupuesto->>'fecha_vencimiento')::date
    where id = p_id;

    delete from public.presupuesto_items where presupuesto_id = p_id;
    v_id := p_id;
  end if;

  insert into public.presupuesto_items (
    presupuesto_id, variante_id, descripcion, cantidad, precio_unitario, orden
  )
  select
    v_id,
    (linea->>'variante_id')::uuid,
    linea->>'descripcion',
    (linea->>'cantidad')::numeric,
    (linea->>'precio_unitario')::numeric,
    (posicion - 1)::integer
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) with ordinality as t(linea, posicion);

  return v_id;
end;
$$;

-- Solo usuarios con sesión pueden llamarla (vía /rest/v1/rpc/guardar_presupuesto).
revoke execute on function public.guardar_presupuesto(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.guardar_presupuesto(uuid, jsonb, jsonb) to authenticated;
