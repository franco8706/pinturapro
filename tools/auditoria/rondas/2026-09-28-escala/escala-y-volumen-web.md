# Escala y volumen — papel web (ronda 2026-09-28-escala)

## 1. Por qué cada página pública es ƒ, y nada de lo que muestran depende de quién mira

Causa única, repetida nueve veces: `apps/web/lib/supabase/server.ts:11` hace `await cookies()`,
y eso marca la respuesta como privada — aunque el contenido sea igual para todos. Toda función
de lectura pública en `apps/web/lib/queries.ts` llama a ese `createClient()`. **Medido:** las
nueve páginas devuelven `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`
(`curl -D -` contra :3100). Ninguna lee sesión/rol para decidir qué mostrar: el estado de sesión
lo resuelve `AuthNav` (`components/features/auth-nav.tsx`) del lado del cliente contra
`/api/sesion`, desacoplado del render del servidor.

| Página | Llama, en | Cambio mínimo |
|---|---|---|
| `/` | `page.tsx:73-87` → `getNews/getRecentReviews/getProjects/getNumerosReales` (`queries.ts:1024,1069,149,1494`) | cliente sin cookies + `revalidate` |
| `/obras` | `obras/(listado)/page.tsx:37` → `getProjects` (`queries.ts:149`) | ídem |
| `/obras/[slug]` | `obras/[slug]/page.tsx:17,45` → `getProjectBySlug` (`queries.ts:212`) | ídem |
| `/pintores` | `pintores/page.tsx:23` → `getPainters` (`queries.ts:93`) | ídem |
| `/pintor/[id]` | `pintor/[id]/page.tsx:18,46,69-71` → `getPainterById/getProjectsByOwner/getReviewsForPainter/getPainterExtras` (`queries.ts:263,353,623,1119`) | ídem |
| `/aprender` | `aprender/page.tsx:19` → `getResources` (`queries.ts:973`) | ídem |
| `/asesoramiento` | `asesoramiento/page.tsx:17` → `getResources("advice")` | ídem |
| `/novedades` | `novedades/page.tsx:20` → `getNews` | ídem |
| `/mapa` | `mapa/page.tsx:13` → `getPainters` | ídem |

"Cliente sin cookies": un `createClient` nuevo (`@supabase/supabase-js`, URL+anon key, sin
`cookies()`) para estas 10 funciones de sólo-lectura pública, más `export const revalidate = N`
en cada página. Las privadas (`/dashboard`, `/cliente`, `/trabajos`, `/cotizaciones`, `/panel`,
`/admin`, `/mi-cuenta`) siguen con el cliente actual. El patrón ya existe y funciona por
accidente: `apps/web/app/sitemap.ts` usa las mismas `getProjects`/`getPainters` y hoy sale ○ con
`revalidate=3600` sólo porque `if (DATOS_DEMO) return estaticas;` (línea 33) corta ANTES de
llamar a esas funciones. El día que `NEXT_PUBLIC_DATOS_DEMO=false` (necesario para ir a
producción con datos reales, según CLAUDE.md), el sitemap se vuelve dinámico también, sin aviso.

## 2. Topes sin paginación — qué queda afuera

- `getPainters` (`queries.ts:103`, `.limit(60)`): alimenta **directorio, mapa y sitemap**. El
  pintor #61 por rating no aparece en ninguno de los tres, ni siquiera con `DATOS_DEMO=false`:
  invisible para clientes y para Google, sin aviso, pagando la misma comisión.
- `getProjects` (`queries.ts:156`, `.limit(60)`): portfolio, home y sitemap. Obra #61, igual.
- `pedidos_abiertos` (`0014...sql:46`, `limit 50`, tope duro 100, `order by created_at desc`):
  tablero de `/trabajos` (`queries.ts:767`). El más grave: un pedido que nadie cotiza rápido se
  cae del tablero para SIEMPRE (no hay "ver más", no vuelve a subir) — el cliente cree que sigue
  a la vista y ningún pintor lo ve de nuevo.
- `getReviewsForPainter`(30), `getResources`(60), `getNews`(30): mismo patrón, hoy lejos del tope.

## 3. Medido: peso de /pintores hoy y proyectado

