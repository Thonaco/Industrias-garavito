-- ============================================================
-- POLÍTICAS DE SEGURIDAD (Row Level Security) — Industrias Garavito
-- ============================================================
-- ESTO ES LO MÁS IMPORTANTE DE TODA LA ACTUALIZACIÓN DE SEGURIDAD.
--
-- La contraseña del panel admin (antes escrita directamente en el
-- código) nunca fue la verdadera protección de tus datos. Con la
-- clave pública de Supabase, CUALQUIER PERSONA podía —sin pasar por
-- tu página— llamar directamente a la API de Supabase y editar o
-- borrar tus productos y pedidos, a menos que tu base de datos
-- tuviera activado "Row Level Security" (RLS) con políticas que
-- exigieran una sesión autenticada para escribir.
--
-- Este script:
--   1) Activa RLS en las 3 tablas.
--   2) Permite lectura pública de productos y configuración
--      (para que la tienda se vea sin iniciar sesión).
--   3) Permite que cualquier visitante CREE un pedido (checkout),
--      pero SOLO un administrador autenticado puede leer o borrar
--      pedidos, y SOLO un administrador autenticado puede crear,
--      editar o borrar productos y configuración.
--
-- CÓMO EJECUTARLO:
--   1. Entra a supabase.com → tu proyecto → SQL Editor.
--   2. Pega todo este archivo y presiona "Run".
--   3. Repite cada vez que agregues una tabla nueva.
-- ============================================================

-- ---------- PRODUCTS ----------
alter table public.products enable row level security;

drop policy if exists "public read products" on public.products;
create policy "public read products"
  on public.products for select
  using (true);

drop policy if exists "admin write products" on public.products;
create policy "admin write products"
  on public.products for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ---------- CONFIG (ajustes del sitio y categorías) ----------
alter table public.config enable row level security;

drop policy if exists "public read config" on public.config;
create policy "public read config"
  on public.config for select
  using (true);

drop policy if exists "admin write config" on public.config;
create policy "admin write config"
  on public.config for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ---------- ORDERS (pedidos) ----------
alter table public.orders enable row level security;

-- Cualquier visitante puede REGISTRAR un pedido al hacer checkout,
-- pero no puede leer los pedidos de otros clientes.
drop policy if exists "public create orders" on public.orders;
create policy "public create orders"
  on public.orders for insert
  with check (true);

drop policy if exists "admin read orders" on public.orders;
create policy "admin read orders"
  on public.orders for select
  using (auth.role() = 'authenticated');

drop policy if exists "admin delete orders" on public.orders;
create policy "admin delete orders"
  on public.orders for delete
  using (auth.role() = 'authenticated');

-- ============================================================
-- Después de ejecutar esto, ve a Authentication → Users → Add user
-- y crea tu correo y contraseña de administrador. Con eso, el login
-- de admin.html (Supabase Auth) queda totalmente funcional.
-- ============================================================
