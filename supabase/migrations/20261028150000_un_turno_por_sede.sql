-- Regla (pedido del usuario, 2026-10-28): una sola caja por sede.
-- Solo puede haber UN turno abierto por sede. Otro cajero no puede abrir turno
-- hasta que el turno abierto se cierre (lo cierra su cajero o un admin).
-- Requiere: 20261028120000_caja.sql

create or replace function public.abrir_turno(p_base int) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_cajero public.perfiles := privado.exigir_cajero();
  v_otro text;
  v_id uuid;
begin
  if p_base is null or p_base < 0 or p_base > 999999999 then
    raise exception 'BASE_INVALIDA';
  end if;

  -- Serializa aperturas de la misma sede (evita dos aperturas simultáneas)
  perform pg_advisory_xact_lock(hashtext('turno_sede:' || v_cajero.sede_id::text));

  if exists (select 1 from public.turnos where cajero_id = v_cajero.id and cerrado_en is null) then
    raise exception 'TURNO_YA_ABIERTO';
  end if;

  select p.nombre_completo into v_otro
  from public.turnos t
  join public.perfiles p on p.id = t.cajero_id
  where t.sede_id = v_cajero.sede_id and t.cerrado_en is null
  limit 1;

  if v_otro is not null then
    raise exception 'CAJA_OCUPADA: %', v_otro;
  end if;

  insert into public.turnos (sede_id, cajero_id, base)
  values (v_cajero.sede_id, v_cajero.id, p_base)
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'TURNO_YA_ABIERTO';
end;
$$;

-- Turno abierto por OTRO cajero en la sede del cajero que consulta (o null).
-- El cajero no puede leer turnos ajenos por RLS; esta función solo expone nombre y hora.
create function public.turno_abierto_en_mi_sede() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_cajero public.perfiles := privado.exigir_cajero();
begin
  return (
    select jsonb_build_object('cajero', p.nombre_completo, 'abierto_en', t.abierto_en)
    from public.turnos t
    join public.perfiles p on p.id = t.cajero_id
    where t.sede_id = v_cajero.sede_id and t.cerrado_en is null and t.cajero_id <> v_cajero.id
    order by t.abierto_en
    limit 1
  );
end;
$$;

revoke all on function public.turno_abierto_en_mi_sede() from public, anon;
grant execute on function public.turno_abierto_en_mi_sede() to authenticated;
