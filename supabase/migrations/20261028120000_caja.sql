-- Spec 03: turnos, ventas, gastos y cierre con arqueo ciego
-- Requiere: 20261028100000_base.sql y 20261028110000_catalogo.sql
-- Todo movimiento de dinero pasa por funciones RPC (una transacción cada una).
-- Los usuarios no pueden escribir directamente en estas tablas.

create type public.metodo_pago as enum ('efectivo', 'transferencia', 'tarjeta');

-- ───────────────────────── Tablas ─────────────────────────

create table public.turnos (
  id uuid primary key default gen_random_uuid(),
  sede_id uuid not null references public.sedes,
  cajero_id uuid not null references public.perfiles,
  base int not null check (base between 0 and 999999999),
  abierto_en timestamptz not null default now(),
  cerrado_en timestamptz,
  cerrado_por uuid references public.perfiles,
  efectivo_contado int,
  efectivo_esperado int,
  diferencia int,
  reporte jsonb, -- instantánea del reporte de turno (para reimprimir igual)
  constraint turnos_cierre_coherente check (
    (cerrado_en is null and cerrado_por is null and efectivo_contado is null
      and efectivo_esperado is null and diferencia is null and reporte is null)
    or
    (cerrado_en is not null and cerrado_por is not null and efectivo_contado >= 0
      and efectivo_esperado is not null and diferencia = efectivo_contado - efectivo_esperado
      and reporte is not null)
  )
);
create unique index turnos_un_abierto_por_cajero on public.turnos (cajero_id) where cerrado_en is null;
create index turnos_sede_apertura on public.turnos (sede_id, abierto_en desc);
create index turnos_cajero_cierre on public.turnos (cajero_id, cerrado_en desc);

create table public.contadores_venta (
  sede_id uuid primary key references public.sedes on delete cascade,
  ultimo int not null default 0
);
insert into public.contadores_venta (sede_id) select id from public.sedes;

create table public.ventas (
  id uuid primary key default gen_random_uuid(),
  clave uuid not null unique, -- idempotencia: el mismo cobro no se registra dos veces
  numero int not null,
  sede_id uuid not null references public.sedes,
  turno_id uuid not null references public.turnos,
  cajero_id uuid not null references public.perfiles,
  creado_en timestamptz not null default now(),
  total int not null check (total > 0),
  metodo public.metodo_pago not null,
  recibido int,
  cambio int,
  constraint ventas_numero_por_sede unique (sede_id, numero),
  constraint ventas_efectivo check (
    (metodo = 'efectivo' and recibido >= total and cambio = recibido - total)
    or (metodo <> 'efectivo' and recibido is null and cambio is null)
  )
);
create index ventas_turno on public.ventas (turno_id);
create index ventas_sede_fecha on public.ventas (sede_id, creado_en);

create table public.lineas_venta (
  venta_id uuid not null references public.ventas on delete restrict,
  producto_id uuid not null references public.productos on delete restrict,
  nombre text not null,  -- copia del nombre al vender
  precio int not null check (precio > 0), -- copia del precio al vender
  cantidad int not null check (cantidad between 1 and 999),
  primary key (venta_id, producto_id)
);
create index lineas_venta_producto on public.lineas_venta (producto_id);

create table public.gastos (
  id uuid primary key default gen_random_uuid(),
  turno_id uuid not null references public.turnos,
  monto int not null check (monto between 1 and 999999999),
  descripcion text not null check (length(trim(descripcion)) between 1 and 120),
  creado_en timestamptz not null default now(),
  anulado_en timestamptz
);
create index gastos_turno on public.gastos (turno_id);

-- ─────────────────────── Triggers e invariantes ───────────────────────

-- Contador de ventas para cada sede nueva
create function privado.al_crear_sede_contador() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.contadores_venta (sede_id) values (new.id);
  return new;
end;
$$;
create trigger al_crear_sede_contador after insert on public.sedes
  for each row execute function privado.al_crear_sede_contador();

-- Ventas y líneas no se modifican ni se borran
create function privado.rechazar_cambio() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'REGISTRO_INMUTABLE';
end;
$$;
create trigger ventas_inmutables before update or delete on public.ventas
  for each row execute function privado.rechazar_cambio();
