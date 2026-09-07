# Finanzas — GitHub Pages + Supabase

Web móvil-first para controlar ingresos y gastos con cuentas privadas.

## 1. Supabase

En tu proyecto de Supabase abre **SQL Editor**, pega `supabase.sql` y ejecuta todo.

En **Authentication > URL Configuration** añade como Site URL la URL de tu GitHub Pages, por ejemplo:

`https://TUUSUARIO.github.io/TUREPOSITORIO/`

Si quieres que el registro funcione sin confirmar email, puedes desactivar temporalmente la confirmación de email en Authentication > Providers > Email.

## 2. Configuración

`config.js` ya contiene la URL y la publishable/anon key del proyecto indicado. Si vas a usar otro proyecto, sustitúyelas por las de:

Supabase > Project Settings > API.

## 3. GitHub Pages

Crea un repositorio público (por ejemplo `finanzas`), sube:

- index.html
- styles.css
- app.js
- config.js
- supabase.sql
- README.md

Después:

**Settings > Pages > Deploy from a branch > main > /(root) > Save**

GitHub te dará una URL tipo:

`https://TUUSUARIO.github.io/finanzas/`

Añade esa URL también en Supabase > Authentication > URL Configuration.

## Seguridad

La web usa Supabase Auth y Row Level Security (RLS). Cada consulta se ejecuta con la sesión del usuario y las políticas solo permiten acceder a filas cuyo `user_id` coincide con `auth.uid()`.

No pongas nunca una `service_role` key en GitHub Pages.

