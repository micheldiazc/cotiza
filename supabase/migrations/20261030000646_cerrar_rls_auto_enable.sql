-- =============================================================================
-- Cierra public.rls_auto_enable() a la API
--
-- Supabase crea esta función al activar "RLS automático" en el proyecto: un
-- event trigger que activa RLS en cada tabla nueva. Nos sirve como red de
-- seguridad, pero es SECURITY DEFINER y quedó ejecutable por anon y
-- authenticated vía /rest/v1/rpc/rls_auto_enable (aviso del Security Advisor).
--
-- Quitar EXECUTE no afecta al event trigger: Postgres solo comprueba ese
-- permiso al crear el trigger, no al dispararlo.
--
-- La función puede no existir (por ejemplo, en una base local), así que solo
-- se toca si está.
-- =============================================================================
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