HTML de `/pintores` en :3100: **50.175 bytes** sin comprimir, **13.172 gzip**. El array de
pintores embebido en el RSC payload pesa 740 bytes para 3 pintores → **~247 bytes/pintor**. Con
el tope de 60 (el máximo que la página mostrará SIEMPRE, tenga la base 60 o 3.000 pintores):
≈64 KB / ~16 KB gzip, y no crece más. El riesgo no es el peso: es que desde el pintor 61 el peso
deja de crecer porque la gente deja de aparecer.

## 4. Carga contra :3100 (medido, sin errores, 85 pedidos/página)

Script: `/tmp/auditoria/escala-web/carga.mjs`. p50 en ms:

| Página | c=10 | c=25 | c=50 |
|---|---|---|---|
| `/` (4 queries paralelas) | 1505 | 828 | 1616 |
| `/pintores` | 132 | 407 | 612 |
| `/obras` | 124 | 280 | 566 |
| `/pintor/[id]` | 173 | 523 | 847 |

`/` es la más cara y no escala mejor con más concurrencia (p50 ≈1,6 s a c=50). Medido contra un
solo proceso local, no los 4 contenedores reales de Cloud Run.

## 5. Estado en memoria de instancia

Además de `/api/segment` (`route.ts:22,31`, 12/hora): `apps/web/app/(marketing)/actions.ts:27-28`
tiene el mismo patrón para contacto/leads (`{max:5, windowMs:1h}` en un `Map` de proceso). Con
`--max-instances=4` el tope real de ambos es 4× lo escrito, y se resetea en cada despliegue. No
encontré otro estado de proceso fuera de estos dos `Map`.

## 6. Cloud Run (`--concurrency=40 --max-instances=4`)

Tope teórico: 160 requests en vuelo. El 161 simultáneo espera un slot (cola) hasta el timeout del
servicio; si la ráfaga sigue, Cloud Run devuelve 429. El optimizador de imágenes de Next corre
DENTRO del mismo contenedor: cada foto a redimensionar ocupa uno de los 40 slots y compite por
el mismo 1 Gi que sirve HTML — una ráfaga de fotos nuevas puede tumbar la instancia junto con los
requests de página que compartían proceso. Y escalar a 4 instancias no escala la base: todas
comparten el mismo Supabase free tier — proyecto que a 1.000× el cuello de botella real no es
Cloud Run, es Supabase (ver reporte del sub-agente **base**).

## Tabla — a qué escala se rompe

| Qué | 10× (30 pintores, 500 ped/día) | 100× (300 pintores, 5.000/día) | 1.000× (3.000, 50.000/día) |
|---|---|---|---|
| Directorio/mapa/sitemap muestran a todos | sí | **no**: 240 pintores invisibles (proyectado) | **no**: 2.940 invisibles (proyectado) |
| Tablero `/trabajos` visible para pintores | sí | pedidos viejos empiezan a caerse del top-50 (proyectado) | mayoría de pedidos nunca vista (proyectado) |
| Cada visita pública pega a Supabase igual | medido hoy (Cache-Control private ×9) | 100× más consultas/día | 1.000× más — sin caché, cada visita cuesta igual |
| Latencia de `/` bajo concurrencia | 828-1616 ms medido a c≤50 | proyectado >2 s si Supabase se satura | proyectado: cola/429, cuello en Supabase |
| Peso de `/pintores` | ~64 KB (tope de 60, no crece) | igual | igual — el tope esconde el crecimiento |

## Los tres cambios que más ganan

1. **Cliente sin cookies + `revalidate` en las 9 páginas públicas.** Elimina casi toda consulta
   a Supabase en la mayoría de las visitas. Archivos: nuevo `lib/supabase/public.ts`; las 10
   funciones de `lib/queries.ts` listadas arriba; `export const revalidate = N` en cada `page.tsx`.
2. **Paginación/"ver más" en `getPainters`, `getProjects`, `pedidos_abiertos`.** Sin esto nada
   más importa: desde 60 pintores/obras y 50 pedidos sin cotizar, parte de la plataforma deja de
   existir sin aviso. Archivos: `lib/queries.ts` (cursor/offset), `pintores-client.tsx`, listado
   de obras, `trabajos/page.tsx`, función SQL `pedidos_abiertos`.
3. **Atar `--max-instances`/`--concurrency` a lo que banca Supabase, no al revés.** Medir
   conexiones simultáneas del plan (sub-agente **base**) antes de subir el número de Cloud Run.
   Archivo: `docs/despliegue-google-cloud.md`.
