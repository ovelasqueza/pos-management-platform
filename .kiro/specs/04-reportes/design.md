# Design: 04 Reportes

## Datos

Todo se calcula en Postgres con funciones `security invoker` (la RLS de admin aplica) que reciben `(sede_id uuid | null, desde date, hasta date)`; `null` = todas las sedes.

| Función | Devuelve |
|---|---|
| `rep_resumen` | total, cantidad, por método, gastos, y filas por sede |
| `rep_ventas_por_dia` | fecha, total (para el gráfico; incluye días en 0 con `generate_series`) |
| `rep_productos` | producto_id, nombre, tipo, unidades, valor, y `por_sede jsonb` |

Ventas, gastos y turnos se listan con consultas normales filtradas por rango usando una columna generada:

```sql
alter table ventas add column fecha date
  generated always as ((creado_en at time zone 'America/Bogota')::date) stored;
-- igual en gastos (creado_en) y turnos (abierto_en)
create index on ventas (sede_id, fecha);
create index on gastos (fecha);
create index on turnos (sede_id, fecha);
```

## Pantallas

- Componente `FiltroFechas` (atajos + 2 inputs date) compartido; actualiza `?desde=&hasta=` en la URL.
- `/admin` (con sede) → Resumen. `/admin/reportes/{ventas,gastos,turnos,productos}` como pestañas en una sola sección "Reportes".
- Gráfico: barras con `div` y Tailwind (sin librería). Altura proporcional al máximo del rango, monto al pasar o tocar.
- Listas paginadas de 50 en 50 (`range()` de Supabase).
- Detalle de venta y de turno en panel lateral.

## Pruebas

- pgTAP: la suma por método = total; consolidado = suma de sedes; corte de día a medianoche de Bogotá.
- Vitest: atajos de rango de fechas (en Bogotá).
