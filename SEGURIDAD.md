# Seguridad — léelo antes de publicar

## Qué cambió y por qué

**Antes:** el panel admin se protegía con una contraseña escrita en texto plano dentro del código (`ADMIN_PASSWORD = 'garavito2025'`). Cualquiera podía verla con "Ver código fuente" del navegador (Ctrl+U), sin necesidad de hackear nada. Además, incluso sin esa contraseña, tu base de datos aceptaba escrituras de cualquier visitante si no tenía activado Row Level Security.

**Ahora:**
1. El login usa **Supabase Auth** (correo + contraseña verificados por el servidor de Supabase, no por el navegador).
2. Se añadieron **políticas de Row Level Security (RLS)** — el candado real de tus datos — en `supabase_rls.sql`.
3. Se añadió una política de seguridad de contenido (CSP), cabeceras de referrer, `rel="noopener noreferrer"` en enlaces externos, y se escapa el texto dinámico antes de insertarlo en la página (protección contra XSS).
4. El botón de administrador ya no aparece flotando sobre toda la tienda; ahora es un enlace discreto "Panel" en el pie de página, y `admin.html` lleva `noindex` para que buscadores no lo indexen (esto es solo una capa extra de discreción, **no** reemplaza el login ni las políticas RLS).

## Pasos obligatorios antes de usar el panel admin (una sola vez)

### 1. Activa las políticas de seguridad en Supabase
1. Entra a [supabase.com](https://supabase.com) → tu proyecto.
2. Ve a **SQL Editor** → **New query**.
3. Copia y pega todo el contenido de `supabase_rls.sql` (incluido en este paquete).
4. Presiona **Run**.

Sin este paso, cualquiera que conozca la URL de tu API de Supabase (que es pública por diseño) podría seguir escribiendo datos directamente, sin pasar por tu página ni por el login.

### 2. Crea tu usuario administrador
1. En Supabase, ve a **Authentication → Users → Add user**.
2. Escribe tu correo y una contraseña fuerte (usa "Auto Confirm User" si aparece la opción, para no depender de un correo de verificación).
3. Guarda. Ese correo y contraseña son los que usarás para entrar a `admin.html`.

### 3. Prueba el acceso
1. Abre `admin.html` en tu sitio publicado.
2. Inicia sesión con el correo y contraseña que creaste.
3. Verifica que puedas ver y editar productos.

## Buenas prácticas recomendadas (opcionales pero importantes)

- **Usa una contraseña única y larga** para tu usuario admin — no reutilices contraseñas de otros sitios.
- **No compartas el enlace de `admin.html`** públicamente aunque tenga `noindex`; sigue siendo accesible por cualquiera que adivine la URL, la verdadera protección es el login + RLS.
- **Revisa periódicamente** en Supabase → Authentication → Users que solo existan las cuentas que tú creaste.
- Si alguna vez sospechas que tu contraseña se filtró, cámbiala de inmediato desde Supabase → Authentication → Users.
- GitHub Pages es 100% estático: no permite configurar cabeceras HTTP de seguridad adicionales (como `X-Frame-Options` o HSTS personalizado) a nivel de servidor. Si en el futuro necesitas ese nivel de control, plataformas como Cloudflare Pages o Netlify sí lo permiten manteniendo el sitio gratuito.

## Resumen honesto

Ninguna protección puramente del lado del navegador (contraseña en JS, ocultar el botón, "noindex") es seguridad real por sí sola — un sitio estático siempre expone su código fuente. La seguridad real de este proyecto vive en dos lugares: **Supabase Auth** (quién puede iniciar sesión) y **las políticas RLS** (qué puede hacer esa sesión en la base de datos). Ambas están fuera del navegador y no pueden ser leídas ni evadidas viendo el código fuente de tu página.
