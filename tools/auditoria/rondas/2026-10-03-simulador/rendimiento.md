# Rendimiento del simulador · ronda `2026-10-03-simulador`  (PARCIAL — se actualiza)

Agente `rendimiento`. Todo **medido** salvo donde dice *deducido*. Producción en :3100 (commit `2d75c7a`,
standalone), Chrome **152.0.7977.82**, kit `tools/auditoria/navegador.cjs`. Celular de gama media =
390×844, DPR 3, táctil, CPU ×4 (`Emulation.setCPUThrottlingRate`), un Chrome NUEVO por corrida.
Scripts y datos crudos: `tools/auditoria/.salida/rendimiento/` (`lib.cjs`, `medir.cjs`, `res-*.json`).
Código del producto: sin tocar.

## Cómo se midió y qué no hay que creerle

- **Carga**: `uptime` (1/5/15 min) al empezar cada corrida y cuántos Chrome ajenos había. Antes de
  cada corrida corre una tarea fija (cuentas y arreglos tipados del tamaño de una foto): con la
  máquina en calma da **47-49 / 47-54 ms** (ALU / memoria, ×4). Una corrida con más de +12 % (ALU) o
  +16 % (memoria), antes o después, se descarta y se repite; las descartadas se listan.
- **Tarea larga** = `PerformanceObserver("longtask")` (>50 ms) desde el clic. **Hasta ver el color** =
  del manejador del `click` hasta dos `requestAnimationFrame` después del `putImageData` grande (la
  página se instrumenta con `addInitScript`; no se edita nada).
- **El ×4 NO estrangula al Web Worker** (medido, `t00d.cjs`): pedir la misma región de la varita da
  62-93 ms con ×1 y 69-128 ms con ×4, mientras un bucle del hilo principal pasa de 28 a 121 ms. O sea
  que en un celular de verdad la varita (hoy: ~80 ms de worker en la emulación) tardaría ~4× en su
  hilo: **los "hasta ver el color" de este reporte quedan cortos en unos 200-250 ms** frente a un
  celular real (*deducido*; las tareas largas del hilo principal no se ven afectadas). Tampoco se
  estrangula la decodificación de la foto (se hace fuera del hilo principal).
- La máquina es compartida (4 vCPU). La misma operación varió hasta ±15 % entre corridas aun con la
  calibración limpia; por eso se dan todas las corridas, no un promedio.

## 1. Cargar una foto (`setInputFiles` → lienzo dibujado)  ·  3 corridas, ×4

Hasta dibujar = del evento `change` al `putImageData` completo; "ver" = +2 cuadros.

| Foto | Corrida | Hasta dibujar | Hasta verla | Tarea larga más grande | Carga (1 min) |
|---|---|---|---|---|---|
| r11 real 1600×1068 (195 KB) | 1 | 773 ms | 868 ms | 689 ms | 0,51 |
| | 2 | 777 ms | 849 ms | 680 ms | 1,11 |
| | 3 | 760 ms | 822 ms | 675 ms | 1,10 |
| `justo-24mp-6000x4000.jpg` (1,1 MB) | 1 | 1.165 ms | 1.232 ms | 833 ms | 1,18 |
| | 2 | 1.005 ms | 1.070 ms | 842 ms | 1,59 |
| | 3 | 1.027 ms | 1.105 ms | 868 ms | 1,55 |

Dónde se va el tiempo (r11, medido con ganchos en `createImageBitmap`, `getImageData`, `postMessage`):
decodificar 31-35 ms + reducir a 1.024 px 75-90 ms (fuera del hilo principal) → `drawImage` +
`getImageData` ≈ 22 ms → **`fotoPerceptual` (OKLab de cada píxel) + copia para el worker: 561-592 ms**
(la tarea larga de 675-689 ms) → render de React y primer pintado 50-62 ms. Con la 24 MP lo mismo, pero
decodificar cuesta 110-284 ms y reducir 260-282 ms (en un celular de verdad esas dos van en otro hilo y
tardarían más: no se estrangulan). Memoria al terminar: heap JS 4,2 MB, **arreglos tipados 18 MB**, 1
lienzo vivo.

## 2. Primer toque de la varita  ·  referencia 319-339 ms de tarea larga / 413-425 hasta el color

`node tools/auditoria/simulador/congelamiento.cjs` tal cual (escritorio 1440 px, `01-living-luz.jpg`, ×4,
carga 1,36→1,22): tarea larga **319 · 307 · 329 ms**, hasta ver el color **427 · 391 · 430 ms**.
Sin regresión.

Misma prueba como celular (390×844, táctil, r11, toque en 0,22/0,30; 5 corridas, carga 1,6-2,0):

