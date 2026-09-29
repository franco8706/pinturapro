# Google Cloud cuando el sitio crece — ronda 2026-09-28-escala

Construye sobre `escala-y-volumen-web.md` de esta misma ronda (páginas públicas dinámicas,
topes sin paginación, latencias medidas) y sobre `docs/despliegue-google-cloud.md` (imagen ya
probada el 28/9). No repito esos hallazgos.

## 1. El build depende de internet — un único punto de falla real: Google Fonts

**Verificado.** `apps/web/app/layout.tsx:2` es el único lugar del código fuente que usa
`next/font/google` (`Inter`, `Space_Grotesk`, `JetBrains_Mono`). Revisé todo `apps/web`
(`app/`, `lib/`, `components/`, `middleware.ts`) buscando otra cosa que se descargue de
internet en tiempo de compilación: no hay `fetch` a nivel de módulo, no hay `postinstall` en
ningún `package.json` del monorepo, ni variables `SHARP_*` que fuercen a bajar libvips aparte
(`sharp` se resuelve como paquete npm normal vía `pnpm install`, igual que cualquier otra
dependencia — eso ya requiere red, pero es el mismo riesgo que tiene cualquier build de
Node, no uno adicional). El único mecanismo de Next que hace una llamada de red **durante el
build en sí** (no durante `pnpm install`) es `next/font/google`, que baja los `.woff2` de
`fonts.gstatic.com` en la etapa `builder` del Dockerfile — exactamente la que falló una vez
el 28/9.

**Arreglo, sin cambiar el look:** pasar las tres a `next/font/local`. Bajar una sola vez los
mismos archivos (Inter variable; Space Grotesk 400/500/700; JetBrains Mono 400/500 — son los
pesos que pide hoy `layout.tsx:8-25`) y commitearlos en `apps/web/public/fonts/` (no hay
ninguna fuente vendorizada hoy: `apps/web/public/` sólo tiene `LEEME.txt`). El `variable:
"--font-inter"` etc. se mantiene igual, así que Tailwind y `globals.css` no cambian una línea.
Esto también saca ~100 KB de la portada de la dependencia de un tercero en cada compilación,
no sólo en cada visita (ítem ya anotado como "abierto" en la BITÁCORA, con otro motivo).

## 2. Costo por escala — Cloud Run + Artifact Registry + Secret Manager + Logs

**Deducido**, con supuestos explícitos y precios de lista Tier 1 (incluye `us-east1`) que uso
de memoria, no verificados contra la consola (sin cuenta): CPU **US$ 0,000024/vCPU-s**,
memoria **US$ 0,0000025/GiB-s**, solicitudes **US$ 0,40/millón** tras 2 M gratis/mes; niveles
gratuitos mensuales 180.000 vCPU-s, 360.000 GiB-s. Cloud Run factura en incrementos de 100 ms
(piso 100 ms por pedido). `--memory=1Gi --cpu=1`, sin CPU-siempre-asignada (`min-instances=0`).

**Hoy (dinámico, cada página pega a Supabase):** promedio ponderado de las latencias p50 medidas
en `escala-y-volumen-web.md` a c=25 (home 35% del tráfico≈900ms, `/pintores` 20%≈500ms,
`/obras` 20%≈300ms, `/pintor/[id]` 15%≈600ms, resto 10%≈300ms redondeados a 100ms) ≈ **0,6 s
por visita**. Supuesto declarado: 1 visita = 1 render SSR facturable (ignora estáticos/JS,
que van aparte, ver abajo).

**Con `revalidate` (páginas públicas cacheadas, no golpean Supabase salvo al revalidar):** ≈
**0,1 s por visita** (piso de facturación; deducido, no medido — sería el costo de servir un
`Route Cache` hit).

| Visitas/día | Cloud Run, hoy (dinámico) | Cloud Run, con `revalidate` |
|---|---|---|
| 1.000 | **US$ 0** (16.500 vCPU-s, dentro del gratis) | **US$ 0** |
| 10.000 | **US$ 0** (180.000 vCPU-s, al borde del gratis) | **US$ 0** |
| 100.000 | **≈ US$ 43/mes** (1,8 M vCPU-s: 39 CPU + 3,6 memoria + 0,4 pedidos) | **≈ US$ 3/mes** (300.000 vCPU-s: 2,9 CPU + 0,4 pedidos) |

