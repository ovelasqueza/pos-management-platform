-- Spec 05: altas automáticas en el inventario en curso (pedido del usuario, 2026-10-31).
-- Si una sede tiene un inventario En curso, entran solos a ese inventario:
--   · materias primas nuevas o reactivadas de la sede;
--   · productos nuevos, habilitados de nuevo en la sede o reactivados en el catálogo.
-- Entran con cantidad vacía y el costo vigente. Los inventarios finalizados no cambian.
-- Solo agrega líneas (nunca quita). No toca ventas ni la caja.
-- Requiere: 20261031130000_inventario.sql

-- Agrega la línea al inventario en curso de la sede (si existe y la sede está activa)
create function privado.inv_alta_automatica(p_sede uuid, p_producto uuid, p_articulo uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_inv uuid;
  v_agregadas int;
begin
  select i.id into v_inv
  from public.inventarios i
  join public.sedes s on s.id = i.sede_id and s.activa
  where i.sede_id = p_sede and i.estado = 'en_curso';
  if v_inv is null then
    return;
  end if;

  if p_producto is not null then
    insert into public.lineas_inventario (inventario_id, producto_id, nombre, unidad, costo)
    select v_inv, p.id, p.nombre, 'unidad', c.costo
    from public.productos p
    left join public.costos_producto_sede c on c.sede_id = p_sede and c.producto_id = p.id
    where p.id = p_producto
    on conflict do nothing;
  else
    insert into public.lineas_inventario (inventario_id, articulo_id, nombre, unidad, costo)
    select v_inv, a.id, a.nombre, a.unidad, a.costo
    from public.articulos_inventario a
    where a.id = p_articulo
    on conflict do nothing;
  end if;

  get diagnostics v_agregadas = row_count;
  if v_agregadas > 0 then
    -- auth.uid() es null en scripts con la clave secreta (p. ej. importar productos)
    update public.inventarios
    set modificado_por = coalesce(auth.uid(), modificado_por), modificado_en = now()
    where id = v_inv;
  end if;
end;
$$;

-- Materia prima nueva o reactivada
create function privado.inv_alta_articulo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.activo and (tg_op = 'INSERT' or not old.activo) then
    perform privado.inv_alta_automatica(new.sede_id, null, new.id);
  end if;
  return null;
end;
$$;
create trigger inv_alta_articulo after insert or update of activo on public.articulos_inventario
  for each row execute function privado.inv_alta_articulo();

-- Producto nuevo en la sede (alta del catálogo) o habilitado de nuevo
create function privado.inv_alta_producto_sede() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.habilitado and (tg_op = 'INSERT' or not old.habilitado)
     and exists (select 1 from public.productos p where p.id = new.producto_id and p.activo) then
    perform privado.inv_alta_automatica(new.sede_id, new.producto_id, null);
  end if;
  return null;
end;
$$;
create trigger inv_alta_producto_sede after insert or update of habilitado on public.productos_sede
  for each row execute function privado.inv_alta_producto_sede();

-- Producto reactivado en el catálogo: entra en las sedes donde está habilitado
create function privado.inv_alta_producto() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_sede uuid;
begin
  if new.activo and not old.activo then
    for v_sede in
      select ps.sede_id from public.productos_sede ps where ps.producto_id = new.id and ps.habilitado
    loop
      perform privado.inv_alta_automatica(v_sede, new.id, null);
    end loop;
  end if;
  return null;
end;
$$;
create trigger inv_alta_producto after update of activo on public.productos
  for each row execute function privado.inv_alta_producto();

revoke all on function privado.inv_alta_automatica(uuid, uuid, uuid), privado.inv_alta_articulo(),
  privado.inv_alta_producto_sede(), privado.inv_alta_producto()
  from public, anon, authenticated;
