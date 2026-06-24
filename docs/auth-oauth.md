# Login social (Google · Microsoft · Facebook) + paneles por rol

El código ya está listo. Para que el login social funcione hay **dos cosas que tenés que hacer
vos** en paneles externos (Supabase + cada proveedor), porque requieren credenciales tuyas.

---

## Paso 1 — Correr la migración 0003 (activa la pantalla de bienvenida)

En **Supabase → SQL Editor → New query**, pegá y corré
[`/migrations/0003_onboasupabaserding.sql`](../supabase/migrations/0003_onboarding.sql).

Agrega la columna `profiles.onboarded`. Mientras no la corras, la app **no se rompe**: trata a
todos como "ya eligieron rol" y se saltea la bienvenida. Una vez corrida, el que entra por primera
vez con Google/Microsoft/Facebook ve la pantalla **/bienvenida** para elegir si es cliente, pintor
o empresa.

## Paso 2 — Habilitar los proveedores en Supabase

En **Supabase → Authentication → URL Configuration**:
- **Site URL**: la URL de tu app (en Codespaces, `https://<tu-codespace>-3000.app.github.dev`;
  en producción, tu dominio de Vercel).
- **Redirect URLs**: agregá `…/auth/callback` (ej. `https://<tu-codespace>-3000.app.github.dev/auth/callback`).

En **Authentication → Providers**, activá cada uno y pegá su Client ID / Secret. La **Callback URL**
que tenés que cargar en cada proveedor es la que muestra Supabase ahí, con esta forma:

```
https://ojdtixmysrfywgvowqie.supabase.co/auth/v1/callback
```

### Google
1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → **Credentials**.
2. **Create credentials → OAuth client ID → Web application**.
3. En *Authorized redirect URIs* pegá la Callback URL de Supabase (la `…supabase.co/auth/v1/callback`).
4. Copiá **Client ID** y **Client Secret** → Supabase → Providers → **Google**.

### Microsoft (proveedor "Azure" en Supabase)
1. [Azure Portal](https://portal.azure.com/) → **Microsoft Entra ID → App registrations → New registration**.
2. *Redirect URI* (Web): la Callback URL de Supabase.
3. En **Certificates & secrets** generá un *client secret*.
4. Copiá **Application (client) ID** y el **secret** → Supabase → Providers → **Azure**.
   (Para permitir cuentas personales además de organizacionales, elegí "Accounts in any organizational
   directory and personal Microsoft accounts" al registrar la app.)

### Facebook
1. [Facebook for Developers](https://developers.facebook.com/) → **Create App → tipo "Consumer"**.
2. Sumá el producto **Facebook Login**. En *Valid OAuth Redirect URIs* pegá la Callback de Supabase.
3. En **App settings → Basic** copiá **App ID** y **App Secret** → Supabase → Providers → **Facebook**.
4. Para producción la app de Facebook tiene que pasar a modo **Live**.

> Tip: podés activar **solo Google** primero (es el más rápido) y sumar los otros después. Los botones
> de un proveedor no habilitado muestran un mensaje claro en vez de romper.

---

## Cómo funciona en la app (ya implementado)

- **Botones sociales**: `components/features/social-auth.tsx`, en `/ingresar` y `/crear-cuenta`.
  Llaman a `signInWithOAuth({ provider, redirectTo: '…/auth/callback?next=/mi-panel' })`.
- **Callback**: `app/auth/callback/route.ts` canjea el código por sesión y redirige a `next`.
- **Dispatcher** `/mi-panel` (`app/mi-panel/page.tsx`): manda a cada uno a su panel:
  - sin rol elegido → **/bienvenida** (elige cliente / pintor / empresa)
  - cliente → **/cliente** (panel de cliente)
  - pintor / empresa → **/dashboard** (panel profesional)
- **Paneles diferenciados**:
  - **/cliente** — "Panel de cliente": solicitudes, pintores contratados, CTAs para pedir presupuesto
    y buscar pintores.
  - **/dashboard** — "Panel de pintor" / "Panel de empresa": métricas, trabajos, portfolio (crear/editar/borrar obras).
- **Navbar**: con sesión muestra **"Mi panel"** (va a `/mi-panel`) y **"Salir"**.

El login con **email + contraseña** sigue funcionando igual; quien se registra con el formulario
elige su rol ahí y se saltea la bienvenida.