| Corrida | Tarea larga | Hasta ver el color | Worker (ida y vuelta) | Hilo principal tras el worker |
|---|---|---|---|---|
| 1 | 353 ms | 455 ms | 88 ms | 351 ms |
| 2 | 324 ms | 425 ms | 78 ms | 322 ms |
| 3 | 306 ms | 421 ms | 92 ms | 304 ms |
| 4 | 326 ms | 439 ms | 94 ms | 324 ms |
| 5 | 301 ms | 391 ms | 76 ms | 299 ms |

(Una sexta, descartada por máquina ocupada, dio 313 / 438.) **El worker ya no es el cuello: 76-94 ms; lo
que congela son los ~300-350 ms que quedan en el hilo principal.**

**Cuánto pesa el borde desmezclado** (`packages/color/src/borde.ts`, `alfaDeLaSeleccion` +
`difuminarHaciaAdentro`), con el perfilador de CPU de Chrome sobre el primer toque (funciones
identificadas en `page-e33afc95349bb9a2.js`):

| Función (hilo principal) | CPU ×1 (tarea 96 ms) | CPU ×4 (tarea 384 ms con el perfilador) |
|---|---|---|
| `alfaDeLaSeleccion` (anillo, dilatación, desmezcla) | 29,8 ms | 118,3 ms |
| `difuminarHaciaAdentro` (caja 3×3 separable) | 17,9 ms | 65,6 ms |
| **Borde en total** | **47,7 ms = 50 %** | **183,9 ms = 48 %** |
| `componer` (pinta 700.000 px con la tabla) | 24,4 ms (25 %) | 113,7 ms (30 %) |
| bucles de `applyWand` (área y unión de máscaras) | 6,8 ms | 25,3 ms |
| `ancla` (percentil) | 5,2 ms | 18,6 ms |
| `repaint` (resto), GC | 7,2 ms | 19,3 ms |

**El borde es la mitad de la tarea larga del primer toque (≈150-185 ms de 311-384 en ×4), y se paga igual
en CADA toque, pincelada terminada, Deshacer, Limpiar y contorno** (todos pasan por `recomputeMaskDerived`).


**Ojo: ese ~300 ms es el caso bueno.** Con la misma foto, el mismo punto y el mismo color, el primer toque
sobre la MISMA r05 dio 267 ms como primera foto de la visita y **600-770 ms** cuando venía de otras fotos
(secuencia de 10, 3 corridas; también r03, r07, r09: 530-1.045 ms). El perfil de CPU lo ubica en el borde:
`difuminarHaciaAdentro` pasa de 54-90 ms a 211-217 ms y `alfaDeLaSeleccion` de 51-93 a 316-325 ms en el mismo
toque (la traza de Chrome no muestra recolección de basura que lo explique: 12-31 ms). Sospecha
(*no confirmada*): el código ya optimizado se descarta entre toques (en un banco dentro de Chrome, 1 de 8
llamadas tras un GC forzado tardó 454 ms contra 105 ms). Resultado práctico: **el congelamiento del primer
toque puede ser de 0,3 a 1,0 s según el momento**, no 0,32 s.

## 3. Cambiar de color con una pared pintada  ·  antes 241 ms (22/9)

r11 (82 % de la foto pintada), celular ×4, 3 corridas, ocho cambios de color por corrida y por Intensidad.
"Primero" = el primer cambio de la sesión; "mediana" y "máx" = los otros siete. Tarea larga en ms
(hasta ver el color = +3 a +5 ms).

| Intensidad | Corrida | Carga | Primero | Mediana | Máx |
|---|---|---|---|---|---|
| **100 % (defecto)** | 1 | 1,70 | 119 | 96 | 177 |
| | 2 | 1,74 | 117 | 129 | 184 |
| | 3 | 1,93 | 121 | 103 | 170 |
| **90 %** | 1 | 1,70 | 333 | 305 | 326 |
| | 2 | 1,74 | 286 | 306 | 372 |
| | 3 | 1,93 | 286 | 301 | 473 |

**Con 100 % la tabla por color funcionó: ~100 ms contra 241 (−58 %). Con 90 % no: ~300 ms.** Con la
Intensidad en cualquier valor menor a 100, `componer` ya no entra al camino rápido de la tabla (`alfa × fuerza
>= 1` deja de cumplirse en todo píxel) y hace por píxel la mezcla en OKLab, una conversión a sRGB y una tupla
nueva (`oklab.ts: oklabASrgb`). Si el 241 de entonces era con el 90 % que era el defecto, **hoy a 90 % es peor
(+25 %)**. En banco (r05, selección del 39 %, Chrome ×4): `componer` 42-47 ms a 100 % y 114-131 ms a 90 %.

