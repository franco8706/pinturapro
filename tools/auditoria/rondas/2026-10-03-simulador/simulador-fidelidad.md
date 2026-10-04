# simulador-fidelidad — ronda `2026-10-03-simulador` (3/10/2026)

Chrome 152.0.7977.82 · :3100 · scripts y `informe.txt` en `tools/auditoria/.salida/simulador-fidelidad/`.

## Cómo se midió (medido)

- Réplica de `repaint` en Node (importa `oklab.ts`): **idéntica BIT A BIT al lienzo** en 864/864
  casos (9 paredes × 48 colores × 90/100 %) + 9 superposiciones, dos veces. Todo lo de abajo vale
  para el navegador.
- Paredes: blanca, beige con ventana, azul oscura, roja, subexpuesta (PNG propios) y r11, r07,
  r08, r09 (un toque de varita), sin 4 px de borde. ΔE2000 validado con Sharma (5·10⁻⁵); CAM16
  contra colour-science.
- Ida y vuelta sRGB→OKLab→sRGB, 16,7 M colores: error máx. 0,004 niveles.

## Hallazgos

**BLOQUEANTE — Intensidad 90 % por defecto** (`page.tsx:21`, `photo-simulator.tsx:134`). 432 casos:
ΔE del color mediano p50 3,83 · p90 7,41 · máx 9,53; **339/432 por encima de 2**. La misma pintura
sobre blanca/azul/roja/subexpuesta difiere ΔE 7,6 de mediana (8,8 máx); al 100 %: 0,29 (0,60).
Roja: Blanco Puro 8,5→1,0, Verde Agua 8,5→1,4.

**IMPORTANTE — croma `tc·(1−rd²·0,35)`** (`photo-simulator.tsx:372-373`, `pintura.ts:152-153`). Al 100 %
sobre la blanca pareja: Durazno 2,22 · Marfil 2,20 · Lino 1,85 · Amarillo Colonial 1,83; croma en el
centro de la pared 0,74 (Marfil) a 0,92 de la muestra.

**MENOR — tono de los azules en sombra** (nuevo). Con croma fijo en OKLab y L más baja, CAM16 corre
el tono hacia violeta: barrido a L−0,15: Azul Marino +4,6°, Azul Profundo +2,5°, ultramar de prueba
+6,7° (término de tono ΔE hasta 6,1). En las 9 paredes la sombra es menos profunda: máx 2,95°.

**MENOR — margen de gama en luz lineal** (`oklab.ts:113`, nuevo). 0,5/255 *lineal* son 6,5 niveles sRGB
cerca del negro: un oscuro saturado que se sale por poco no pasa por la búsqueda de croma y se recorta
canal por canal. Barrido: Rojo Teja ΔE 2,5, Borravino 2,1, Verde Inglés 1,7; en las paredes ≤ 0,13 %
de los píxeles, máx 1,16. Arreglo: piso `−0,5/255/12,92`.

**MENOR — el aro del borde muestra la pared vieja** (`photo-simulator.tsx:292`, radio 2, nuevo). Los
2 px de adentro llevan 40 % y 20 % de foto: ΔE contra la muestra 14-33 (d1) y 7-17 (d2); es el 1-2 %
de lo pintado en las sintéticas y 7,7-9,2 % en r09/r08 (rodea cuadros y plantas). Con radio 1, d2
baja a ≤ 4,9 (d1 igual). Que lo valide `simulador-color` (serrucho).

**Lo que queda después de los arreglos: el ancla en percentil** (decisión conocida). Los 66 casos >2 con
el modelo recomendado son claros en paredes desparejas (ventana, r08, r09; Blanco Puro 4,8 en r09).
Pendiente del percentil 35 en vez de 70: ventana máx 3,97→1,66, pero la mitad clara de los blancos
pierde textura (0,50-0,57→0,27-0,48) y el recorte a 255 sube de 7,8 a 21,7 %. Lo decide el dueño.

