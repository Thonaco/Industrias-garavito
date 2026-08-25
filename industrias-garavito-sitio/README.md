# Industrias Garavito — Sitio web

Sitio multi-página (tienda + panel administrador) construido con HTML, CSS y JavaScript, conectado a Supabase. Listo para publicarse en GitHub Pages.

## Estructura del proyecto

```
index.html          → Inicio
catalogo.html        → Catálogo completo con carrito y checkout
nosotros.html        → Sobre la empresa
contacto.html         → Formulario de contacto
admin.html            → Panel administrador (login con Supabase Auth)
404.html               → Página de error para GitHub Pages
css/style.css          → Todos los estilos del sitio
js/supabase-client.js  → Configuración de conexión a Supabase
js/site.js               → Lógica del sitio público (catálogo, carrito, checkout, contacto)
js/admin.js               → Lógica del panel administrador
assets/favicon.svg         → Ícono del sitio
supabase_rls.sql            → Políticas de seguridad para tu base de datos (léelas antes de usar el admin)
SEGURIDAD.md                 → Explicación de los cambios de seguridad y pasos obligatorios
robots.txt                    → Reglas para buscadores
```

## Publicar en GitHub Pages (sin reordenar nada)

1. Descomprime el .zip.
2. En tu repositorio de GitHub, sube **todo el contenido** de la carpeta descomprimida a la raíz del repo (arrastra y suelta todos los archivos y carpetas — `index.html`, `css/`, `js/`, etc. — tal cual están).
3. Ve a **Settings → Pages** en tu repositorio.
4. En "Branch", selecciona la rama donde subiste los archivos (normalmente `main`) y la carpeta `/ (root)`.
5. Guarda. GitHub te dará una URL como `https://tu-usuario.github.io/tu-repositorio/`.
6. Abre esa URL — la tienda ya debería cargar productos desde Supabase.

No necesitas mover ni reorganizar ningún archivo: la estructura ya está lista para GitHub Pages tal como viene en el .zip.

## Antes de usar el panel admin

Lee **SEGURIDAD.md** y ejecuta **supabase_rls.sql** en tu proyecto de Supabase. Son dos pasos de una sola vez, obligatorios para que el login funcione y tus datos estén protegidos.

## Cambiar el número de WhatsApp, nombre o eslogan

Todo eso se edita desde `admin.html`, pestaña "Config" — no es necesario tocar el código.

## Notas técnicas

- El carrito se guarda en el navegador de cada visitante (localStorage), no en Supabase.
- Los productos, categorías y ajustes del sitio se sincronizan en tiempo real entre todos los visitantes gracias a Supabase Realtime.
- El sitio no usa ningún framework ni paso de compilación — puedes editar cualquier archivo `.html`, `.css` o `.js` directamente y volver a subirlo a GitHub.