Artifact Registry (≈10-15 versiones de 355 MB ≈ 4-5 GB × US$0,10/GB tras 0,5 GB gratis) ≈
**US$ 0,40/mes**, igual en los tres escalones — no encontré política de limpieza de imágenes
viejas en `desplegar.sh` ni en la guía: crece sin techo (barato, pero sin techo). Secret
Manager: 3 secretos, 1 versión activa cada uno, muy por debajo de las 6 gratis; los accesos
sólo ocurren al arrancar una instancia (`--set-secrets` se monta al inicio, no por pedido) —
incluso con cientos de arranques por el `min-instances=0`, queda dentro de las 10.000
operaciones gratis: **≈ US$ 0**. Logs: el propio pedido/respuesta de Cloud Run más lo que
loguea la app son del orden de 1-5 KB por visita; a 100.000/día son ~9-15 GB/mes, dentro del
piso gratis de 50 GiB: **≈ US$ 0**, salvo que un error en bucle inunde los logs (ver punto 4).

**Conclusión del cálculo:** con la configuración de la guía, Cloud Run es barato incluso sin
tocar nada, hasta 10.000 visitas/día. El salto real aparece recién en 100.000/día
(~US$ 43/mes), y `revalidate` lo baja a ~US$ 3/mes — confirma, con números, lo que el papel
**web** de esta ronda ya señaló: el cuello de botella a esa escala no es el costo de Cloud
Run, es Supabase (cada visita dinámica sigue pegándole igual, cosa que esta cuenta no cubre
porque Supabase no es un servicio de Google). No cubrí el egreso de red (servir HTML/CSS/JS):
a 100.000 visitas/día × ~324 KB (peso medido de la portada) es del orden de 1 TB/mes, que si
se factura a red estándar añadiría un costo bastante mayor que el cómputo mismo — no estaba
en los cuatro servicios pedidos, pero es demasiado grande para omitirlo sin avisar.

## 3. Imágenes — medido con `sharp` local, no en Cloud Run

**Verificado** (sharp 0.35.4, ya instalado en el monorepo; imagen de prueba 1200×800/145 KB,
similar a lo que sube `resizeImage()` en `nueva-obra-form.tsx:187`, que ya limita a 1600 px
calidad 0,85 antes de subir — o sea, el optimizador de Next parte de un original ya chico):

| Transformación | Tiempo (5 corridas) |
|---|---|
| WebP, ancho 420 (tamaño de una `painter-card`) | 17-26 ms |
| WebP, ancho 828 | 47-52 ms |
| **AVIF**, ancho 420 | 198-306 ms |
| **AVIF**, ancho 828 | **857-940 ms** |

AVIF —el formato que Next sirve primero por defecto a cualquier Chrome/Firefox moderno— cuesta
**10 a 18 veces más CPU que WebP** para el mismo pixel. Con `--cpu=1`, una sola transformación
AVIF de 828px consume casi 1 segundo entero del único vCPU que la instancia también usa para
renderizar HTML: confirma con números el riesgo que ya señaló el papel **web** (§6): una
ráfaga de fotos nuevas puede frenar las páginas que comparten esa misma instancia. Medido en
el Codespace (CPU compartida), no en Cloud Run — la proporción relativa AVIF/WebP es de la
librería (libaom vs libwebp), no del entorno, así que debería sostenerse.

Encontré además `apps/web/.next/cache/images/` con archivos reales: confirma que ese caché
vive en el disco efímero del contenedor — no se comparte entre las hasta 4 instancias ni
sobrevive a un `min-instances=0` que escala a cero, así que la misma imagen se puede
re-transformar en cada instancia nueva.

