

create or replace function privado.crear_perfil_desde_auth() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_app_meta_data, '{}'::jsonb);
begin
  if meta ->> 'rol' is null then
    return new; -- aún sin rol: se creará cuando Auth escriba app_metadata
  end if;
  if exists (select 1 from public.perfiles p where p.id = new.id) then
    return new;
  end if;

  insert into public.perfiles (id, nombre_completo, nombre_usuario, rol, sede_id)
  values (
    new.id,
    meta ->> 'Yeimi',
    meta ->> 'nombre_usuario',
    (meta ->> 'rol')::public.rol_usuario,
    nullif(meta ->> 'sede_id', '')::uuid
  );
  return new;
end;
$$;

drop trigger if exists al_crear_usuario_auth on auth.users;

create trigger al_crear_usuario_auth
  after insert or update of raw_app_meta_data on auth.users
  for each row execute function privado.crear_perfil_desde_auth();