create trigger lineas_venta_inmutables before update or delete on public.lineas_venta
  for each row execute function privado.rechazar_cambio();

-- Un turno cerrado no se modifica ni se borra
create function privado.validar_turno() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' or old.cerrado_en is not null then
    raise exception 'TURNO_CERRADO';
  end if;
  return new;
end;
$$;
create trigger validar_turno before update or delete on public.turnos
  for each row execute function privado.validar_turno();

-- Amplía la regla de sedes (spec 01): no desactivar con turnos abiertos
create or replace function privado.validar_sede() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_cajeros text;
begin
  if new.tipo is distinct from old.tipo then
    raise exception 'TIPO_SEDE_INMUTABLE';
  end if;

  if old.activa and not new.activa then
    select string_agg(p.nombre_completo, ', ' order by p.nombre_completo) into v_cajeros
    from public.turnos t
    join public.perfiles p on p.id = t.cajero_id
    where t.sede_id = new.id and t.cerrado_en is null;

    if v_cajeros is not null then
      raise exception 'SEDE_CON_TURNO_ABIERTO: %', v_cajeros;
    end if;
  end if;

  return new;
end;
$$;

-- Amplía la regla de perfiles (spec 01): cajero con turno abierto
create or replace function privado.validar_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.nombre_usuario is distinct from old.nombre_usuario then
    raise exception 'NOMBRE_USUARIO_INMUTABLE';
  end if;

  -- Con turno abierto no se cambia la sede ni el rol, ni se desactiva
  if tg_op = 'UPDATE' and old.rol = 'cajero'
     and (new.sede_id is distinct from old.sede_id or new.rol <> old.rol or (old.activo and not new.activo))
     and exists (select 1 from public.turnos t where t.cajero_id = old.id and t.cerrado_en is null) then
    raise exception 'CAJERO_CON_TURNO_ABIERTO';
  end if;

  -- Un cajero solo puede asignarse a una sede activa
  if new.rol = 'cajero'
     and (tg_op = 'INSERT' or new.sede_id is distinct from old.sede_id or old.rol <> 'cajero')
     and not exists (select 1 from public.sedes s where s.id = new.sede_id and s.activa) then
    raise exception 'SEDE_NO_DISPONIBLE';
  end if;

  -- No dejar el sistema sin administradores activos
  if tg_op = 'UPDATE' and old.rol = 'admin' and old.activo
     and (new.rol <> 'admin' or not new.activo) then
    perform pg_advisory_xact_lock(hashtext('ultimo_admin'));
    if not exists (
      select 1 from public.perfiles p
      where p.rol = 'admin' and p.activo and p.id <> old.id
    ) then
      raise exception 'ULTIMO_ADMIN';
    end if;
  end if;

  return new;
end;
$$;

-- ─────────────────────── Funciones internas ───────────────────────

-- Cajero activo de una sede activa (o error)
create function privado.exigir_cajero() returns public.perfiles
language plpgsql stable security definer set search_path = '' as $$
declare
  v public.perfiles;
begin
  select * into v from public.perfiles where id = auth.uid();
  if v.id is null or not v.activo or v.rol <> 'cajero' then
    raise exception 'SOLO_CAJERO';
  end if;
  if not exists (select 1 from public.sedes s where s.id = v.sede_id and s.activa) then
    raise exception 'SEDE_INACTIVA';
  end if;
  return v;
end;
$$;

-- Base + ventas en efectivo − gastos vigentes
create function privado.efectivo_esperado(p_turno uuid) returns int
language sql stable security definer set search_path = '' as $$
  select (
    t.base
    + coalesce((select sum(v.total) from public.ventas v
                where v.turno_id = t.id and v.metodo = 'efectivo'), 0)
    - coalesce((select sum(g.monto) from public.gastos g
                where g.turno_id = t.id and g.anulado_en is null), 0)
  )::int
  from public.turnos t
  where t.id = p_turno;
$$;