## 4. Arrastrar Intensidad de 100 a 40  ·  gesto táctil de 1 s, 3 corridas

| Corrida | Carga | Eventos `input` entregados | Tareas largas (ms) | Suma | Del 1.er `input` al último pintado | Huecos entre cuadros |
|---|---|---|---|---|---|---|
| 1 | 1,78 | 6 de ~60 | 280 · 274 · 361 · 359 · 242 · 267 | 1.783 | 1,79 s | máx 633 ms (3 de >100) |
| 2 | 1,66 | 6 | 280 · 260 · 280 · 245 · 247 · 252 | 1.564 | 1,60 s | máx 483 ms (4 de >100) |
| 3 | 1,56 | 6 | 316 · 266 · 258 · 258 · 245 · 267 | 1.610 | 1,63 s | máx 500 ms (3 de >100) |

Cada tick repinta la foto entera por el camino lento: **seis bloqueos seguidos de 242-361 ms** (1,6-1,8 s
casi sin atender nada) para un gesto de 1 s; el control se mueve a saltos, 3-4 veces por segundo. Termina
bien (valor final 40, último pintado 5 ms después de soltar). **Y en el celular la persona no ve la pared
mientras lo mueve:** con el control a la vista (y=414), el lienzo entero queda fuera de la pantalla, su borde de
abajo 1.023 px por encima del borde superior (el control está en la columna de abajo, después de la grilla de
colores).

## 5. Pincel: un trazo de 1 s de lado a lado  ·  antes 77-510 ms por movimiento

r11, tamaño 36 (el defecto: 72 px de ancho en pantalla), 3 corridas.

| Corrida | Carga | Movimientos | Repintados parciales | `putImageData` máx | Tareas largas **durante** el trazo | Al **soltar** | Cuadros |
|---|---|---|---|---|---|---|---|
| 1 | 1,54 | 54 | 55 (≈46.600 px c/u) | 2,9 ms | 64 ms | **291 ms** | máx 50 ms |
| 2 | 1,46 | 54 | 55 | 2,5 ms | 68 ms | **260 ms** | máx 50 ms |
| 3 | 1,42 | 56 | 57 | 1,0 ms | 58 ms | **289 ms** | máx 50 ms |

**El trazo es fluido** (ninguna tarea larga salvo la del primer toque, 58-68 ms; 0-1 huecos de 50 ms) y la
línea queda continua (821 de 821 columnas pintadas, 0 huecos). Lo que queda es **al soltar el dedo: 260-291
ms** (`cerrarTrazo`: borde de la foto entera + repintado completo), y vale igual para un trazo de 1 cm.

## 6. Diez toques seguidos de la varita  ·  antes hasta 1,06 s

r11, diez toques en 1 s (cada 100 ms), 3 corridas:

| Corrida | Carga | Pedidos al worker | Repintados | Tareas largas (ms) | Del 1.er toque al último pintado | Hueco máx entre cuadros |
|---|---|---|---|---|---|---|
| 1 | 1,85 | 10 (65-111 ms c/u) | 3 | 320 · **434** | 1,70 s | 417 ms |
| 2 | 1,87 | 10 | 3 | 307 · **444** | 1,74 s | 433 ms |
| 3 | 1,81 | 10 | 2 | **513** | 1,51 s | 500 ms |

Mejora (de 1,06 s a 0,43-0,51 s), pero **la cola no dibuja una sola vez**: dibuja 2-3. Y cada toque de la cola
sigue haciendo en el hilo principal las pasadas de 700.000 elementos de `applyWand` (área, unión, copias para
Deshacer: ≈25 ms por toque con ×4, perfil de CPU) aunque su dibujo se descarte. Con cadencia de persona (un toque cada 400 ms):
**diez tareas largas, una por toque, de 194 a 346 ms: 2,3-2,6 s bloqueados de 3,9** (60-67 % del tiempo).

## 7. Memoria  ·  3 corridas, ×4, todo medido después de forzar el recolector

**Diez fotos seguidas con "Cambiar foto"** (r01…r09, r13; cada una con un toque):

| Dato | Inicio | Después de cada foto (1ª → 10ª) |
|---|---|---|
| JS heap | 4,0 MB | 4,5 → 5,0 MB (plano) |
| Arreglos tipados (ArrayBuffer) | 0,5 MB | 16,5-19,7 MB; 25,6 (r06) y 28,9 (r09, cuadrada); **no se acumulan** |
| Lienzos `<canvas>` vivos | 0 | **1** en las 30 mediciones |
| Workers | 1 | 1 |
| Nodos del DOM | 339 | 459 → 607 (**+16-17 por foto**, en las 3 corridas) |

