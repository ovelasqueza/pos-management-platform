-- DIAGNÓSTICO (no guarda nada): simula lo que hace Supabase Auth al crear un usuario.
-- Pegar en SQL Editor y pulsar Run. Siempre termina en "error" a propósito (para deshacer todo):
--   · "DIAGNOSTICO: perfil creado = diagnostico"  → el trigger funciona.
--   · "DIAGNOSTICO: perfil creado = NO"            → el trigger no se ejecutó.
--   · Cualquier otro mensaje                       → es el error real; copiarlo completo.

do $$
declare
  v_id uuid := '11111111-1111-1111-1111-111111111111';
  v_usuario text;
  v_triggers text;
begin
  select string_agg(tgname || ' → ' || tgfoid::regproc::text, ', ')
  into v_triggers
  from pg_trigger
  where tgrelid = 'auth.users'::regclass and not tgisinternal;

  -- Paso 1 de Auth: inserta el usuario (solo con el proveedor)
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'diagnostico@pos.local', '{"provider":"email","providers":["email"]}', '{}', now(), now());

  -- Paso 2 de Auth: escribe app_metadata
  update auth.users
  set raw_app_meta_data = raw_app_meta_data
    || '{"rol":"admin","nombre_usuario":"diagnostico","nombre_completo":"Diagnostico"}'::jsonb
  where id = v_id;

  select nombre_usuario into v_usuario from public.perfiles where id = v_id;

  raise exception 'DIAGNOSTICO: perfil creado = % | triggers en auth.users: %',
    coalesce(v_usuario, 'NO'), coalesce(v_triggers, 'ninguno');
end;
$$;