-- Datos del ticket de una venta
create function privado.ticket(p_venta uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'venta_id', v.id,
    'numero', v.numero,
    'fecha', v.creado_en,
    'sede', jsonb_build_object('nombre', s.nombre, 'direccion', s.direccion, 'telefono', s.telefono),
    'cajero', p.nombre_completo,
    'metodo', v.metodo,
    'total', v.total,
    'recibido', v.recibido,
    'cambio', v.cambio,
    'lineas', (
      select jsonb_agg(jsonb_build_object(
        'nombre', l.nombre, 'cantidad', l.cantidad, 'precio', l.precio,
        'subtotal', l.cantidad * l.precio) order by l.nombre)
      from public.lineas_venta l where l.venta_id = v.id
    )
  )
  from public.ventas v
  join public.sedes s on s.id = v.sede_id
  join public.perfiles p on p.id = v.cajero_id
  where v.id = p_venta;
$$;

-- Instantánea del reporte de turno al cerrar
create function privado.armar_reporte(
  p_turno uuid, p_contado int, p_esperado int, p_cerrador public.perfiles
) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'turno_id', t.id,
    'sede', jsonb_build_object('nombre', s.nombre, 'direccion', s.direccion, 'telefono', s.telefono),
    'cajero', c.nombre_completo,
    'abierto_en', t.abierto_en,
    'cerrado_en', now(),
    'cerrado_por_admin', case when (p_cerrador).rol = 'admin' then (p_cerrador).nombre_completo end,
    'base', t.base,
    'ventas_cantidad', (select count(*) from public.ventas v where v.turno_id = t.id),
    'ventas_total', (select coalesce(sum(v.total), 0) from public.ventas v where v.turno_id = t.id),
    'por_metodo', (
      select jsonb_build_object(
        'efectivo', coalesce(sum(v.total) filter (where v.metodo = 'efectivo'), 0),
        'transferencia', coalesce(sum(v.total) filter (where v.metodo = 'transferencia'), 0),
        'tarjeta', coalesce(sum(v.total) filter (where v.metodo = 'tarjeta'), 0))
      from public.ventas v where v.turno_id = t.id
    ),
    'gastos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'descripcion', g.descripcion, 'monto', g.monto, 'hora', g.creado_en) order by g.creado_en)
      from public.gastos g where g.turno_id = t.id and g.anulado_en is null
    ), '[]'::jsonb),
    'gastos_total', (
      select coalesce(sum(g.monto), 0) from public.gastos g
      where g.turno_id = t.id and g.anulado_en is null
    ),
    'esperado', p_esperado,
    'contado', p_contado,
    'diferencia', p_contado - p_esperado,
    'productos', coalesce((
      select jsonb_agg(jsonb_build_object('nombre', x.nombre, 'unidades', x.unidades, 'valor', x.valor)
                       order by x.unidades desc, x.nombre)
      from (
        select min(l.nombre) as nombre, sum(l.cantidad) as unidades, sum(l.cantidad * l.precio) as valor
        from public.lineas_venta l
        join public.ventas v on v.id = l.venta_id
        where v.turno_id = t.id
        group by l.producto_id
      ) x
    ), '[]'::jsonb)
  )
  from public.turnos t
  join public.sedes s on s.id = t.sede_id
  join public.perfiles c on c.id = t.cajero_id
  where t.id = p_turno;
$$;

revoke all on function
  privado.exigir_cajero(), privado.efectivo_esperado(uuid), privado.ticket(uuid),
  privado.armar_reporte(uuid, int, int, public.perfiles)
from public, anon, authenticated;

-- ───────────────────────── RPC públicas ─────────────────────────

create function public.abrir_turno(p_base int) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_cajero public.perfiles := privado.exigir_cajero();
  v_id uuid;
begin
  if p_base is null or p_base < 0 or p_base > 999999999 then
    raise exception 'BASE_INVALIDA';
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

