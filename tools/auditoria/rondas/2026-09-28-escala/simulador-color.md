# Simulador de color — ronda `2026-09-28-escala` (medido 2/10/2026)

Medido contra **producción en :3100** (commit `740ffda`, sin reiniciar ni recompilar), con el kit
`tools/auditoria/navegador.cjs` + CDP propio (Chrome `152.0.7977.82`, `/usr/bin/google-chrome
--no-sandbox`). Nadie tocó `photo-simulator.tsx` / `packages/color/src/*` desde el 26/9
(`25a04c5`, sólo el anuncio por voz del teclado); confirmado con `git log` sobre esos tres
archivos. 0 usos de `🤖 IA` (no hacía falta para esta tarea).

## 1. Línea de base de calidad

| Métrica | Referencia | Medido ahora | Cómo |
|---|---|---|---|
| Recall (pared con luz de ventana) | 83% | **82,2%** | `regresiones/simulador-calidad.prueba.cjs` contra :3100 |
| Precisión | 98% | **99,3%** | ídem |
| Textura conservada (6 colores) | 0,63 ± 0,009 | Blanco 0,634 · Marfil 0,636 · Arena 0,638 · Gris Perla 0,638 · Azul Profundo 0,636 · Negro Mate 0,630 (dispersión 0,008) | script propio (mismo método que la prueba, erosión 4 px), los 6 colores de `lib/brands.ts` |
| Pintura sobre moldura | 2,5% | **4,5%** (543/12 006 px) | `regresiones/sangrado-moldura.prueba.cjs`, dos corridas, bit a bit igual |
| Perfil de filo (1-2 px hacia adentro desde el borde real de pintura) | 0 | **0,0** (18/18 bordes) | ídem |

Todo sigue **dentro de los pisos de la prueba** (recall≥72%, precisión≥95%, moldura≤6%): nada
está roto. Pero la moldura **casi se duplicó** (2,5%→4,5%) sin que el código haya cambiado —
revisé los 7 commits que tocaron `magic-wand.ts`/`oklab.ts`/`photo-simulator.tsx` desde el fix
original (`11dc118`, 19/9) y ninguno altera `featherMask`, `closeHoles` ni el umbral de la
prueba. El perfil quirúrgico del filo (0,0, el indicador más directo de fuga) sigue perfecto, así
que no hay evidencia de que la pintura se esté pasando otra vez hacia afuera; sospecho que la
franja completa de moldura (26 px) es más sensible a diferencias de decodificación JPEG/escalado
entre versiones de Chrome que a un cambio de lógica — **no lo pude confirmar**, lo dejo anotado
para que la próxima ronda compare si vuelve a moverse.

## 2. El primer clic: función por función (CPU×4, foto `01-living-luz.jpg`)

Perfil CDP (`Profiler.start/stop`) acotado al **long task real** detectado por
`PerformanceObserver('longtask')` (no por tiempo de reloj a ojo): **773 ms** en esta corrida
(rango de referencia 571-724 ms; algo de variación es esperable entre Codespaces). El perfilador
sólo pudo atribuir **363 ms de los 773** a una función concreta — el resto es una limitación
conocida de muestrear bajo `Emulation.setCPUThrottlingRate` (el acelerador introduce pausas que
el sampler no ve; el long task en sí es real, lo confirma el observer nativo, no el profiler).
Dentro de esos 363 ms medidos:

| Tramo | Función / archivo | ms (self) | % de lo medido |
|---|---|---|---|
| **Cerrar huecos** (dilatar+erosionar, 2 pasadas) | `boxMorph`/`closeHoles`, `packages/color/src/magic-wand.ts:318-364` | **164,7** | 45% |
| **Flood fill** (BFS vecino a vecino) | `magicWand`, `packages/color/src/magic-wand.ts:201-311` | **110,1** | 30% |
| Entrada/overhead de `applyWand` | `photo-simulator.tsx:525-553` | 29,0 | 8% |
| Promedio de luminosidad + inicio del difuminado | `recomputeMaskDerived`/`featherMask`, `photo-simulator.tsx:225-248,1025-1067` | 21,8 + 5,0 | 7% |
| `aplicarEn` (wrapper async) | `photo-simulator.tsx:564-591` | 4,2 | 1% |
| Nativo sin atribuir + GC | — | 17,7 | 5% |
| Resto (repaint, React) | — | ~10 | 3% |

Cerrar huecos + flood fill = **75% del tiempo medido** (164,7+110,1 de 363 ms), coherente con el
comentario del propio código ("cerrar huecos es el 66% del costo de la varita").

