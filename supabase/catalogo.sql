-- =============================================================================
-- Los Pollos Hermanos — carga del catálogo real
-- Ejecutar completo en: Supabase Dashboard › SQL Editor › New query › Run
--
-- Se puede volver a correr cuando quieras: actualiza por nombre los productos
-- que ya existen y agrega los que falten. No toca fotos ni productos propios.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Venta por kilo
--    Agrega la columna `unit` a la tabla products:
--      'unidad' → el precio es por unidad (valor por defecto)
--      'kg'     → el precio es por kilo y el cliente elige cuántos kilos lleva
-- -----------------------------------------------------------------------------
alter table public.products
  add column if not exists unit text not null default 'unidad';

alter table public.products drop constraint if exists products_unit_check;
alter table public.products
  add constraint products_unit_check check (unit in ('unidad', 'kg'));


-- -----------------------------------------------------------------------------
-- 2. Borrar los productos de ejemplo que trajo el esquema inicial
--    (no son productos reales de la pollería)
-- -----------------------------------------------------------------------------
delete from public.products
where name in (
  'Pollo entero a las brasas',
  'Medio pollo a las brasas',
  'Combo familiar',
  'Papas fritas grandes',
  'Ensalada mixta'
);


-- -----------------------------------------------------------------------------
-- 3. Catálogo
--    Precios al 2026-10-09. Para cambiarlos después, usá el panel de admin.
-- -----------------------------------------------------------------------------
create temporary table catalogo_tmp (
  name       text,
  category   text,
  price      numeric(12,2),
  unit       text,
  sort_order integer
);

insert into catalogo_tmp (name, category, price, unit, sort_order) values
  ('Milanesas de pollo',           'Milanesas',       11000, 'kg',      1),
  ('Milanesas de carne de peceto', 'Milanesas',       17500, 'kg',      2),
  ('Hamburguesas de pollo',        'Hamburguesas',    10500, 'kg',      3),
  ('Hamburguesas de carne',        'Hamburguesas',    15000, 'kg',      4),
  ('Supremas',                     'Cortes de pollo', 13000, 'kg',      5),
  ('Patitas de pollo',             'Cortes de pollo',  6300, 'kg',      6),
  ('Muslitos de pollo',            'Cortes de pollo',  6300, 'kg',      7),
  ('Pata muslo entera',            'Cortes de pollo',  5300, 'kg',      8),
  ('Alas de pollo',                'Cortes de pollo',  4500, 'kg',      9),
  ('Arrollado de pollo',           'Arrollados',      18000, 'unidad', 10);

-- Actualiza precio, unidad y categoría de los que ya estén cargados
update public.products p
set price      = c.price,
    unit       = c.unit,
    category   = c.category,
    sort_order = c.sort_order
from catalogo_tmp c
where lower(p.name) = lower(c.name);

-- Agrega los que falten
insert into public.products (name, category, price, unit, sort_order, is_available)
select c.name, c.category, c.price, c.unit, c.sort_order, true
from catalogo_tmp c
where not exists (
  select 1 from public.products p where lower(p.name) = lower(c.name)
);

drop table catalogo_tmp;


-- -----------------------------------------------------------------------------
-- 4. Control: así quedó el menú
-- -----------------------------------------------------------------------------
select name,
       category,
       price,
       case unit when 'kg' then 'por kilo' else 'por unidad' end as se_vende,
       is_available,
       sort_order
from public.products
order by sort_order, created_at;
