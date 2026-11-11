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

-- Cierre de turno: lo contado por el cajero corresponde a las ventas
create or replace function public.cerrar_turno(p_turno uuid, p_contado int, p_a_mayor int default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_usuario public.perfiles;
  v_turno public.turnos;
  v_esperado int;
  v_a_mayor int := coalesce(p_a_mayor, p_contado, 0);
  v_qr bigint;
  v_tarjeta bigint;
  v_reporte jsonb;
begin
  select * into v_usuario from public.perfiles where id = auth.uid() and activo;
  if v_usuario.id is null then
    raise exception 'SIN_PERMISO';
  end if;

  select * into v_turno from public.turnos where id = p_turno for update;
  if v_turno.id is null then
    raise exception 'TURNO_NO_EXISTE';
  end if;
  if v_usuario.rol = 'cajero' and v_turno.cajero_id <> v_usuario.id then
    raise exception 'SIN_PERMISO';
  end if;
  if v_turno.cerrado_en is not null then
    raise exception 'TURNO_CERRADO';
  end if;
  if p_contado is null or p_contado < 0 or p_contado > 999999999 then
    raise exception 'CONTADO_INVALIDO';
  end if;
  if v_a_mayor < 0 or v_a_mayor > p_contado then
    raise exception 'ENVIO_MAYOR_INVALIDO';
  end if;

  v_esperado := privado.efectivo_esperado(v_turno.id);
  v_reporte := privado.armar_reporte(v_turno.id, p_contado, v_esperado, v_usuario, v_a_mayor);

  update public.turnos set
    base = 0,
    cerrado_en = now(),
    cerrado_por = v_usuario.id,
    efectivo_contado = p_contado,
    efectivo_esperado = v_esperado,
    diferencia = p_contado - v_esperado,
    efectivo_a_mayor = v_a_mayor,
    reporte = v_reporte
  where id = v_turno.id;

  select coalesce(sum(v.total) filter (where v.metodo = 'transferencia'), 0),
         coalesce(sum(v.total) filter (where v.metodo = 'tarjeta'), 0)
  into v_qr, v_tarjeta
  from public.ventas v where v.turno_id = v_turno.id and v.anulada_en is null;

  perform privado.mover_caja_mayor(v_turno.sede_id, 'efectivo', v_a_mayor, 'cierre_turno', v_turno.id, null, v_usuario.id, null);
  perform privado.mover_caja_mayor(v_turno.sede_id, 'transferencia', v_qr, 'cierre_turno', v_turno.id, null, v_usuario.id, null);
  perform privado.mover_caja_mayor(v_turno.sede_id, 'tarjeta', v_tarjeta, 'cierre_turno', v_turno.id, null, v_usuario.id, null);

  return v_reporte;
end;
$$;
