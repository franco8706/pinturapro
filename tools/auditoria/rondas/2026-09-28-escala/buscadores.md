# Buscadores y WhatsApp — ronda 2026-09-28-escala

Medido contra producción (commit 129be35) en `http://localhost:3100` con `curl`, más lectura de
código. IDs reales usados (sacados de los enlaces en `/pintores` y `/obras`, no inventados):
pintor `225f594d-00e1-420e-b392-af2a15bd1f9d` (Diego Sosa), obra `casa-barracas`.

## Tabla por página (todas: `html lang="es"`, 1 solo `h1`, canónica absoluta correcta)

| Página | Título único | Descripción (largo) | `og:site_name`/`locale`/`type`/`url` | `og:image` |
|---|---|---|---|---|
| `/` | Si | Si 168 (8 sobre el tope) | Si completos | No, ninguna |
| `/obras` | Si | Si 112 | No, ninguno de los 4 | No |
| `/obras/casa-barracas` | Si | Si 97 | Parcial: solo `type`+`url` | Si, 200, 184 KB |
| `/pintores` | Si | Si 110 | No, ninguno | No |
| `/pintor/<id>` (los 3 reales) | Si | Si 50-155 | Parcial: solo `type`+`url` | No, las 3 |
| `/simulador`,`/colores`,`/aprender`,`/asesoramiento`,`/novedades`,`/contacto`,`/nosotros`,`/privacidad`,`/terminos`,`/trabajos` | Si | Si 78-111 | No, ninguno | No |
| `/mapa` | Si (title propio) | Si 50 pero `og`/canónica de la portada | — | No |
| `/publicar` | 307 a `/ingresar` | noindex correcto, irrelevante (redirige) | — | — |

## BLOQUEANTE

Ninguno.

## IMPORTANTE

1. **Ninguna vista previa de WhatsApp tiene imagen, salvo las 3 obras.** Medido en las 3 fichas de
   pintor reales y en portada/listados. `apps/web/app/(pro)/pintor/[id]/page.tsx:28,39`: `foto`
   sólo se arma si `painter.image` empieza con `http`; los 3 pintores demo no la tienen, y no hay
   fallback. No existe ningún `og:image` de sitio (busqué `opengraph-image.*` y `public/*og*`: no
   hay). Quien recibe el perfil de un pintor por WhatsApp —la página que este sistema identificó
   como la que más gente podría traer— ve una tarjeta sin foto.

2. **Causa única detrás de la columna "No" de arriba.** El layout raíz
   (`apps/web/app/layout.tsx:49-56`) define `openGraph` completo (`site_name`, `locale`, `type`,
   `url`). Next.js **no mezcla** ese objeto con el de cada página: si la página define su propio
   `openGraph` (aunque sea sólo `{title, description}`, como en
   `apps/web/app/(marketing)/obras/(listado)/page.tsx:14` y 10 páginas más), reemplaza el del
   layout entero y pierde `site_name`/`locale`/`type`/`url`. Mismo mecanismo hace que **el Twitter
   Card de TODAS las subpáginas muestre título y descripción de la portada** (ninguna página
   define `twitter`, así que Next no lo reemplaza mal — pero tampoco es el de la página). Medido
   con `curl` en `/obras`: `twitter:title` = el de `/`.

3. **`/mapa` (página pública, en el sitemap) no define `alternates`/`openGraph`**
   (`apps/web/app/(pro)/mapa/page.tsx:6-9`, comparar con cualquier otra página de la lista de
   arriba que sí lo hace). Resultado medido: su `og:title`, `og:description` y **canónica**
   apuntan a la portada, no a `/mapa`. Google puede tratarlo como duplicado de `/` y no indexarlo
   por separado; quien comparte `/mapa` por WhatsApp ve la tarjeta de la portada.

4. **Perfiles demo indexables por enlace interno, tal como se temía la ronda anterior.** Medido:
   `/pintor/<id>` y `/obras/<slug>` responden `robots: index, follow` (no hay `noindex` atado a
   `DATOS_DEMO`, sólo el sitemap los excluye — confirmé que no hay ningún `if (DATOS_DEMO)` fuera
   de `app/sitemap.ts:35`). `/pintores` y `/obras` (indexadas, prioridad 0.9) enlazan a esos
   perfiles y obras fabricados, así que Google los encuentra igual.

5. **`/trabajos` es pública, indexada (sitemap + `index,follow`) y sin login muestra nombre
   completo, zona y presupuesto de clientes reales** (`apps/web/lib/queries.ts:785-797`,
   `full_name` real vía `profiles`). Contradice la propia guía de este agente (que lista
   `/trabajos` entre lo que no debería indexarse). Puede ser una decisión de producto (tablón
   público de pedidos, como en otros marketplaces) pero hoy expone datos personales a cualquier
   crawler sin que nadie lo haya decidido explícitamente — hace falta que el dueño lo confirme.

## MENOR

- Descripción de la portada: 168 caracteres, 8 sobre el tope de 160 (`apps/web/lib/site.ts:18-19`).
  Riesgo bajo de corte en el resultado de Google.
- `sitemap.xml` no trae `<lastmod>` en ninguna URL (no es que use la fecha del build: no está el
  campo, `apps/web/app/sitemap.ts:24-28`).
- Cero JSON-LD en todo el sitio (grep sin resultados). Con datos demo, un `Organization`+`WebSite`
  del sitio (no depende de pintores/reseñas) sería honesto de agregar ya; `Person`/`aggregateRating`
  por pintor, recién con reseñas reales, como ya advierte este mismo agente.
- Deducido, no medido (sitemap sólo trae rutas fijas mientras `DATOS_DEMO=true`): la rama dinámica
  de `sitemap.ts` no pagina; con miles de pintores/obras un solo array puede pasar las 50.000 URLs.

## Los 3 arreglos que más gente traerían

1. **Imagen de vista previa**: al menos un `og:image` de sitio por defecto, y que el perfil de
   pintor use la foto real o ese default — hoy ninguna ficha de pintor tiene imagen al compartirla.
2. **Un solo arreglo de raíz**: que cada página combine su `openGraph` con el del layout en vez de
   reemplazarlo (spread de un default compartido) — repara `site_name`/`locale`/`type`/`url` en
   las 12 páginas afectadas de una vez.
3. **`/mapa`**: agregar `alternates.canonical` y `openGraph` propios — hoy compite consigo mismo
   contra la portada en vez de indexarse.

## Funciona bien

Canónicas absolutas y coherentes con `NEXT_PUBLIC_SITE_URL`, `robots.txt`/sitemap sincronizados
con `PRIVATE_PATHS`/`PUBLIC_ROUTES`, `/obras/no-existe` y `/pintor/<uuid-inventado>` dan 404 real
con `noindex` (no soft-404), `/cotizar` a 308 a `/publicar`, y `/obras?categoria=` mantiene la
canónica sin parámetros.
