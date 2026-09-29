# contenido-confianza — ronda 2026-09-28-escala

## BLOQUEANTE — esto es falso

**"Pintores verificados" vuelve, en la app móvil.** Se había sacado de `/pintores` (web) por
no existir verificación. Reapareció sin que nadie la tocara ahí:
- `apps/mobile/app/(tabs)/index.tsx:47` — título "Pintores verificados".
- `apps/mobile/app/publicar.tsx:46` — "Los pintores verificados te van a enviar cotizaciones."
Reemplazo: la frase que ya usa `/pintores` web ("reseñas de clientes que los contrataron por
la plataforma").

**Una "novedad" en la base repite la misma promesa falsa.** `supabase/migrations/
0005_content.sql:90`, tabla `news`: *"Sumamos pintores verificados en Zona Norte… más
profesionales con reseñas reales cerca tuyo."* Confirmado en vivo leyendo la tabla por API
(sólo lectura): sigue publicada, fecha 20/6. Se ve en `/novedades` (web) y Aprender →
Novedades (mobile), sin el aviso de "es de ejemplo" que sí tienen pintores/obras/reseñas.

**Las FAQ de la base hablan como si Pintura Pro pintara con equipo propio.**
`supabase/migrations/0005_content.sql:67-73` (tabla `faqs`): "Definí si **pintamos**
ambientes…", "…nos permite **organizar el equipo**…", "**Trabajamos con** primeras marcas".
Contradice `/terminos` ("no ejecuta la obra"). Se muestra hoy en Aprender → "Antes de pedir"
(mobile); en web `getFaqs()` (`apps/web/lib/queries.ts:946`) está definida pero sin consumidor
todavía — va a arrastrar el mismo texto en cuanto se use. Reescribir en segunda persona, sin
"equipo"/"pintamos"/"trabajamos con".

## IMPORTANTE

**`/registro` promete una revisión y "activación de perfil" que no existen — esto es falso.**
`apps/web/app/(pro)/registro/page.tsx:137` ("te avisamos cuando activemos tu perfil") y `:176`
("Vamos a revisar tus datos… para activar tu perfil"). No hay estado pendiente/activo en
`profiles`, ni botón de aprobar en `/admin` (`admin-client.tsx` es de sólo lectura). La vía
real es otra y no se revisa: `/crear-cuenta` con rol "pintor" aparece en `/pintores` al toque
(`getPainters()`, `apps/web/lib/queries.ts:90-105`, filtra sólo por `type='painter'`). O se
conecta a una revisión real, o se saca la promesa.

**"Leer más" de cada novedad, en la app móvil, abre un dominio que no es el sitio — esto es
falso.** `apps/mobile/app/(tabs)/aprender.tsx:45`: si la URL no empieza con `http`, arma
`https://pinturapro.app${url}`. El dominio real es `pinturapro.ar` (`lib/empresa.ts`,
`/terminos`, `/privacidad`, `docs/`). Verificado contra la base: las 4 filas de `news` hoy
tienen `url` relativa (`/colores`, `/pintores`, `/aprender`) → el bug se dispara siempre. El
propio código ya resuelve esto bien dos pantallas más allá:
`apps/mobile/app/(tabs)/cuenta.tsx:263` usa `process.env.EXPO_PUBLIC_SITE_URL` y oculta el
botón si no está configurada. Usar la misma variable acá.

## MENOR — esto es confuso

**El panel admin cita una página que ya no existe.**
`apps/web/app/(marketplace)/admin/admin-client.tsx:51`: "…los pedidos de presupuesto de
**/cotizar**…"; `/cotizar` se retiró el 27/9 (redirige a `/publicar`).

**Listas con tope silencioso, sin "ver más", bajo títulos que insinúan totalidad** ("Tus
trabajos", "Tus pedidos publicados", "Cotizaciones recibidas"): `getPainters`/`getProjects`
cortan en 60 (`apps/web/lib/queries.ts:103,156`), `getJobsForClient`/`getJobsForPainter`/
`getQuotesForClient` cortan en 50 (líneas 504, 702, 864). Deducido del código, no medido: los
datos de demo están muy por debajo del tope. El día que alguien lo supere, la lista se corta
sin decirlo.

## Lo que funciona bien
La comisión del 10% es la misma cifra y fórmula en `/publicar`, el formulario de cotizar,
`/terminos`, `/nosotros` y la app móvil. `/privacidad` explica bien que las fotos del
simulador con IA viajan a Replicate y no se guardan, y avisa cuando faltan los datos legales
del responsable en vez de aparentar estar completa. Footer y `/contacto` ya no tienen
WhatsApp/domicilio inventados.

## No pude probar
La app móvil no corre desde el Codespace (ya en bitácora): los hallazgos de `apps/mobile` son
de código + datos reales de la base, no de pantalla navegada. `getFaqs()` en web no tiene
consumidor hoy: el hallazgo es sobre el dato en la base, no sobre una pantalla visible todavía
en `apps/web`.
