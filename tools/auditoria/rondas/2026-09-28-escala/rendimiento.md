# Rendimiento — ronda `2026-09-28-escala` (medido 1/10/2026)

Medido contra **producción en :3100**, commit `1a06193` (mismo código de producto que `0eb55b9`,
sólo recompilado tras un reinicio del Codespace — ver `tools/auditoria/produccion.sh`, servido
`standalone` como en Cloud Run, no `next dev`). Celular emulado 390×844, `deviceScaleFactor=3`,
4G flojo (`latency:150ms, down:1.6Mbps, up:750Kbps`) y CPU ×4, con el kit
`tools/auditoria/navegador.cjs`. Cada página se midió con un **navegador nuevo** (caché HTTP
fría): medir todo en una sola pestaña hacía que las fuentes, ya cacheadas por la portada,
aparecieran en "0 KB" en el resto — un visitante real que entra directo a `/pintores` desde
Google paga esas fuentes igual. Scripts en `/tmp/auditoria/rendimiento/` (no sobreviven al
Codespace; quedan acá los números y el método).

## 1. Qué cambió esta ronda, con números

### Tipografías: `next/font/local` en vez de Google

`apps/web/app/layout.tsx:12-34` sirve Inter, Space Grotesk y JetBrains Mono desde
`app/fonts/*.woff2` (antes `next/font/google`). Verificado contra el manifiesto de la
compilación (`next-font-manifest.json`): **sólo 2 de las 3 se precargan** —

| Fuente | Archivo | Peso | `rel=preload` |
|---|---|---|---|
| Inter (var. 100-900) | `e4af272ccee01ff0-s.p.woff2` | 47,6 KB | sí |
| Space Grotesk (var. 300-700) | `36966cca54120369-s.p.woff2` | 22,1 KB | sí |
| JetBrains Mono (var. 100-800) | `bb3ef058b751a6ad-s.woff2` | 39,8 KB | **no** (`preload:false` en el código) |

Total **109,5 KB de fuente en TODAS las páginas medidas** (`/`, `/pintores`, `/obras`,
`/simulador`, `/publicar`), idéntico en cada una — el mismo número que ya señalaba la bitácora
como abierto ("~100 KB, el 30% de la portada") antes de este cambio. **El peso no bajó**: migrar
de Google a local evita el riesgo de build (la razón del cambio, ver `app/fonts/LEEME.md`) pero
no quita bytes — JetBrains Mono sigue bajándose completo (39,8 KB) en cada visita aunque no se
precargue, porque igual se usa en una etiqueta visible sin JS (`font-mono text-mono-sm`, p.ej. la
categoría de cada tarjeta) y el navegador la pide apenas descubre el `@font-face` en el CSS. Lo
que sí mejora con fuentes propias: sin DNS/TLS a `fonts.gstatic.com` (un origen menos en la
cadena de carga), aunque no quedó un número de antes para restar en limpio.

Primera pintura y LCP con fuente local (ver tabla §3): FCP 896-1060 ms, consistente entre
páginas — no hay señal de regresión por el cambio de origen de fuente.

### Caché de 60 s en las páginas públicas (`031a145`)

El `Cache-Control` de la respuesta **sigue** en `private, no-cache, no-store, max-age=0,
must-revalidate` en las cuatro rutas (medido con `curl -D -`) — no cambia, porque el layout sigue
leyendo cookies para la sesión. Lo que cambió es que la lectura de Supabase detrás de esas
páginas ahora sale de una caché en memoria de 60 s (`lib/cache-publico.ts`), y el tiempo de
respuesta lo muestra:

**TTFB de un pedido único (promedio de 3, caché tibia):**

| Página | TTFB |
|---|---|
| `/` | ~12 ms |
| `/pintores` | ~7 ms |
| `/obras` | ~7 ms |
| `/pintor/<id>` | ~6 ms |

**Carga con `tools/auditoria/escala/carga.mjs` (85 pedidos/celda, p50/p95 ms, mismo método que
`escala-y-volumen-web.md` del 28/9):**

| Página | c=10 (antes) | c=10 (ahora) | c=25 (ahora) | c=50 (ahora) |
|---|---|---|---|---|
| `/` | 1505 | **166 / 457** | 383 / 652 | 673 / 1149 |
| `/pintores` | 132 | **96 / 104** | 221 / 237 | 463 / 474 |
| `/obras` | 124 | **90 / 107** | 204 / 215 | 435 / 446 |
| `/pintor/<id>` | 173 | **85 / 101** | 206 / 266 | 404 / 414 |

