# Industrias Garavito — Guía de la nueva estructura y seguridad

## 1. Qué cambió en la estructura (de 1 página a varias)

Antes todo vivía en un solo `index.html` gigante (más de 1250 líneas, HTML + CSS + JS mezclados). Ahora:

```
index.html         → Inicio (hero, destacados, resumen, CTA)
tienda.html         → Catálogo completo, carrito y checkout
nosotros.html        → Página "Sobre nosotros" ampliada
contacto.html        → Formulario de contacto
admin.html           → Panel de administración (NO enlazado desde el menú público)
css/style.css        → Todos los estilos, compartidos por las 5 páginas
js/supabase-client.js → Conexión a la base de datos + funciones de seguridad
js/main.js            → Menú, cursor, WhatsApp flotante, formulario de contacto
js/store.js            → Catálogo, carrito, checkout (tienda.html + destacados de index.html)
js/admin.js             → Lógica del panel admin
sql/security_setup.sql   → Script que debes correr en Supabase (ver abajo)
```

Beneficios reales de esto, no solo estéticos:
- Cada página carga más rápido (no arrastra el código del panel admin ni del checkout si solo estás leyendo "Nosotros").
- Google puede indexar y posicionar cada sección por separado (SEO).
- Es mucho más fácil de mantener: para tocar el catálogo ya no hay que buscar entre 1200 líneas.
- El panel admin ya no aparece como un botón flotante visible para cualquier visitante.

**No se eliminó ninguna funcionalidad**: catálogo, filtros, carrito, checkout por WhatsApp, panel admin completo (productos, categorías, pedidos, configuración del sitio, subida de imágenes, reinicio de datos) siguen ahí, solo reorganizados.

## 2. La falla de seguridad más importante que encontré (y corregí)

El panel admin usaba esto:

```js
const ADMIN_PASSWORD = 'garavito2025';
```

Ese texto queda visible para **cualquiera** que haga clic derecho → "Ver código fuente" en tu página. Pero el problema real es más grave: esa contraseña solo controlaba si se *mostraba* el panel en pantalla. Las funciones que de verdad borran o modifican productos y pedidos (`supabase.from('products').delete()`, etc.) se podían ejecutar directamente desde la consola del navegador (F12), **sin necesidad de conocer la contraseña**, porque la base de datos aceptaba cualquier escritura que llegara con la clave pública del sitio.

### Qué hice
1. Reemplacé la contraseña fija por un **login real** con Supabase Auth (correo + contraseña), en `admin.html`.
2. Incluí `sql/security_setup.sql`: actívalo en tu proyecto de Supabase (Panel → SQL Editor → pegar → Run). Este script activa **Row Level Security (RLS)**, que es lo que de verdad impide que alguien sin sesión iniciada pueda escribir en la base de datos, sin importar qué intente desde la consola.
3. Después de correr el script, crea tu usuario administrador en Supabase: **Authentication → Users → Add user**, con el correo/contraseña que usarás para entrar a `admin.html`.

⚠️ **Importante**: sin ejecutar `security_setup.sql`, el sitio se ve y funciona igual, pero la base de datos seguiría aceptando escrituras de cualquiera, como antes. Ese paso es el que realmente cierra el hueco.

## 3. Otras mejoras de seguridad incluidas

- **Prevención de XSS**: todo texto que vino de un formulario o de la base de datos (nombre de producto, descripción, especificaciones, notas de pedido, etc.) ahora se "escapa" antes de insertarse en la página, para que nadie pueda inyectar código malicioso a través de esos campos.
- **Validación de imágenes**: se valida tipo de archivo (solo JPG/PNG/WEBP) además del límite de tamaño (2MB) que ya existía.
- **Cabecera de seguridad (CSP)**: se agregó una política de Content-Security-Policy en cada página, que limita desde dónde se puede cargar código y bloquea inyecciones externas.
- **Enlaces externos seguros**: todos los enlaces `target="_blank"` (WhatsApp, pedidos) ahora incluyen `rel="noopener noreferrer"` para evitar un ataque conocido de "tabnabbing".
- **Anti-spam (honeypot)**: se agregó un campo invisible en el formulario de contacto y en el checkout que los bots suelen rellenar automáticamente; si llega lleno, se ignora el envío silenciosamente.
- **Página admin fuera del menú y con `noindex`**: ya no hay un botón de engranaje visible para cualquier visitante, y se le dice a los buscadores que no la indexen.
- **Pedidos protegidos**: con el script SQL, los pedidos (que contienen nombre, teléfono y dirección de tus clientes) solo pueden leerse desde el panel admin autenticado, no por cualquiera con la clave pública.

## 4. Lo que NO cambié (a propósito)

- La clave de Supabase que ves en `js/supabase-client.js` (`sb_publishable_...`) es la **clave pública/anónima**, diseñada para viajar en el navegador de cualquier visitante — no es un secreto y no hace falta "esconderla". La protección real vive en las políticas de RLS del paso 2.
- Todo el diseño visual, textos, colores, animaciones y funcionalidades originales se mantuvieron intactos.

## 5. Pasos pendientes de tu parte

1. Ejecuta `sql/security_setup.sql` en el SQL Editor de Supabase.
2. Crea tu usuario admin en Supabase → Authentication → Users.
3. Entra a `admin.html` con ese correo y contraseña para confirmar que todo funciona.
4. (Opcional pero recomendado) En el script SQL hay una sección para restringir el acceso a un solo correo específico en vez de "cualquier cuenta autenticada" — útil si en el futuro creas más usuarios en Supabase para otra cosa.
