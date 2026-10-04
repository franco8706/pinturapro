# Simulador — uso real · ronda `2026-10-03-simulador`

Agente `simulador-uso-real`. Chrome 152.0.7977.82 propio; desarrollo :3000 y producción :3100 (celular
gama media = CPU ×4). Código sin cambios desde `0d928d4`. Nada creado en la base. Scripts y capturas:
`tools/auditoria/.salida/simulador-uso-real/` (abajo, `cap/` = `…/capturas/`). Todo **medido** salvo
donde dice deducido. Puntos de toque en fracciones 0..1.

## BLOQUEANTE

**0. 🤖 IA: cambiar de foto mientras analiza pinta la foto NUEVA con la forma de la pared VIEJA.**
Compu, sesión `cliente`. Color Azul Profundo, subir `r11-pared-lisa-reloj`, 🤖 IA, tocar (0,22; 0,30);
durante "Analizando…" (3-60 s; "Cambiar foto" es el único botón habilitado) cambiar a
`r02-cuarto-claro-puerta-abierta` y no tocar nada. Esperado: r02 limpia. Pasó: **560.986 px pintados
sin tocar**: puerta, sillón, planta y cómoda de r02 en azul, con un círculo sin pintar donde estaba el
reloj de r11 y la silueta de su maceta y su lámpara; aparece "Limpiar selección".
`cap/t18-ia-foto-nueva-sin-tocar.png`. Causa: `reset()` (`photo-simulator.tsx:917-940`) no aborta
`abortRef` ni invalida el análisis; al volver se guardan las regiones viejas (516-517) y el toque
pendiente sigue con `pickAt` sobre la foto nueva (718-727, 539-596). Deducido: hasta recargar, los
toques en IA sobre la foto nueva usan las regiones viejas, y el pedido a Replicate sigue corriendo.
**El servidor de IA está configurado y anda** (`REPLICATE_API_TOKEN` en `.env.local`): 200 en 9 s, pared
entera de r11 sin pasarse ni cortar en arco. 2 usos en total.

## IMPORTANTE

**1. Elegir otro color mientras la varita calcula deja la pared con el color VIEJO.** Compu y celular,
dev y prod. r11, Azul Profundo, clic (0,22; 0,30) y enseguida "Arena": Arena queda marcado y la pared
azul (tono 253°; Azul 254°, Arena 84°; 476.607 px), hasta la próxima acción. `cap/h1-carrera-color-compu.png`.
Ventana: ~0,6 s con un toque (celular gama media); **con toques en cola, más de 2 s** (cinco toques en
r02 y Arena a los 2,25 s → pared azul, 415.789 px). Causa: el resultado se pinta con el `repaint` de la
render del clic (`applyWand` 630-661, `repaint()` 657; cola 696-702); cambiar color no cambia la
generación. Igual para Intensidad e IA (deducido).

**2. Toque con aviso + subir Sensibilidad (lo que aconseja el aviso) rompe el estado y Deshacer borra
de más.** Compu. `r05-living-calido-macrame`, Azul, Sensibilidad 26: (a) clic (0,30; 0,25) → 262.451 px;
(b) clic (0,44; 0,45) → "Ahí no hay una superficie clara… o subí la Sensibilidad"; (c) Sensibilidad a 70
→ 289.775 px; (d) Deshacer. Esperado 262.451; pasó **0: se fue también la pared de (a)**. Sin (a): la
pintura queda puesta (133.849 px) **sin "Limpiar selección" ni "Deshacer"** y con el aviso rojo a la
vista (`cap/h2b-sin-limpiar-compu.png`). Reproducido dos veces, números idénticos. Causa: `lastClickRef`
se anota antes de saber si el toque sirvió (730) y `recalcularArrastre` (767-784 → 653-658) no llama a
`recordarParaDeshacer`/`setHasSelection` ni limpia el aviso. En r12 (0,4565; 0,33) subir a 70 no agarra
nada: el consejo del aviso no siempre sirve.

**3. Un toque corta la pintura en un ARCO DE CÍRCULO en la pared lisa** (5 de 13 interiores: r11, r08,
r10, r05, r13). r11: azul hasta un arco en x≈0,82; hace falta otro toque (68 % → 87 %).
`cap/h3-arco-r11.png`, `cap/h-r08-…png`. Causa: `maxRadius` = media diagonal (`magic-wand.ts:256`).

