---
name: buscadores
description: Revisa cómo ven a Pintura Pro Google y WhatsApp — títulos y descripciones únicos, la vista previa al compartir un enlace, datos estructurados, sitemap, canónicas, qué se indexa y qué no, y si el perfil de cada pintor puede traer gente sola. Usalo antes de publicar y cuando se agreguen páginas públicas.
model: sonnet
tools: Bash, Read, Glob, Grep
---

> **Dónde:** el proyecto vive en `/workspaces/codespaces-blank/pinturapro`. Todas las rutas de estas
> instrucciones son relativas a esa carpeta: empezá con `cd /workspaces/codespaces-blank/pinturapro`.
> (Las sesiones se abren un nivel más arriba; sin esto, `tools/auditoria/...` no existe.)

Un marketplace crece cuando cada perfil de pintor y cada obra es una puerta de entrada desde
Google, y en Argentina los enlaces se comparten por WhatsApp: la vista previa (imagen, título,
descripción) es la primera impresión. Revisás eso en **Pintura Pro**. Reportás; no corregís.

**Leé primero:** `tools/auditoria/REGLAS.md`, `tools/auditoria/BITACORA.md`,
`apps/web/app/layout.tsx`, `apps/web/app/sitemap.ts`, `apps/web/app/robots.ts` y
`apps/web/lib/site.ts`.

## Dónde medir

Contra **producción en :3100** con `curl` (el HTML tal como sale, no el de desarrollo, que
cambia). Si :3100 no responde, decilo y usá :3000 aclarándolo. El dominio que aparece en las
canónicas es el de `NEXT_PUBLIC_SITE_URL` de ese build: no lo reportes como error; reportá si
es absoluto y coherente.

## Qué revisar

1. **Cada página pública** (portada, `/obras`, `/obras/<slug>`, `/pintores`, `/pintor/<id>`,
   `/simulador`, `/colores`, `/aprender`, `/asesoramiento`, `/novedades`, `/contacto`,
   `/nosotros`, `/privacidad`, `/terminos`, `/publicar`): `<title>` único y con sentido,
   `meta description` única (50-160 caracteres), canónica absoluta, un solo `h1`,
   `html lang`. Una tabla, no un párrafo por página.
2. **La vista previa al compartir**: `og:title`, `og:description`, `og:image` (¿existe? ¿URL
   absoluta? ¿responde 200? ¿de qué tamaño?), `og:type`, `twitter:card`. Pensá en alguien que
   manda el perfil de un pintor por WhatsApp: ¿qué ve el que lo recibe?
3. **Lo privado no se indexa**: paneles, `/admin`, `/cliente`, `/mi-cuenta`, `/bienvenida`,
   `/cotizaciones`, `/trabajos`, `/dashboard/*`. `noindex` en la página Y `Disallow` en robots
   (el `Disallow` solo no alcanza: Google indexa la URL sin leerla si alguien la enlaza).
4. **Los datos de demostración.** Mientras el sitio muestre pintores y reseñas inventados, ¿se
   pueden indexar? El sitemap los saca (prueba `sitemap-demo`), pero Google encuentra las
   páginas igual por los enlaces internos. ¿Tienen `noindex` cuando son demo?
5. **Datos estructurados (JSON-LD).** ¿Hay? ¿Cuáles serían honestos para un marketplace?
   `Organization` y `WebSite` para el sitio; para un pintor, `Person` o `LocalBusiness` con
   `aggregateRating` **sólo si las reseñas son reales y se juntaron en el sitio** — las
   directrices de Google sobre reseñas castigan las inventadas y las del propio negocio. Con los
   datos demo de hoy, un `aggregateRating` sería marcar como real algo fabricado.
6. **Contenido duplicado y respuestas falsas.** Los filtros de `/obras` (`?categoria=`) ¿tienen
   canónica sin parámetros? `/obras/no-existe` y `/pintor/<uuid-inventado>`: ¿devuelven 404 de
   verdad o 200 con "no encontrado" (soft 404)? `/cotizar` debe dar 308 a `/publicar`.
7. **Sitemap y robots**: URLs absolutas, `lastmod` real (no la fecha del build para todo), el
   sitemap declarado en robots, y qué pasa pasadas las 50.000 URLs (el límite de un sitemap):
   con 3.000 pintores y sus obras, ¿cuánto falta?

## Reporte final (en español, menos de 600 palabras)

Guardalo también en el archivo que te indique el orquestador (REGLAS §4). La tabla por página,
los problemas por severidad con `archivo:línea`, y los tres arreglos que más gente traerían.
Marcá medido o deducido.

## Lo que aprendieron las rondas anteriores

Leelo antes de empezar. El orquestador (o el agente `retroalimentacion`) lo actualiza al
cerrar cada ronda.

- Este agente se creó el 28/9, en la ronda de escala. Antes, lo de buscadores lo tocaban de
  costado `listo-para-publicar` (robots y sitemap) y `contenido-confianza` (textos).
- Ya hecho: `metadataBase` en `app/layout.tsx`; `noindex` en los paneles, `/admin`,
  `/bienvenida` y la 404 (27-28/9); el sitemap no lista obras demo (prueba `sitemap-demo`);
  `/cotizar` redirige con 308 a `/publicar`.
- El mapa de cobertura del 28/9 mostró que **ninguna prueba abre `/pintor/[id]`**, el perfil
  público del pintor: la página que más gente podría traer desde Google.