`/` pasó de ser la ruta más cara por lejos (4 consultas en paralelo a Supabase en cada visita) a
rendir igual que el resto: a c=10 bajó **9×** (1505→166 ms). El `cierre.md` de esta misma ronda ya
había medido una corrida parecida (158/93/95/91 a c=10); esta repetición confirma el orden de
magnitud, no es un número aislado. El costo real de la caché: dentro de la misma ventana de 60 s
cualquier volumen de visitas paga lo mismo (una sola consulta real a Supabase cada 60 s por
página); la primera visita de cada ventana sigue pagando el costo viejo.

### El primer clic de la varita (re-medido, misma metodología que el 28/9)

3 corridas, producción, CPU ×4, foto de prueba `01-living-luz.jpg`, clic sobre el canvas ya
preprocesado (scroll al centro antes de medir, igual que `simulador-calidad.prueba.cjs`):

| Corrida | Tarea larga (longtask) |
|---|---|
| 1 | 576 ms |
| 2 | 599 ms |
| 3 | 571 ms |

**571-599 ms**, dentro del rango 400-724 ms que ya figuraba abierto — sigue sin arreglarse (es
esperable: nadie tocó el simulador esta ronda). Línea de base de esta ronda: ~580 ms promedio.

## 2. Tabla por página (producción :3100, celular, 4G flojo, CPU ×4, caché fría)

| Página | FP | FCP | LCP | Peso total | JS | Fuentes | Tarea larga más grande |
|---|---|---|---|---|---|---|---|
| `/` | 772 ms | 912 ms | 912 ms (H1) | 258,8 KB | **138,1 KB** | 109,5 KB | 170 ms (hidratación) |
| `/pintores` | 772 ms | 916 ms | 916 ms (H1) | 252,0 KB | 132,5 KB | 109,5 KB | 174 ms |
| `/obras` | 756 ms | 896 ms | **2272 ms** (IMG) | 568,7 KB | 132,3 KB | 109,5 KB | 174 ms |
| `/simulador` | 768 ms | 964 ms | 964 ms (H1) | 267,0 KB | 148,4 KB | 109,5 KB | 169 ms (carga) / **571-599 ms (1er clic varita)** |
| `/publicar` (sin sesión → 307 a `/ingresar`) | 876 ms | 1060 ms | 1060 ms | 334,0 KB | 208,2 KB | 109,5 KB | 187 ms |
| `/publicar` (con sesión, la página real) | — | 960 ms | 960 ms | 258,8 KB | 140,2 KB | 109,5 KB | 163 ms |

JS de la portada: **138,1 KB** (141.393 bytes) — coincide, al KB, con el número que dejó la ronda
anterior ("202 → 138 KB") tras sacar el SDK de Supabase de la barra. **Sigue en 138 KB**, no hubo
regresión.

CLS en las cinco páginas: 0,0001-0,017 — ninguna cerca del umbral de 0,1, no es un problema.

### El caso `/obras`: LCP 2,5× más lento que el resto, y por qué

El elemento LCP no es texto (como en las otras cuatro páginas) sino la foto de portada de
**casa-barracas** (`photo-1618221195710-dd6b41faaea6`, la única sin `loading=lazy` de las tres,
con `<link rel=preload as=image>` propio). Pesa **89,5 KB** y aun con prioridad tarda hasta los
2272 ms porque compite, en el mismo 4G flojo (200 KB/s reales), con los 138 KB de fuentes
precargadas + ~132 KB de JS que se piden en paralelo apenas arranca la navegación: a ese ancho de
banda, sólo fuentes+JS ya ocupan >1,3 s antes de que la imagen termine de bajar su porción. El
peso total de `/obras` es **568,7 KB**, el más pesado de las cinco páginas, repartido:

| Tipo | Peso | Qué es |
|---|---|---|
| Imágenes (3 fotos) | 318,1 KB | portadas de `casa-barracas` (89,5 KB), `estudio-nordelta` (**133,1 KB, la más pesada de la página**) y `loft-palermo` (94,7 KB) |
| Fuentes | 109,5 KB | igual que toda página |
| JS | 132,3 KB | igual que toda página |
| CSS | 7,6 KB | — |