**4. El toque se pasa a lo que es del mismo color.** r07: **todo el techo**; r03: las alacenas; r12: la
repisa; r11: media maceta y media lámpara; r13: la silla. `cap/h-r07-…`, `h-r03-…`, `h-r12-…` (magenta =
pintado). (Techo igual a la pared: la ayuda dice separarlo con el Pincel.)

**5. Fachadas: la varita casi no sirve y avisa "Ahí no hay una superficie clara" sobre la pared.**
Terracota, Sensibilidad 26: f04 piedra 3/3 avisos, 0 px; f01 tejuela aviso; f05 dos avisos en la pared
blanca; f03 aviso y rectángulos de 1-2 %; f02 1,4 % y 7,6 % con agujeros. A 70: piedra sigue con aviso,
tejuela 1,3 %, madera 1,9 %, y en f05 la pared se pinta **junto con el solado de la pileta**.
`cap/h-f04-…`, `cap/s19-fachadas70.png`. La caja de subida invita: "pared, frente o fachada".

**6. El 🖌 Pincel deja círculos sueltos en vez de una línea, y en el celular llega tarde.** Prod, trazo
a 60 Hz de lado a lado de r02 en 0,4 s: celular gama media tamaño 36 → 2 huecos (152 px de 1024),
tamaño 10 → 5 huecos (236 px); celular rápido tamaño 10 → 6; compu tamaño 10 → 25. Cada movimiento
bloquea 77-510 ms en gama media. `cap/s12-pincel.png`. Causa: `pintarEn` estampa un círculo por evento
sin unir con el anterior y repinta la foto entera en cada uno (795-826, 1001). Borrar igual (deducido).

**7. En el celular no se ven la pared y los colores a la vez.** 390×844: la foto termina en y=777 y el
primer color empieza en y=1407. Cada prueba de color = bajar, tocar, subir; por eso la carrera del 1
pasa inadvertida.

## MENOR
- IA sin sesión: "Iniciá sesión… marcá la pared con el 🖌 Pincel": sin enlace ni mención de la Varita;
  la página dice "Simulador con IA (SAM)… la IA marca el contorno exacto".
- Cambiar de marca o Interior/Exterior con la pared pintada borra el color y deja el velo azul de selección.
- PNG transparente: tocar lo transparente no muestra nada ni avisa.
- Queda vivo un lienzo de más cada dos fotos (1 → 4 tras 8, también en prod; ~2,8 MB c/u, deducido).
- Zoom 400 % + teclado: la mira sale del recuadro y éste no la sigue.
- Foto vertical en compu: no entra en el recuadro de 70vh; hay que desplazarla adentro.
- Apaisado 844 px: logo pegado a "Obras" y menú cortado (`cap/t15-horizontal.png`).
- 24,6 MP: dice "25 megapíxeles" sin decir el tope. Arrastrar una foto a la caja no la carga (deducido: sin `onDrop`).
- Diez toques en 1 s congelan hasta 1,06 s el celular gama media.

## Anda bien
- Cinco colores seguidos (celular y compu): tono correcto cada vez y lienzo = estado.
- Deshacer tras toque, pincelada, Borrar y Limpiar: vuelve exacto; un nivel; no ofrece tras "Cambiar foto".
- Sensibilidad: sin toque no pinta; arrastrar y soltar = toque nuevo con ese valor (447.046 = 447.046).
- Pincel: salir del lienzo apretado no pinta fuera ni queda pegado; Tamaño cambia el ancho.
- Zoom 200-400 % desplazado: el toque cae exacto (0-1 px). Teclado: Tab, flechas y Enter pintan donde está la mira.
- Apurado: diez toques en 1 s = con calma; tocar y Limpiar/Deshacer no trae resultados viejos; diez toques y cambiar de foto deja la nueva limpia (Varita).
- Girar el celular: lienzo intacto y toque en su lugar.
- 24 fotos seguidas: sin enlentecer (carga 250-400 ms), memoria JS 14,1 → 15,0 MB.
- Archivos: EXIF 8, PNG transparente (no negro), WebP, AVIF, GIF, BMP, CMYK, B/N, progresiva, diminuta, panorámica y 24 MP cargan; 24,6 MP se rechaza y deja elegir otra.
- Consola: 0 errores de JS; único pedido fallido, el 401 esperado de IA sin sesión.

Dos paredes, dos colores: no se puede (un solo color para todo, conocido): al elegir Marfil la primera
pared cambia y al tocar la segunda quedan las dos Marfil.