Sin fuga de lienzos ni de buffers. Lo único que crece es el DOM retenido, ~17 nodos por foto (≈ algunos KB;
menor, no se investigó de dónde sale). Carga por foto: 617-1.350 ms (promedio 843), con tareas largas de 511
a 1.161 ms, proporcionales a los píxeles (r08, 0,59 MP: 511-559; r09, 1,05 MP: 940-983).

**Seis paredes con "＋ Otra pared, otro color"** (r05, varita; 3 corridas):

| Paredes fijadas | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|---|
| ArrayBuffers (MB) | 18,0 | 20,9 | 23,7 | 26,5 | 29,3 | 32,1 | **35,0** |
| JS heap (MB) | 4,2 | 4,8 | 4,9 | 5,0 | 5,0 | 5,0 | 5,1 |
| Lienzos vivos | 1 | 1 | 1 | 1 | 1 | 1 | 1 |

**+2,8 MB por pared** (una copia `Float32Array` del alfa), idéntico en las 3 corridas; con las 8 que permite
`MAX_PAREDES` serían ~40 MB. Y cada pared suma costo a cada repintado: cambiar de color con 5 paredes ya
fijadas tardó 109-205 ms (contra 90-108 con ninguna); con paredes distintas (trazos del pincel) 109-115 contra
62-76. El botón "＋ Otra pared" congela 121-323 ms y crece ~15-20 ms por pared fijada.

## 8. Peso de /simulador y el worker  ·  celular ×4, 4G flojo (150 ms, 1,6 Mbps), caché fría, 3 corridas

| Corrida | Carga | 1.ª pintura | FCP = LCP | Hidratado | Tarea larga máx (TBT) | CLS | Peso |
|---|---|---|---|---|---|---|---|
| 1 | 2,00 | 780 ms | 956 ms | 1.956 ms | 193 ms (157) | 0 | 249,9 KB |
| 2 | 1,76 | 820 ms | 928 ms | 1.972 ms | 195 ms (186) | 0 | 249,9 KB |
| 3 | 1,56 | 784 ms | 948 ms | 1.960 ms | 207 ms (167) | 0,0014 | 249,9 KB |

Por tipo (idéntico en las 3): **JavaScript 155,7 KB comprimidos (16 archivos, 487 KB descomprimidos)**, fuentes
78,6 KB (3), CSS 7,6 KB, documento 6,5 KB, 1 imagen 0,7 KB. Los más pesados: `535f6e8e…js` 53,4 KB (React DOM),
`5914-…js` 45,4 KB (enrutador de Next), `simulador/page-e33afc95349bb9a2.js` 14,7 KB (el simulador y el motor de color).
**El worker de la varita carga aparte**, como `4590.c40d397178699a40.js` (2,1 KB comprimido, 3,7 KB crudo), pedido
a los ~2,1 s —cuando el componente se monta, antes de que nadie suba una foto— y termina en 16 ms: no frena nada.
No hay imágenes pesadas que bajar (la foto de la persona no sale del navegador).

## AVISO — el `borde.ts` que hay hoy en el disco es ~1,8× más lento que el que está en :3100

Todo lo de arriba es la compilación `2d75c7a`. Pero `packages/color/src/borde.ts` **cambió en el disco a las
03:47 de hoy** (md5 `61ab0998…`; el de `2d75c7a` es `d233b529…`): las tres franjas (filo de adentro, primer
y segundo píxel de afuera). Medí las DOS versiones dentro de Chrome (celular, CPU ×4, misma foto, misma
máscara de la varita, 8 repeticiones; carga 2,5; el banco es `.salida/rendimiento/t12-borde-nuevo.cjs`):

| Foto (selección) | `alfaDeLaSeleccion` en :3100 (mediana) | borde.ts nuevo (mediana) | Diferencia |
|---|---|---|---|
| r11 (89,5 %) | 142 ms | **229 ms** | +87 ms (×1,6) |
| r05 (39,3 %) | 123 ms | **233 ms** | +110 ms (×1,9) |
| r02 (58,7 %) | 127 ms | **232 ms** | +105 ms (×1,8) |

Si entra tal cual, cada toque, cada trazo soltado, Deshacer y Limpiar pagan ~100 ms más (el primer toque de
~310 a ~410 ms; el pincel al soltar de ~280 a ~380). La causa se lee en el código: `vecinos(i, x, y, f)` se llama
2,1 millones de veces por pasada (cada píxel de la foto, tres pasadas) y en cada una **crea una función flecha
nueva** y la llama hasta 8 veces; la versión de :3100 usa dos pasadas separables sin funciones. La imagen
resultante cambia en 3.800-6.000 píxeles por foto (diferencia máxima 1,0), que es lo que se buscaba corregir.