**Descartado (medido):** degradés (4 rampas × 48): ningún salto >1 nivel ni inversión; paredes: 0
inversiones en 293 M pares al 100 %. Muestreo del ancla: ΔL ≤ 0,004 (ΔE ≤ 0,35), aun en 40×40 px.
Superposición azul: ΔE ≥ 7,2 de toda la paleta. Recortes: sólo blancos en luces (≤ 8,5 %).

## Modelos de croma (medido, 432 casos al 100 %)

| modelo | ΔE mediano p50/p90/máx | >2 | blanca máx | C rel. luces/sombras | C/L rel. luces/sombras | tono CAM16 máx luces/sombras | textura |
|---|---|---|---|---|---|---|---|
| (a) actual | 0,94 / 2,84 / 4,85 | 83 | 2,22 | 0,94 / 0,95 | 0,85 / 1,01 | 6,8° / 3,0° | 0,60 |
| (b) `nc = tc` | 0,50 / 2,64 / 4,84 | 64 | 0,45 | 1,00 / 1,00 | 0,96 / 1,05 | 1,6° / 1,9° | 0,60 |
| (c) `nc = tc·nl/tl` | 0,49 / 2,65 / 4,83 | 66 | 0,43 | 1,04 / 0,95 | **1,00 / 1,00** | **0,95° / 1,3°** | 0,60 |
| (d) (c) sólo en sombras | 0,49 / 2,65 / 4,83 | 66 | 0,43 | 1,00 / 0,95 | 0,96 / 1,00 | 1,6° / 1,3° | 0,60 |

**Recomiendo (c) + Intensidad 100 % + el piso de gama.** (c) es lo que hace la luz (escala L, a y b
juntos): saturación relativa 1,00 en luces y sombras, tono estable en azules (barrido: Azul Marino
−2,2°, los demás ≤ 1,6°, contra 2,5-6,7° de (a)/(b)), y saca a los oscuros saturados de la zona
fuera de gama (colores con ΔE > 0,5 por el margen: 13→4). Pierde: en las luces el croma sube 4 %
(lo físico); 66 casos >2 contra 64 de (b), todos por el ancla. En la mediana (b) y (c) empatan.
Predicción (réplica): `simulador-color-fiel` pasa los 5 casos (≤ 0,61); la textura de
`simulador-calidad` baja de 0,63 a 0,59-0,60 al 100 % (dentro de ±0,06, cerca del piso: conviene
recentrar `TEXTURA_OBJETIVO` en 0,60).

## Por color (ΔE2000 del color mediano)

