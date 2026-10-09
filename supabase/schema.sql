-- =============================================================================
-- Los Pollos Hermanos — esquema Supabase
-- Ejecutar completo en: Supabase Dashboard › SQL Editor › New query › Run
-- Es idempotente: se puede volver a correr sin romper nada.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Administradores
--    Solo los usuarios listados aquí pueden modificar productos y fotos.
--    (Así, aunque alguien se registre por su cuenta en Auth, no tiene permisos.)
-- -----------------------------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
-- Sin políticas: nadie puede leer/escribir esta tabla desde la API.
-- Se administra solo desde el SQL Editor.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

grant execute on function public.is_admin() to anon, authenticated;


-- -----------------------------------------------------------------------------
-- 2. Tabla de productos
-- -----------------------------------------------------------------------------
create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 1 and 120),
  description  text check (char_length(description) <= 500),
  category     text,                                   -- ej: 'Pollos', 'Combos', 'Guarniciones', 'Bebidas'
  price        numeric(12,2) not null check (price >= 0),   -- por unidad o por kilo, según `unit`
  unit         text not null default 'unidad'
                 check (unit in ('unidad', 'kg')),           -- 'kg' = el precio es por kilo
  sale_price   numeric(12,2) check (sale_price >= 0),  -- precio con descuento (opcional)
  badge        text check (char_length(badge) <= 40),  -- ej: 'Nuevo', 'Más pedido'
  image_url    text,                                   -- URL pública de la foto
  image_path   text,                                   -- ruta dentro del bucket (para borrarla)
  is_available boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint sale_below_price check (sale_price is null or sale_price < price)
);

-- Tablas creadas antes de que existiera la venta por kilo
alter table public.products
  add column if not exists unit text not null default 'unidad';

alter table public.products drop constraint if exists products_unit_check;
alter table public.products
  add constraint products_unit_check check (unit in ('unidad', 'kg'));

create index if not exists products_available_order_idx
  on public.products (is_available, sort_order, created_at);

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 3. Row Level Security de productos
-- -----------------------------------------------------------------------------
alter table public.products enable row level security;

drop policy if exists "Público ve productos disponibles" on public.products;
create policy "Público ve productos disponibles"
  on public.products for select
  to anon, authenticated
  using (is_available or public.is_admin());

drop policy if exists "Admin crea productos" on public.products;
create policy "Admin crea productos"
  on public.products for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admin edita productos" on public.products;
create policy "Admin edita productos"
  on public.products for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admin borra productos" on public.products;
create policy "Admin borra productos"
  on public.products for delete
  to authenticated
  using (public.is_admin());


-- -----------------------------------------------------------------------------
-- 4. Storage: bucket público para fotos de productos
--    Lectura pública (las fotos se ven en la tienda), escritura solo admin.
--    Límite 5 MB, solo JPG / PNG / WEBP.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Fotos de productos: lectura pública" on storage.objects;
create policy "Fotos de productos: lectura pública"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

drop policy if exists "Fotos de productos: admin sube" on storage.objects;
create policy "Fotos de productos: admin sube"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "Fotos de productos: admin reemplaza" on storage.objects;
create policy "Fotos de productos: admin reemplaza"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "Fotos de productos: admin borra" on storage.objects;
create policy "Fotos de productos: admin borra"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images' and public.is_admin());


-- -----------------------------------------------------------------------------
-- 5. Catálogo inicial
--    Se carga solo si la tabla está vacía. Para (re)cargarlo sobre una tabla
--    que ya tiene datos, usá supabase/catalogo.sql.
-- -----------------------------------------------------------------------------
insert into public.products (name, description, category, price, unit, sort_order)
select * from (values
  ('Milanesas de pollo',             null::text, 'Milanesas',        11000::numeric, 'kg',     1),
  ('Milanesas de carne de peceto',   null,       'Milanesas',        17500,          'kg',     2),
  ('Hamburguesas de pollo',          null,       'Hamburguesas',     10500,          'kg',     3),
  ('Hamburguesas de carne',          null,       'Hamburguesas',     15000,          'kg',     4),
  ('Supremas',                       null,       'Cortes de pollo',  13000,          'kg',     5),
  ('Patitas de pollo',               null,       'Cortes de pollo',   6300,          'kg',     6),
  ('Muslitos de pollo',              null,       'Cortes de pollo',   6300,          'kg',     7),
  ('Pata muslo entera',              null,       'Cortes de pollo',   5300,          'kg',     8),
  ('Alas de pollo',                  null,       'Cortes de pollo',   4500,          'kg',     9),
  ('Arrollado de pollo',             null,       'Arrollados',       18000,          'unidad', 10)
) as seed(name, description, category, price, unit, sort_order)
where not exists (select 1 from public.products);


-- =============================================================================
-- 6. DAR PERMISO DE ADMIN AL DUEÑO (correr DESPUÉS de crear el usuario)
--    a) Dashboard › Authentication › Users › Add user › Create new user
--       (email + contraseña, marcar "Auto Confirm User")
--    b) Reemplazar el email y ejecutar:
-- =============================================================================
-- insert into public.admins (user_id)
-- select id from auth.users where email = 'dueno@ejemplo.com'
-- on conflict do nothing;
