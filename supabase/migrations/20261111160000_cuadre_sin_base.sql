-- ─────────────────────────────────────────────────────────────────────────────
-- Cuadre sin base fija:
-- La base física de $100.000 es fija e intocable en el cajón y nunca se cuenta
-- ni en el turno de entrada ni en el de salida.
-- El efectivo esperado son exclusivamente las ventas en efectivo menos los gastos de caja.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.abrir_turno(p_base int default 0) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_usuario public.perfiles;
  v_id uuid;
  v_dispositivo text;
  v_base int := coalesce(p_base, 0);
begin
  select * into v_usuario from public.perfiles where id = auth.uid() and activo;
  if v_usuario.id is null or v_usuario.rol <> 'cajero' or v_usuario.sede_id is null then
    raise exception 'SOLO_CAJERO';
  end if;

  if exists (
    select 1 from public.turnos
    where cajero_id = v_usuario.id and cerrado_en is null
  ) then
    raise exception 'TURNO_YA_ABIERTO';
  end if;

  if exists (
    select 1 from public.turnos
    where sede_id = v_usuario.sede_id and cerrado_en is null
  ) then
    raise exception 'CAJA_OCUPADA';
  end if;

  v_dispositivo := nullif(trim(coalesce(current_setting('request.cookie.pos_dispositivo', true), '')), '');

  insert into public.turnos (sede_id, cajero_id, base, dispositivo)
  values (v_usuario.sede_id, v_usuario.id, v_base, v_dispositivo)
  returning id into v_id;

  return v_id;
end;
$$;

-- Efectivo esperado: ventas en efectivo menos gastos de caja (sin sumar la base)
create or replace function privado.efectivo_esperado(p_turno uuid) returns int
language sql stable security definer set search_path = '' as $$
  select (
    coalesce((select sum(v.total) from public.ventas v
              where v.turno_id = t.id and v.metodo = 'efectivo' and v.anulada_en is null), 0)
    - coalesce((select sum(g.monto_caja) from public.gastos g
                where g.turno_id = t.id and g.anulado_en is null), 0)
  )::int
  from public.turnos t
  where t.id = p_turno;
$$;
