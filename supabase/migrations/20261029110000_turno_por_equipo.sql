-- Regla (pedido del usuario, 2026-10-29): el turno queda amarrado al equipo donde se abrió.
-- Mientras esté abierto, el cajero solo puede vender, registrar/anular gastos y cerrar
-- desde ese equipo. El admin puede cerrarlo desde cualquier lado.
--
-- El navegador envía su identificador de equipo en el encabezado HTTP "x-pos-dispositivo"
-- (cookie pos_dispositivo). PostgREST lo deja disponible en request.headers.
-- Los turnos abiertos antes de este script (sin equipo) no quedan restringidos.
-- Requiere: 20261028120000_caja.sql

alter table public.turnos add column dispositivo uuid;

-- Identificador del equipo que hace la petición (null si no viene o no es válido)
create function privado.dispositivo_actual() returns uuid
language plpgsql stable set search_path = '' as $$
declare
  v text := current_setting('request.headers', true)::json ->> 'x-pos-dispositivo';
begin
  return nullif(v, '')::uuid;
exception
  when others then
    return null;
end;
$$;
grant execute on function privado.dispositivo_actual() to authenticated;

-- Al abrir: guarda el equipo
create function privado.turno_asignar_dispositivo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.dispositivo := privado.dispositivo_actual();
  if new.dispositivo is null then
    raise exception 'EQUIPO_NO_IDENTIFICADO';
  end if;
  return new;
end;
$$;

create trigger turno_asignar_dispositivo
  before insert on public.turnos
  for each row execute function privado.turno_asignar_dispositivo();

-- Verifica que la operación venga del equipo del turno (el admin queda exento)
create function privado.exigir_equipo_del_turno(p_turno uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  v_equipo uuid;
begin
  if privado.es_admin() then
    return;
  end if;
  select t.dispositivo into v_equipo from public.turnos t where t.id = p_turno;
  if v_equipo is not null and v_equipo is distinct from privado.dispositivo_actual() then
    raise exception 'TURNO_EN_OTRO_EQUIPO';
  end if;
end;
$$;

create function privado.validar_equipo_operacion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo_del_turno(new.turno_id);
  return new;
end;
$$;

create function privado.validar_equipo_turno() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo_del_turno(old.id);
  return new;
end;
$$;

-- Ventas y gastos (registrar y anular)
create trigger ventas_equipo before insert on public.ventas
  for each row execute function privado.validar_equipo_operacion();
create trigger gastos_equipo before insert or update on public.gastos
  for each row execute function privado.validar_equipo_operacion();
-- Cierre del turno
create trigger turnos_equipo before update on public.turnos
  for each row execute function privado.validar_equipo_turno();

revoke all on function
  privado.turno_asignar_dispositivo(), privado.exigir_equipo_del_turno(uuid),
  privado.validar_equipo_operacion(), privado.validar_equipo_turno()
from public, anon, authenticated;
