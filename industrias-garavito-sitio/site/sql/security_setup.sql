-- ============================================================
-- INDUSTRIAS GARAVITO — CONFIGURACIÓN DE SEGURIDAD (RLS)
-- ============================================================
-- Ejecuta este script UNA VEZ en Supabase: panel del proyecto →
-- "SQL Editor" → pega esto → "Run".
--
-- QUÉ HACE:
-- Antes de esto, la contraseña del panel admin solo escondía o
-- mostraba botones en la página — cualquiera podía abrir la
-- consola del navegador (F12) y ejecutar comandos para borrar o
-- modificar productos, pedidos o configuración directamente,
-- SIN necesidad de la contraseña. Esto lo cierra a nivel de base
-- de datos: a partir de aquí, solo un usuario que haya iniciado
-- sesión (autenticado con Supabase Auth) puede escribir, y
-- cualquier visitante normal solo puede leer.
-- ============================================================

-- 1) Activar Row Level Security en cada tabla
alter table public.products enable row level security;
alter table public.orders   enable row level security;
alter table public.config   enable row level security;

-- 2) LECTURA pública (el catálogo debe verse sin iniciar sesión)
drop policy if exists "public_read_products" on public.products;
create policy "public_read_products" on public.products
  for select using (true);

drop policy if exists "public_read_config" on public.config;
create policy "public_read_config" on public.config
  for select using (true);

-- Los pedidos NO deben poder leerse públicamente (contienen datos
-- personales de clientes: nombre, teléfono, dirección). Solo el
-- administrador autenticado puede verlos.
drop policy if exists "admin_read_orders" on public.orders;
create policy "admin_read_orders" on public.orders
  for select using (auth.role() = 'authenticated');

-- 3) ESCRITURA (insert/update/delete) — solo administradores logueados
drop policy if exists "admin_write_products" on public.products;
create policy "admin_write_products" on public.products
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "admin_write_config" on public.config;
create policy "admin_write_config" on public.config
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 4) PEDIDOS: cualquier cliente (sin sesión) debe poder CREAR un
--    pedido al hacer checkout, pero solo el admin puede leer,
--    editar o borrar pedidos.
drop policy if exists "public_insert_orders" on public.orders;
create policy "public_insert_orders" on public.orders
  for insert with check (true);

drop policy if exists "admin_manage_orders" on public.orders;
create policy "admin_manage_orders" on public.orders
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ============================================================
-- SIGUIENTE PASO OBLIGATORIO (fuera de este script):
-- Crea el usuario administrador en Supabase → Authentication →
-- Users → "Add user" → ingresa el correo y contraseña que usará
-- el dueño del negocio para entrar a admin.html.
--
-- Si quieres restringir el panel a UN correo específico en vez de
-- "cualquier cuenta autenticada", reemplaza
--   auth.role() = 'authenticated'
-- por
--   auth.jwt() ->> 'email' = 'tu-correo-admin@garavito.com'
-- en cada política de arriba.
-- ============================================================