-- p_lineas: [{ "producto_id": uuid, "cantidad": int, "precio": int }]
-- "precio" es el que vio el cajero; si no coincide con el vigente → PRECIOS_ACTUALIZADOS
create function public.registrar_venta(
  p_clave uuid, p_metodo public.metodo_pago, p_lineas jsonb, p_recibido int default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_cajero public.perfiles := privado.exigir_cajero();
  v_existente public.ventas;
  v_turno uuid;
  v_total bigint;
  v_numero int;
  v_venta uuid;
begin
  -- Reintento del mismo cobro: devolver la venta ya registrada
  select * into v_existente from public.ventas where clave = p_clave;
  if v_existente.id is not null then
    if v_existente.cajero_id <> v_cajero.id then
      raise exception 'CLAVE_INVALIDA';
    end if;
    return privado.ticket(v_existente.id);
  end if;

  -- Bloquea el turno: serializa ventas, gastos y cierre del mismo turno
  select id into v_turno from public.turnos
  where cajero_id = v_cajero.id and cerrado_en is null
  for update;
  if v_turno is null then
    raise exception 'TURNO_CERRADO';
  end if;

  if p_clave is null or p_metodo is null or jsonb_typeof(p_lineas) is distinct from 'array' then
    raise exception 'LINEAS_INVALIDAS';
  end if;
  if jsonb_array_length(p_lineas) not between 1 and 200 then
    raise exception 'LINEAS_INVALIDAS';
  end if;

  if exists (
       select 1 from jsonb_to_recordset(p_lineas) x(producto_id uuid, cantidad int, precio int)
       where x.producto_id is null or x.cantidad is null or x.cantidad not between 1 and 999
     )
     or (select count(*) from jsonb_to_recordset(p_lineas) x(producto_id uuid))
        <> (select count(distinct x.producto_id) from jsonb_to_recordset(p_lineas) x(producto_id uuid)) then
    raise exception 'LINEAS_INVALIDAS';
  end if;

  -- Cada producto debe seguir a la venta y con el mismo precio que vio el cajero
  if exists (
    select 1
    from jsonb_to_recordset(p_lineas) x(producto_id uuid, cantidad int, precio int)
    left join public.productos_sede ps
      on ps.producto_id = x.producto_id and ps.sede_id = v_cajero.sede_id and ps.habilitado
    left join public.productos p on p.id = ps.producto_id and p.activo
    where p.id is null or ps.precio_venta is distinct from x.precio
  ) then
    raise exception 'PRECIOS_ACTUALIZADOS';
  end if;

  -- Total con los precios de la BD
  select sum(x.cantidad::bigint * ps.precio_venta) into v_total
  from jsonb_to_recordset(p_lineas) x(producto_id uuid, cantidad int)
  join public.productos_sede ps on ps.producto_id = x.producto_id and ps.sede_id = v_cajero.sede_id;

  if v_total > 2147483647 then
    raise exception 'TOTAL_EXCEDIDO';
  end if;

  if p_metodo = 'efectivo' then
    if p_recibido is null or p_recibido < v_total then
      raise exception 'RECIBIDO_INSUFICIENTE';
    end if;
  else
    p_recibido := null;
  end if;

  update public.contadores_venta set ultimo = ultimo + 1
  where sede_id = v_cajero.sede_id
  returning ultimo into v_numero;

  insert into public.ventas (clave, numero, sede_id, turno_id, cajero_id, total, metodo, recibido, cambio)
  values (
    p_clave, v_numero, v_cajero.sede_id, v_turno, v_cajero.id, v_total::int, p_metodo,
    p_recibido, case when p_recibido is null then null else p_recibido - v_total::int end
  )
  returning id into v_venta;

  insert into public.lineas_venta (venta_id, producto_id, nombre, precio, cantidad)
  select v_venta, x.producto_id, p.nombre, ps.precio_venta, x.cantidad
  from jsonb_to_recordset(p_lineas) x(producto_id uuid, cantidad int)
  join public.productos_sede ps on ps.producto_id = x.producto_id and ps.sede_id = v_cajero.sede_id
  join public.productos p on p.id = x.producto_id;

  return privado.ticket(v_venta);
end;
$$;

-- Ticket para reimprimir (el cajero solo los suyos; el admin, cualquiera)
create function public.ticket_venta(p_venta uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (
    privado.es_admin()
    or exists (
      select 1 from public.ventas v
      where v.id = p_venta and v.cajero_id = auth.uid() and privado.usuario_activo()
    )
  ) then
    raise exception 'SIN_PERMISO';
  end if;
  return privado.ticket(p_venta);
end;
$$;

create function public.registrar_gasto(p_monto int, p_descripcion text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_cajero public.perfiles := privado.exigir_cajero();
  v_turno uuid;
  v_id uuid;
begin
  select id into v_turno from public.turnos
  where cajero_id = v_cajero.id and cerrado_en is null
  for update;
  if v_turno is null then
    raise exception 'TURNO_CERRADO';
  end if;

  if p_monto is null or p_monto < 1 or p_monto > 999999999 then
    raise exception 'MONTO_INVALIDO';
  end if;
  if length(trim(coalesce(p_descripcion, ''))) not between 1 and 120 then
    raise exception 'DESCRIPCION_INVALIDA';
  end if;
  -- No se informa el valor del esperado (arqueo ciego)
  if p_monto > privado.efectivo_esperado(v_turno) then
    raise exception 'EFECTIVO_INSUFICIENTE';
  end if;

  insert into public.gastos (turno_id, monto, descripcion)
  values (v_turno, p_monto, trim(p_descripcion))
  returning id into v_id;
  return v_id;
end;
$$;

create function public.anular_gasto(p_gasto uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_cajero public.perfiles := privado.exigir_cajero();
begin
  update public.gastos g set anulado_en = now()
  from public.turnos t
  where g.id = p_gasto
    and t.id = g.turno_id
    and t.cajero_id = v_cajero.id
    and t.cerrado_en is null
    and g.anulado_en is null;

  if not found then
    raise exception 'GASTO_NO_ANULABLE';
  end if;
end;
$$;

-- Cierre con arqueo ciego. Lo hace el cajero (su turno) o un admin (cualquiera).
create function public.cerrar_turno(p_turno uuid, p_contado int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_usuario public.perfiles;
  v_turno public.turnos;
  v_esperado int;
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

  v_esperado := privado.efectivo_esperado(v_turno.id);
  v_reporte := privado.armar_reporte(v_turno.id, p_contado, v_esperado, v_usuario);

  update public.turnos set
    cerrado_en = now(),
    cerrado_por = v_usuario.id,
    efectivo_contado = p_contado,
    efectivo_esperado = v_esperado,
    diferencia = p_contado - v_esperado,
    reporte = v_reporte
  where id = v_turno.id;

  return v_reporte;
end;
$$;

revoke all on function
  public.abrir_turno(int),
  public.registrar_venta(uuid, public.metodo_pago, jsonb, int),
  public.ticket_venta(uuid),
  public.registrar_gasto(int, text),
  public.anular_gasto(uuid),
  public.cerrar_turno(uuid, int)
from public, anon;

grant execute on function
  public.abrir_turno(int),
  public.registrar_venta(uuid, public.metodo_pago, jsonb, int),
  public.ticket_venta(uuid),
  public.registrar_gasto(int, text),
  public.anular_gasto(uuid),
  public.cerrar_turno(uuid, int)
to authenticated;

-- ───────────────────────── RLS ─────────────────────────

alter table public.turnos enable row level security;
alter table public.contadores_venta enable row level security;
alter table public.ventas enable row level security;
alter table public.lineas_venta enable row level security;
alter table public.gastos enable row level security;

revoke all on public.turnos, public.contadores_venta, public.ventas,
  public.lineas_venta, public.gastos from anon;
-- Escritura solo por las RPC
revoke insert, update, delete on public.turnos, public.contadores_venta, public.ventas,
  public.lineas_venta, public.gastos from authenticated;
revoke select on public.contadores_venta from authenticated;

create policy turnos_leer on public.turnos for select to authenticated
  using (privado.es_admin() or (cajero_id = auth.uid() and privado.usuario_activo()));

create policy ventas_leer on public.ventas for select to authenticated
  using (privado.es_admin() or (cajero_id = auth.uid() and privado.usuario_activo()));

create policy lineas_venta_leer on public.lineas_venta for select to authenticated
  using (
    privado.es_admin()
    or exists (
      select 1 from public.ventas v
      where v.id = venta_id and v.cajero_id = auth.uid() and privado.usuario_activo()
    )
  );

create policy gastos_leer on public.gastos for select to authenticated
  using (
    privado.es_admin()
    or exists (
      select 1 from public.turnos t
      where t.id = turno_id and t.cajero_id = auth.uid() and privado.usuario_activo()
    )
  );