**Por única vez (al cargar la foto, en `onFile`, `photo-simulator.tsx:169-216`):** la caché OKLab
(`lumaRef`/`cromaRef`) y `prepareWandImage` (YCbCr + blur + Sobel + percentiles,
`magic-wand.ts:98-193`) — confirmado **vacío de muestras** en el perfil del clic: no aparece ni
una sola vez.

**Se repite en cada clic (y en cada Enter sobre la mira, misma `aplicarEn`):** `magicWand` +
`closeHoles` (salvo modo `rapido`), `recomputeMaskDerived`+`featherMask`, y `repaint` (copia
completa de la foto base + muestreo de percentil + bucle OKLab/tanh por píxel seleccionado).
**Al arrastrar "Sensibilidad"** se repite todo MENOS `closeHoles` (ya se llama con
`fillHoles: 0`, `onToleranceChange`, línea 614-621); recién al soltar (`onToleranceCommit`,
línea 623-626) se vuelve a pagar el costo completo — es decir, **el camino rápido ya existe en
el código, sólo no se usa en el primer clic.**

**Barato, sin Web Worker:**
1. Usar `applyWand(nx, ny, tolerance, { rapido: true })` también en el primer clic/Enter, y
   relanzar el mismo clic con huecos cerrados un instante después vía
   `requestIdleCallback`/`setTimeout(0)`, reemplazando la máscara cuando termine. Corta de
   entrada el 45% del trabajo medido sin tocar el algoritmo.
2. (Deducido, no medido aislado) `magicWand` reserva una cola `Int32Array(w*h)` (~2,8 MB) y una
   `Uint8Array` nuevas en cada clic; `closeHoles`/`boxMorph` suman 3 buffers más del mismo
   tamaño; `featherMask`, otro. Precalcularlos una vez junto a `wandRef.current =
   prepareWandImage(base)` (línea 208) y reutilizarlos —mismo patrón que ya usa `oklab.ts` para
   el buffer `lineal`— probablemente explica buena parte de los 410 ms que el profiler no pudo
   atribuir a JS.
3. (Deducido) correr flood-fill + cierre de huecos sobre `Y/Ys/Cb/Cr/grad` a mitad de
   resolución y escalar la máscara: el difuminado ya suaviza el borde, así que perdería poca
   precisión y dividiría por ~4 las dos partes más caras.

## 3. Los dos abiertos de uso — cambio mínimo (sin implementar)

**Volver a "Intensidad":** el estado `strength`/`setStrength` vive DENTRO de
`photo-simulator.tsx:98`, y su control (`photo-simulator.tsx:949-958`) se renderiza ANTES de que
`apps/web/app/(marketing)/simulador/page.tsx` pinte la grilla de colores (columna hermana,
después en el DOM). Cambio mínimo: levantar `strength` a `page.tsx` (como ya está `color`),
pasarlo a `PhotoSimulator` como prop controlada, y mover sólo el bloque JSX del `<input
type=range>` de Intensidad a `page.tsx`, después del `colors.map(...)` (línea ~103). No toca
`repaint` (ya depende de `strength` por prop, línea 350).

**Sin "Deshacer":** ya existe un snapshot de un paso —`maskBeforeClickRef`
(`photo-simulator.tsx:92`)— pero sólo se llena antes de un clic de varita (línea 570) y se
vacía en cada pincelada (línea 649) y en "Limpiar selección" (línea 738). Cambio mínimo:
generalizar ese ref a un snapshot "antes de la última acción" que también se cargue al INICIO
de `pintarEn` (línea 626), y agregar un botón "Deshacer" junto a "Limpiar selección" (línea
961-965) que copie ese snapshot de vuelta a `maskRef.current` y llame
`recomputeMaskDerived`+`repaint`. Un solo nivel de historial alcanza para lo que pide la
bitácora.

## Qué mejoró / empeoró

- **Sin cambios de fondo:** recall, precisión y textura están dentro del margen de ruido de la
  referencia (82,2% vs 83%; 99,3% vs 98%; textura 0,630-0,638 vs 0,63±0,009) — el simulador no
  se tocó esta ronda.
- **A vigilar:** moldura manchada 4,5% vs referencia 2,5% (sigue bajo el piso de alarma de 6%,
  perfil de filo en 0). No até esto a ningún commit; podría ser la versión de Chrome del
  Codespace, no el código.
- **Sigue abierto, sin cambios:** el primer clic (571-773 ms según corrida), "Intensidad" a 7-14
  Shift+Tab, sin "Deshacer" — nadie los tocó esta ronda, era tarea de medir, no de arreglar.
