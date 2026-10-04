# Simulador — uso real, SEGUNDA PASADA · ronda `2026-10-03-simulador`

4/10, `2d75c7a`, Chrome 152.0.7977.82; dev :3000 y prod :3100; "gama media" = CPU ×4. Capturas en
`tools/auditoria/.salida/simulador-uso-real/despues/` (`d/`). Todo medido salvo "deducido". IA: 1 uso
real (200 en 11,6 s), el resto interceptado. Nada creado en la base.

## Arreglos de la primera pasada: confirmados
IA + cambiar foto: 0 px (antes 560.986). Color durante el cálculo: Arena 85° (84°), compu y gama
media. Deshacer + Sensibilidad: r05 284.458 → 315.561 → 284.458. Arco: ausente en 5 fotos (r11 68 →
90 %). Pincel: 0 huecos (antes 2-25). Diez toques: 270 ms (antes 1,06 s). También tira, marca,
PNG, mira, arrastrar, 24,6 MP e IA sin sesión.

## BLOQUEANTE
Ninguno.

## IMPORTANTE
**1. El borde deja un doble contorno.** Compu, r08 (verde oscura) + Blanco Puro, toque (0,5; 0,15).
Fila 185: x=254 pintado (233), **x=255 a medias (162,171,169)**, x=256-257 pintados, x=258 el ciervo.
Línea gris a 2-3 px de cada objeto, visible a tamaño normal: 4.847 píxeles-línea que la foto no
tiene (89 % del filo); r09 negra→blanco 80 %; r11 y r02 claras→oscuro 51 %. Además r11 Negro Mate
deja un aro claro escalonado alrededor del reloj y r02 Azul Profundo mete azul en la tapa de la cómoda.
`d/zoom-r08-BlancoPuro-0.png`, `d/lineas-r08.png`, `d/zoom-r11-NegroMate-g0.png`,
`d/zoom-r02-AzulProfundo-g0.png`. Deducido: el filo queda a 0,67 (`borde.ts:75`) y el anillo de
afuera sube a 1 (`borde.ts:145`). `simulador-borde` mira sólo los píxeles de afuera.

**2. Deshacer después de la ✕ no devuelve la pared y se lleva otra.** Compu, r08: Verde Agua →
(0,5; 0,15) → ＋ → Arena → (0,95; 0,3) → ＋ → Azul Profundo → techo (0,5; 0,04) → ✕ "Arena" →
Deshacer. Esperado: vuelve Arena. Pasó: Arena sigue quitada y el techo azul también se va. La ✕ no
confirma. `d/d06-compu-C3-deshacer-tras-quitar.png`; `photo-simulator.tsx:1108-1114`.

**3. Una pared fijada no se corrige.** Compu, r13: Verde Agua → (0,6; 0,2) (se lleva el techo) → ＋ →
Contorno → Quitar la zona → 4 esquinas del techo → Cerrar: dice "Zona quitada." y el techo sigue
100 % verde; ⌫ Borrar tampoco. Sólo queda la ✕. `d/d06-compu-F-techo-fijo.png`; Contorno y Borrar
editan sólo la selección actual (`cerrarContorno` 828, `pintarEn` 915).

**4. ＋ Otra pared se usa al revés.** Compu, r08: Verde Agua → toque fondo → Arena (el fondo cambia) →
＋ (fija Arena) → toque pared derecha → Verde Agua: colores cruzados. En el celular (390×844, r02)
＋ está en y=784-823 y la ficha que confirma aparece en y=880-914, fuera de pantalla: no se ve nada.
`d/d06-compu-A-orden-natural.png`, `d/d17-movil-tras-mas.png`.

**5. Con "Ver la foto original" prendido el lienzo no responde.** Compu y celular, r02 pintada → Ver
la foto original → tocar el piso, elegir Arena, una pincelada: 0 px cambian; el aviso para lector
dice "Superficie pintada.". Al volver aparecen las tres cosas (450.012 px). Nada junto a los colores
avisa. `photo-simulator.tsx:399`.

**6. IA colgada: 70 s trabado y después nada.** Compu, r11, IA, toque (0,22; 0,30), servidor sin
respuesta: "Analizando…" 70,2 s con todas las herramientas apagadas (sólo "Cambiar foto", que pierde
la foto); al vencer, se va sin aviso ni pintura. `photo-simulator.tsx:539-541`.

## MENOR
- Guardar imagen sin color elegido baja la foto con el velo azul de selección (112,164,219).
- Teclado: tras Enter en ＋, Limpiar, Deshacer o ✕ el foco cae al `<body>`.
- Lienzos de vista sueltos: 3 tras 20 fotos (antes uno cada 2). Memoria JS estable.
- Tira: el 8.º color (Negro Mate) queda oculto a la derecha sin indicio (416 px en 366).
- Contorno con teclado: Enter sobre la primera esquina agrega otra; la ayuda dice "tocá la primera".
- Intensidad cambia también las paredes fijadas (Verde Agua 167,198,186 → 116,145,136 a 60 %).
- ＋ apretado al instante (CPU ×6, toques a 60 ms) deja una ficha sin pintura (3/3); con reacción humana, no.
- Sigue (conocido): r07 un toque pinta todo el techo; r13 techo, ventana, mesa de luz y silla. "Quitar la zona" lo saca con 4 esquinas (techo 100 % → 0,6 %).

## Anda bien
- Contorno: compu, celular, teclado, zoom 300 % (99,8 % adentro), moño par-impar, avisos con <3 esquinas, toques a 40 ms, borde, Deshacer. Fachada de piedra: 17 toques.
- ＋: tope de 8 con aviso; 8 paredes no enlentecen (314 ms); IA real + ＋ sin pedidos extra.
- Girar con dos paredes y un contorno a medias: todo en su lugar.
- Guardar baja la pintada aunque se vea la original (iOS sin probar).
- Gama media: toque 283 ms, cerrar contorno 257, ＋ 155, color 109, ✕ 380.
- Consola: 0 errores de JS; sólo los 401/503/429/500 de IA provocados.
