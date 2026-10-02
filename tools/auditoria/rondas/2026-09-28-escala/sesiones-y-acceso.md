# Sesiones y acceso — ronda 2026-09-28-escala

Alcance acotado por el orquestador a tres preguntas. Lo demás del encargo original (`?next=`,
`/nueva-contrasena`, multi-dispositivo) se midió de paso y se resume al final: confirma código
ya corregido, no son hallazgos nuevos.

## 1. ¿La caché pública filtra algo de quien tiene sesión? — DESCARTADO (medido)

Revisé `lib/cache-publico.ts`, `lib/supabase/publico.ts` y las 13 funciones públicas de
`lib/queries.ts` (las 10 envueltas en `publico()` en líneas 147, 172, 385, 674, 968, 1024,
1070, 1134, 1186, 1572, más `getProjectBySlug` y `getPainterById`). **Las 13 usan
`createPublicClient()`**, el cliente anon sin cookies de `lib/supabase/publico.ts` — ninguna
lee el cliente con sesión. No hay forma de que un dato propio de alguien logueado entre a la
caché de 60 s y se lo sirvan a otra persona.

`getSession()` sólo aparece dos veces en todo `apps/web`:
- `lib/queries.ts:1156` (`conNombresDeAutores`): NO está envuelta en `publico()`, corre en
  cada render. Sólo decide si vale la pena una consulta extra para completar el nombre del
  autor de una reseña; la consulta real va con el JWT de la cookie y es Postgres quien valida
  la firma y aplica RLS. Un `getSession()` engañado no saca más datos de los que esa firma ya
  autoriza.
- `nueva-contrasena/page.tsx:59`, después de un `getUser()` que sí valida contra el servidor
  (línea 54): lee un claim de un token ya confirmado.

**`getSession()` no decide nada de seguridad en ningún punto del código.**

## 2. Costo en Supabase Auth de una visita con sesión — MEDIDO

El middleware (`middleware.ts:29`) llama `auth.getUser()` en cada request que matchea
`middleware.ts:35` (todo menos `_next/static`, `_next/image`, `favicon.ico` e imágenes — **no
excluye `/api/*`**). La barra (`auth-nav.tsx`) además pide `/api/sesion` por fetch en cada
página, y ese handler (`app/api/sesion/route.ts:24`) llama `getUser()` una SEGUNDA vez.

Medido con el kit (login real como `pintor`, capturando todas las requests del navegador):

| Visita | Requests que matchean el middleware | Llamadas a Supabase Auth |
|---|---|---|
| `/` (pública, cacheada), con sesión | `GET /` + `GET /api/sesion` | **3** (middleware×2 + handler×1) |
| `/dashboard` (privada), con sesión | `GET /dashboard` + `GET /api/sesion` | **3** (middleware×2 + handler×1) |
| Login completo (`/ingresar`→`/mi-panel`→`/dashboard`) | 7 requests | **7** |

**Toda página pública cacheada —cuyos datos son iguales para todos— paga igual 3 llamadas a la
API de Auth**, sólo para que la barra elija "Ingresar" vs "Mi panel". A la escala que motivó la
caché de datos (100.000 visitas/día), esto le mete a Supabase Auth el mismo volumen de tráfico
que la caché le vino a ahorrar a Postgres.

**Propuesta:** acotar el `matcher` a las rutas que necesitan sesión (`/dashboard`, `/cliente`,
`/panel`, `/admin`, `/mi-panel`, `/mi-cuenta`, `/publicar`, `/cotizaciones`,
`/nueva-contrasena`, `/bienvenida`, `/auth/*`) y sacar `/api/sesion` del matcher (su handler ya
llama `getUser()`; el del middleware ahí es pura redundancia). Costo: el middleware es quien
refresca el token (`lib/supabase/server.ts`: "la sesión la refresca el middleware"); alguien
que navegue sólo páginas públicas no renovaría el token hasta entrar a una ruta privada, donde
el primer `getUser()` del Route Handler lo refrescaría igual, un request más tarde. Trade-off
razonable al volumen actual; decisión del dueño.

## 3. Fuerza bruta contra /ingresar — DEDUCIDO + MEDIDO (sin ráfaga)

`ingresar/page.tsx:40` llama `supabase.auth.signInWithPassword` **directo desde el navegador**,
sin endpoint propio en el medio. No hay contador de intentos, bloqueo por cuenta/IP, CAPTCHA ni
demora creciente en ningún archivo de `(auth)`: el único freno posible es el de Supabase
(GoTrue), configurable sólo desde su panel.

Medí 6 intentos (tope propio: no pasar de 10 contra una cuenta demo) con contraseña incorrecta
contra `diego.sosa@pinturapro.demo`, directo a `POST {SUPABASE_URL}/auth/v1/token?grant_type=password`:
los 6 devolvieron `400 invalid_credentials` de inmediato, sin demora creciente ni cambio de
respuesta.

**Pintura Pro no tiene tope propio contra fuerza bruta en `/ingresar`.** Depende enteramente de
la configuración de Supabase Auth (panel del dueño, no visible desde el código), que con 6
intentos no se activó. **IMPORTANTE**: un ataque de diccionario contra cuentas reales
(pintores con reputación, clientes) no encuentra fricción propia del sitio.

## De paso (ya corregido, confirmado — no son hallazgos nuevos)

- **`?next=` en `/ingresar`**: probé los 6 payloads pedidos (`https://otro-sitio.com`,
  `//otro-sitio.com`, `/\otro-sitio.com`, `https:otro-sitio.com`, `%2F%2Fotro-sitio.com`,
  `javascript:alert(1)`) contra una cuenta demo real. Los seis terminaron dentro del sitio
  (`/mi-panel` o `/cliente`), nunca afuera — `lib/redirect-seguro.ts` los cubre a todos.
- **`/nueva-contrasena`**: sin sesión → "El enlace no es válido" (medido). Con sesión común →
  pide "Contraseña actual" antes de dejar cambiarla (medido).
- **Multi-dispositivo**: dos sesiones en paralelo conviven; cerrar una (`scope: "local"`) no
  afecta a la otra — a propósito, documentado en el código. Medido con dos navegadores.

## Qué no se pudo medir

`?next=` en `/auth/callback` con un `code` real (generarlo con `generateLink` pedía `dotenv`,
no instalado, y se priorizó cerrar rápido). Por lectura de código usa el mismo
`rutaInternaSegura` en éxito y en error, así que debería comportarse igual que en `/ingresar`
— deducido, no medido.

## Datos creados

Ninguno. Sólo lecturas, logins con cuentas demo existentes y llamadas directas al login de
Supabase con contraseñas incorrectas (ninguna contraseña real se cambió).