Las tres imágenes vienen del optimizador de `/_next/image`: tamaño pedido correcto para el ancho
de pantalla (confirmado con `curl` + Pillow sobre el archivo real, no con `naturalWidth` del DOM
— ver nota de método abajo): a 390 px de ancho con DPR 3 (necesita ~1170 px físicos), el
navegador eligió el candidato de 1200 px del `srcset`, ni más ni menos. **No están
sobre-servidas en ancho.** Lo que sí es cierto y es nuevo: las tres fotos de stock son
apaisadas (1200×633, 1200×800, 1200×633 reales) y las tarjetas son verticales (`aspect-[4/5]`,
`object-cover`, `fill` en `project-card.tsx:34-43`): para cubrir una tarjeta de 358×448 CSS a DPR
3 (1074×1344 físicos) con una foto apaisada, el navegador tiene que agrandar la imagen **~2,1×**
en vertical para taparla entera — se nota borroneada en un celular de gama alta, no por exceso de
bytes sino por falta de alto en el archivo de origen. `next/image` sólo varía el ANCHO del
`srcset` según el `sizes`, no compensa el recorte vertical que impone `object-cover` con una
imagen de aspecto distinto al del contenedor.

Las otras dos imágenes sí están bien marcadas `loading="lazy"` (están debajo del pliegue en
390×844: `estudio-nordelta` arranca a 1189 px, `loft-palermo` a 1744 px).

### Nota de método: `naturalWidth` miente bajo esta emulación de celular

Para armar esta sección medí primero con `img.naturalWidth` comparado contra el tamaño en
pantalla, como pide la consigna. Dio números absurdos: las tres fotos de `/obras` reportaban
`naturalWidth=390` (y alto proporcional), *exactamente* el ancho del viewport configurado,
sin importar cuál de las tres imágenes fuera. Verificado con `curl` + Pillow sobre el archivo
real sobre la MISMA url que usaba el navegador (`currentSrc`): son 1200×633 y 1200×800 píxeles
de verdad — y un `<img>` creado a mano en la misma página, con la misma URL, reporta
`naturalWidth=1200` correctamente. El problema es específico de las imágenes con `fill` +
`object-cover` de `next/image` bajo esta emulación de Chrome headless (`deviceScaleFactor=3`,
`isMobile`): el navegador decodifica al tamaño pintado y expone ESE tamaño como `naturalWidth`,
no el tamaño real del archivo. **Cualquier medición futura de "imagen de más" en este kit, en
móvil, tiene que comparar contra el archivo real (`curl` + Pillow/`identify`) o contra el `w=`
de la URL de `/_next/image`, no contra `img.naturalWidth` leído del DOM.** Dejo esto para que no
se repita la medición mintiendo "imágenes de 390 px" que en realidad pesan 1200.

## 3. Lo que más ganaría, con el número que lo justifica

1. **La caché de 60 s ya se cobró su ganancia — no hay nada que arreglar acá, sólo seguir
   midiéndola.** `/` pasó de 1505 a 166 ms (p50, c=10): 9× más rápida, y deja de ser la página
   más cara. Esto ya está hecho esta ronda; lo dejo arriba porque es el número que pedía medir
   el pedido, no como pendiente.
2. **Las tres fuentes siguen pesando 109,5 KB en cada visita**, el 42% de los 258,8 KB de la
   portada. JetBrains Mono (39,8 KB) se usa sólo en etiquetas chicas (`font-mono text-mono-sm`)
   y sigue bajándose completa aunque no se precargue. Subconjunto a los caracteres realmente
   usados (dígitos, mayúsculas, `★`, `%`) o cargarla sólo donde se usa en vez del layout raíz
   cortaría buena parte de esos 39,8 KB en todas las páginas, no sólo una.
3. **El primer clic de la varita sigue congelando 571-599 ms** (3 corridas, CPU ×4, producción).
   Sin cambios desde el 28/9 — nadie tocó el simulador esta ronda. La solución de fondo (Web
   Worker con `OffscreenCanvas`) sigue pendiente.
4. **(Menor, nuevo) Las fotos de `/obras` se ven borroneadas en celulares de alta densidad**, no
   por exceso de peso sino por defecto: son apaisadas (1200×633/800) metidas a la fuerza en
   tarjetas verticales por `object-cover`, lo que exige agrandarlas ~2,1× para taparlas. Subir
   versiones ya recortadas al 4:5 (o pedir el recorte a Unsplash con `fit=crop&w=900&h=1125`)
   evitaría el agrandado sin tocar el peso.

## Medido vs. deducido

Todo lo de arriba es **medido** contra :3100 (commit `1a06193`, producción real, no desarrollo),
con el método que pide la consigna (CDP `Network.emulateNetworkConditions` + `CPUThrottlingRate`
×4). Lo único deducido: que el 2,1× de agrandado en las fotos de `/obras` "se nota" a simple
vista — no se adjunta captura, es una consecuencia aritmética de los números medidos (tamaño real
del archivo vs. tamaño físico necesario), no una inspección visual.
