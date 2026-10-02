# Recorrido web — sub-agente navegación (2026-10-02)

Leídos previamente: REGLAS.md, BITACORA.md y las sondas viejas en
`/workspaces/codespaces-blank/.auditoria/kit/navegacion/` (back-button, reload-mitad,
deep-links, doble-pestaña, urls-inválidas). No se repiten pruebas ya cubiertas salvo para
confirmar que lo corregido sigue corregido.

Entorno: servidor compartido :3000, escritorio (1440px). Scripts en
`/tmp/auditoria/navegacion/` (no quedan en el repo).

## Hallazgos (MENOR, todo medido)

1. **El navbar no se entera de un login hecho en otra pestaña, y /ingresar no redirige a quien ya tiene sesión.**
   Pasos: pestaña B en `/pintores` sin sesión → se inicia sesión como `pintor3` en la pestaña A
   (mismo contexto/cookies) → sin recargar B, su navbar sigue diciendo "Ingresar" 1,5 s después
   (se arregla recargando: ahí sí aparece "Salir"). Clic en "Ingresar" de la pestaña B — que ya
   tiene la cookie de sesión válida, confirmado porque recargar la hace ver "Salir" — lleva a
   `/ingresar` y **muestra el formulario de login de nuevo** (`h1: "Ingresar"`) en vez de mandar
   a quien ya está logueado a su panel. No es un problema de seguridad (las rutas protegidas sí
   validan server-side, ver punto siguiente), es una inconsistencia de UX: alguien que tenía dos
   pestañas abiertas y entró en una puede terminar re-escribiendo su contraseña en la otra sin
   necesidad. Medido dos veces.

2. **Recargar la pantalla de confirmación de `/publicar` borra el aviso "Tu trabajo está publicado" sin avisar que el pedido ya se creó.**
   Pasos: con `cliente` (marina.acosta), completar los 3 pasos y publicar un pedido ZZAGENT →
   aparece "Tu trabajo está publicado" → recargar (F5) en esa misma pantalla. Resultado: vuelve
   al paso 1 del formulario, vacío, como si nada se hubiera publicado — nada en pantalla dice
   "ya se publicó, mirá tus cotizaciones". No llega a duplicar (confirmado: el borrador en
   localStorage se limpia al confirmar, y en `/cliente` cada título ZZAGENT apareció exactamente
   una vez), pero es confuso: quien recarga por accidente (o porque la confirmación tardó) no
   tiene ninguna pista de que el pedido ya quedó publicado y podría completar todo de nuevo
   pensando que no entró. Archivo: `apps/web/app/(marketplace)/publicar/publicar-form.tsx` — el
   estado `done` es sólo de React (`useState`), no sobrevive un reload.

## Verificado SIN problema (medido)

- **Caché pública de 60 s + Atrás/Adelante, en el perfil de `pintor3`:** cambié la zona a
  "ZZAGENT Zona Caballito", guardé, y en una pestaña nueva la primera visita a `/pintor/<id>`
  YA mostraba la zona nueva (la caché se limpia al guardar, como quedó corregido el 29/9). Atrás
  y Adelante en la pestaña que editó, y un `reload()` en la pestaña nueva, mostraron siempre la
  zona nueva — ni bfcache ni la caché de 60 s mostraron la versión vieja. Zona restaurada a
  "Morón, Zona Oeste" al final (confirmado).
- **`/publicar` + Atrás tras confirmar:** Atrás desde la pantalla de éxito no vuelve al
  formulario lleno (no hay `router.push`, así que Atrás sale directo de `/publicar` a la página
  previa); no hay forma de re-publicar con sólo Atrás+clic. Dos pedidos ZZAGENT creados en total
  (uno por esta prueba, otro por la del punto 2), cada uno aparece una sola vez en `/cliente`:
  sin duplicados.
- **Direcciones viejas/inventadas, todas con su 404 o redirect correcto:**
  `/cotizar` → 308 a `/publicar` (confirmado con `curl -D-`) → como no había sesión, de ahí a
  `/ingresar?next=/publicar` (correcto). `/obras/no-existe`, `/pintor/00000000-0000-4000-8000-000000000000`,
  `/pintor/abc` y `/dashboard/editar/no-existe` (con sesión de `pintor3`) → los cuatro dan 404 con
  "Esta página no existe." y enlaces de salida (Inicio, Obras, Pintores, Simulador, Pedir
  cotizaciones). `/trabajos?antes=2026-01-01` ignora el parámetro desconocido sin romper nada
  (200, contenido normal). `/og.png` sirve la imagen de 1200×630 sin problema.
  — Nota de medición: la primera corrida de `/obras/no-existe` dio `h1: []` con sólo 600 ms de
  espera; repetido con 2 s de espera apareció completo ("Esta página no existe."). Es la trampa
  de compilación en desarrollo que ya documenta la §5 de REGLAS, no un bug nuevo.
- **Logout en una pestaña mientras otra queda abierta en `/dashboard`:** cerré sesión en una
  pestaña C con el botón real "Salir"; en la pestaña A (sin recargar, todavía en `/dashboard`)
  un clic en un link público (`/pintor/<id>`) navegó bien, sin error; al navegar después a una
  ruta protegida (`/dashboard/nueva-obra`) redirigió correctamente a
  `/ingresar?next=/dashboard/nueva-obra`. El chequeo de sesión server-side funciona aunque el
  cliente de React de esa pestaña no se haya enterado del logout.

## Qué queda como deducido / no probado

- No se probó qué pasa si se envía el formulario de login en la pestaña "vieja" del hallazgo 1
  estando ya autenticada (sólo se verificó que muestra el formulario de nuevo, no que falle al
  reenviarlo). Queda sin medir.
- No se tocaron datos demo de otros agentes; todo lo creado es ZZAGENT.

## Lo que funciona bien (una línea c/u)

- Caché pública de 60 s: se invalida al instante al guardar, sin rastros de versión vieja ante Atrás/Adelante/reload en ninguna pestaña.
- `/cotizar` sigue redirigiendo (308) a `/publicar` como quedó documentado.
- Las 404 del sitio (obras, pintor, dashboard/editar) dan un mensaje claro y enlaces de salida, no una pantalla muerta.
- El gate de sesión server-side en rutas protegidas funciona aunque la pestaña no se haya enterado de un logout hecho en otra.
- `/publicar` no permite duplicar un pedido con sólo Atrás + clic.

## Datos ZZAGENT creados (a borrar)

- Pedido (project, tipo service) del cliente `marina.acosta@pinturapro.demo`: **"ZZAGENT pedido navegacion atras-reload"**, zona "ZZAGENT Zona Navegacion", 33 m², tipo interior. Sin cotizaciones (sin job asociado).
- Pedido (project, tipo service) del mismo cliente: **"ZZAGENT pedido navegacion atras-reload (para reload)"**, zona "ZZAGENT Zona Reload", 44 m², tipo interior. Sin cotizaciones (sin job asociado).
- Perfil de `pintor3` (diego.sosa@pinturapro.demo): zona editada temporalmente a "ZZAGENT Zona Caballito" y **restaurada a su valor original "Morón, Zona Oeste"** antes de terminar (confirmado con una lectura posterior).
- No se crearon jobs, cotizaciones ni reseñas.