**Recomendación, sin rediseñar nada:** `images.formats: ['image/webp']` en `next.config.js`
(hoy usa el default de Next, que intenta AVIF primero) — corta el caso más caro de la tabla
sin cambiar cómo se ven las fotos a simple vista. Un CDN delante de `/_next/image` (Cloud CDN)
sería el paso siguiente: Next ya pone `Cache-Control` largo en esas respuestas, así que un CDN
evita recalcular la misma imagen en cada instancia fría. No recomiendo `images.unoptimized`:
las fotos ya vienen resizeadas a 1600px/300-500 KB del lado del cliente, y las tarjetas se ven
a ~360-420px — servirlas sin recomprimir multiplicaría por 4-6× el peso de página que el papel
**web** midió en 64 KB para `/pintores`. Las transformaciones de Supabase Storage (otra
opción listada en el pedido) son, según lo que documenta el propio Supabase, un add-on de
plan pago: no lo puedo confirmar con precios de lista desde acá.

## 4. ¿Se enteraría el dueño?

**Verificado** (leí `revisar.mjs` entero y lo corrí contra `:3000` y `:3100`, ambos en
verde): el vigilante cubre disponibilidad general, 6 sondas de base vía `/api/health`
(tabla o función con permiso roto), páginas legales con su texto, `/api/mis-datos` sin sesión,
paneles privados sin sesión, `robots.txt`, cabeceras de seguridad, y que el sitemap no apunte
a páginas rotas — cada 30 minutos, más un `uptime check` de Cloud Monitoring cada minuto sobre
`/api/health`.

**Lo que falta, y no está en ningún documento como decisión tomada:**
- **Errores de Server Actions y 5xx en general.** El vigilante sondea rutas puntuales; no hay
  alerta sobre la métrica nativa y gratuita de Cloud Run "recuento de pedidos por clase de
  código" (5xx). Una Server Action que empieza a fallar en una ruta que el vigilante no
  visita (`/publicar`, `/cotizar`, dar una reseña) no dispara nada hasta que alguien se queja.
- **No hay `Sentry` ni nada similar.** Sólo `console.error` (30 apariciones en `apps/web`),
  que termina en Cloud Logging pero sin alerta configurada salvo lo que ya cubre el
  vigilante. Cuanto más tráfico, más ruido de errores sueltos que nadie mira hasta que se
  busca a mano.
- **Tope de mails de autenticación de Supabase.** El código sólo traduce el mensaje para la
  persona que lo pisó (`recuperar/page.tsx:59`, `crear-cuenta`, `ingresar`: `/rate limit/i`);
  no hay ninguna sonda que avise al dueño cuando el PROYECTO entero se queda sin cupo de
  envío (todos los altas y recuperaciones se rompen a la vez, silenciosamente).
- **Cuota de Storage de Supabase.** Nada la consulta: vive en el dashboard de Supabase, fuera
  del alcance de un `fetch` HTTP simple como el que usa `revisar.mjs`.
- **`/api/segment` y el presupuesto de Replicate.** La guía dice "poné un tope de gasto
  también ahí" (Replicate), pero es una tarea de consola que no puedo verificar si está hecha.

## 5. Vigencia de `docs/despliegue-google-cloud.md`

**Verificado, sigue siendo cierto** contra el código de hoy: `output: 'standalone'` y
`outputFileTracingRoot` apuntando a la raíz del monorepo están en `next.config.js`; los
`ARG`/`ENV` del Dockerfile coinciden exactamente con la tabla "Qué variable va dónde" de la
guía — comparé cada `process.env.*` que lee el código fuente de `apps/web` (excluyendo
`.next/` y `node_modules`, que ensucian el grep con variables internas de Next/Vercel que la
app nunca usa) contra esa tabla y no sobra ni falta ninguna.

**Un documento sí quedó desactualizado:** `docs/vigilancia-google-cloud.md`, sección final,
todavía dice "si un día migran el sitio a Cloud Run" y "cuando la web deje de estar en
Vercel", en condicional futuro — pero `docs/despliegue-google-cloud.md` dice explícitamente
que esa decisión ya se tomó y que la imagen ya se probó de punta a punta el 28/9. Es cosmético
(no cambia ningún comando), pero un lector que llegue primero a ese archivo entendería que la
migración sigue siendo hipotética.