| Color | blanca 90 % | roja 90 % | blanca 100 % | mediana 9 paredes 100 % | peor 100 % (dónde) | blanca prop. | mediana 9 prop. | peor prop. |
|---|---|---|---|---|---|---|---|---|
| Blanco Puro #FAFAF7 | 0,9 | 8,5 | 0,6 | 1,3 | 4,9 (r09) | 0,4 | 1,0 | 4,8 (r09) |
| Marfil #F1E9D2 | 2,6 | 8,3 | 2,2 | 2,3 | 4,6 (r09) | 0,4 | 0,9 | 4,3 (r09) |
| Arena #D8C6A3 | 2,6 | 6,6 | 1,7 | 1,7 | 3,7 (r09) | 0,2 | 0,8 | 3,5 (r09) |
| Gris Perla #C9C9C4 | 0,7 | 8,1 | 0,6 | 0,9 | 3,6 (r09) | 0,2 | 0,7 | 3,6 (r09) |
| Verde Agua #A8C7BB | 2,4 | 8,5 | 1,3 | 1,4 | 3,5 (r09) | 0,3 | 0,5 | 3,2 (r09) |
| Celeste Cielo #A9C6DC | 2,3 | 8,4 | 1,3 | 1,4 | 3,5 (r09) | 0,3 | 0,5 | 3,4 (r09) |
| Terracota #B5623F | 4,3 | 1,7 | 0,2 | 0,2 | 0,9 (r09) | 0,0 | 0,2 | 0,9 (ventana) |
| Ocre Toscana #C68A3E | 3,6 | 3,8 | 1,0 | 1,0 | 2,2 (r09) | 0,3 | 0,3 | 2,2 (r09) |
| Gris Cemento #8A8A86 | 2,8 | 7,6 | 0,0 | 0,4 | 1,4 (r09) | 0,0 | 0,4 | 1,4 (r09) |
| Verde Inglés #2F5D50 | 5,0 | 5,7 | 0,0 | 0,0 | 0,7 (r08) | 0,0 | 0,3 | 0,6 (r08) |
| Azul Profundo #28415F | 5,2 | 5,7 | 0,3 | 0,4 | 1,0 (r08) | 0,0 | 0,3 | 1,1 (r08) |
| Negro Mate #1C1C1A | 5,4 | 7,7 | 0,3 | 0,6 | 1,6 (r08) | 0,3 | 0,6 | 1,6 (r08) |
| Pure White #EDECE6 | 1,1 | 8,3 | 1,1 | 1,4 | 4,4 (r09) | 0,4 | 1,1 | 4,4 (r09) |
| Agreeable Gray #D1CBBF | 1,1 | 7,6 | 0,9 | 1,2 | 3,7 (r09) | 0,2 | 0,7 | 3,6 (r09) |
| Sea Salt #CBD3C7 | 1,6 | 9,4 | 1,1 | 1,3 | 3,9 (r09) | 0,2 | 0,7 | 3,7 (r09) |
| Naval #2C3B4D | 5,4 | 7,0 | 0,4 | 0,5 | 1,3 (r08) | 0,0 | 0,3 | 1,3 (r08) |
| Tricorn Black #2A2A2C | 5,5 | 7,1 | 0,3 | 0,3 | 1,6 (r08) | 0,3 | 0,3 | 1,6 (r08) |
| Accessible Beige #D2C4AC | 2,0 | 7,0 | 1,5 | 1,5 | 3,5 (r09) | 0,3 | 0,7 | 3,4 (r09) |
| Rosemary #5C6453 | 4,7 | 7,8 | 0,0 | 0,0 | 0,4 (r08) | 0,0 | 0,0 | 0,3 (r08) |
| Cyberspace #4A4F54 | 4,9 | 7,7 | 0,0 | 0,3 | 0,7 (r08) | 0,0 | 0,3 | 0,7 (r08) |
| Roycroft Copper #9C5B3F | 4,6 | 1,7 | 0,0 | 0,0 | 0,4 (r09) | 0,0 | 0,0 | 0,4 (ventana) |
| Iron Ore #3B3A36 | 5,0 | 7,3 | 0,0 | 0,3 | 1,3 (r08) | 0,0 | 0,3 | 1,3 (r08) |
| Repose Gray #C9C5BC | 1,0 | 7,7 | 0,7 | 0,9 | 3,4 (r09) | 0,3 | 0,8 | 3,4 (r09) |
| Alabaster #EDEAE0 | 1,4 | 8,3 | 1,3 | 1,6 | 4,5 (r09) | 0,4 | 1,1 | 4,5 (r09) |
| Blanco #F7F6F1 | 0,9 | 8,3 | 1,1 | 1,3 | 4,7 (r09) | 0,4 | 1,0 | 4,7 (r09) |
| Lino #E5DAC4 | 2,3 | 7,5 | 1,8 | 2,0 | 4,3 (r09) | 0,2 | 0,9 | 4,1 (r09) |
| Durazno #EBC2A0 | 3,3 | 4,8 | 2,2 | 2,1 | 3,9 (r09) | 0,2 | 0,7 | 3,7 (r09) |
| Verde Manzana #9FB86B | 3,0 | 5,9 | 1,3 | 1,4 | 2,9 (r09) | 0,3 | 0,6 | 2,8 (r09) |
| Gris Topo #9A9387 | 2,4 | 7,0 | 0,1 | 0,4 | 1,8 (r09) | 0,3 | 0,3 | 2,0 (r09) |
| Celeste #9EC1D4 | 2,3 | 7,8 | 1,1 | 1,2 | 3,2 (r09) | 0,3 | 0,6 | 3,2 (r09) |
| Tierra Siena #A85E3C | 4,6 | 1,8 | 0,1 | 0,2 | 0,5 (r09) | 0,0 | 0,1 | 0,5 (r09) |
| Amarillo Colonial #D9A441 | 4,0 | 4,9 | 1,8 | 1,9 | 3,1 (r09) | 0,3 | 0,6 | 2,9 (r09) |
| Gris Grafito #54534F | 4,7 | 7,1 | 0,0 | 0,0 | 0,7 (r08) | 0,0 | 0,0 | 0,7 (r08) |
| Verde Patagonia #37574A | 5,0 | 6,4 | 0,0 | 0,1 | 0,7 (r08) | 0,0 | 0,3 | 0,7 (r08) |
| Borravino #6E2F33 | 5,3 | 1,7 | 0,3 | 0,3 | 1,0 (r08) | 0,0 | 0,3 | 0,9 (r08) |
| Negro #201F1D | 5,4 | 7,3 | 0,3 | 0,6 | 1,6 (r08) | 0,3 | 0,6 | 1,6 (r08) |
| Blanco Mate #F5F4EF | 0,8 | 8,3 | 1,1 | 1,2 | 4,8 (r09) | 0,4 | 1,0 | 4,7 (r09) |
| Hueso #E9E1CF | 2,0 | 7,8 | 1,6 | 1,8 | 4,4 (r09) | 0,4 | 0,9 | 4,2 (r09) |
| Beige Pampa #D6C4A0 | 2,6 | 6,6 | 1,7 | 1,7 | 3,7 (r09) | 0,3 | 0,7 | 3,4 (r09) |
| Gris Plata #BFBFBA | 0,9 | 8,1 | 0,6 | 0,7 | 3,2 (r09) | 0,3 | 0,5 | 3,2 (r09) |
| Verde Salvia #8FA585 | 2,4 | 7,1 | 0,7 | 0,8 | 2,4 (r09) | 0,3 | 0,3 | 2,2 (r09) |
| Celeste Sereno #A7C3D2 | 2,1 | 8,2 | 1,2 | 1,3 | 3,2 (r09) | 0,3 | 0,5 | 3,2 (r09) |
| Rojo Teja #A24B33 | 5,0 | 1,0 | 0,0 | 0,0 | 0,3 (r09) | 0,0 | 0,0 | 0,2 (r09) |
| Terracota Sol #BC6E45 | 3,9 | 2,3 | 0,3 | 0,4 | 1,4 (r09) | 0,0 | 0,4 | 1,4 (r09) |
| Gris Membrana #6B6A66 | 4,3 | 7,1 | 0,0 | 0,0 | 0,4 (ventana) | 0,0 | 0,0 | 0,4 (ventana) |
| Verde Bosque #33503F | 5,1 | 6,5 | 0,1 | 0,3 | 1,0 (r08) | 0,0 | 0,3 | 1,0 (r08) |
| Azul Marino #27374D | 5,4 | 6,5 | 0,4 | 0,5 | 1,3 (r08) | 0,0 | 0,4 | 1,3 (r08) |
| Grafito #2B2B29 | 5,2 | 7,4 | 0,0 | 0,3 | 1,6 (r08) | 0,3 | 0,3 | 1,6 (r08) |

"prop." = modelo (c) al 100 %. Peores de "prop." = ancla en paredes desparejas, no croma.

Nota: un `pip download` mío dejó dos `.whl` en la raíz del repo; los borró el orquestador.
