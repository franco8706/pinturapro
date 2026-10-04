# Simulador de color: ronda `2026-10-03-simulador`

Medido contra **producción en :3100**, compu 1440 px, Chrome **152.0.7977.82** (vale para todos los
números de píxeles de este reporte), kit `tools/auditoria/navegador.cjs`. Lectura con `getImageData`
(píxel pintado = Δ RGB > 12). 0 usos de `🤖 IA`, ningún dato creado en la base, ningún archivo del
proyecto tocado salvo este.

- La línea de base sintética se midió sobre la compilación de `16919a7`.
- Después del reinicio del Codespace (~07:17 UTC), :3100 volvió compilado desde `08737d4`. Ese commit sólo
  agrega `packages/color/src/pintura.ts`, que no usa nadie. Varita, OKLab, componente y worker no cambian.
- Control en la compilación nueva, foto 01: idéntico (82,2 / 99,3 / moldura 4,52 % y 2,55 %).
- Scripts, datos y capturas: `tools/auditoria/.salida/simulador-color/` (fuera de git). Las capturas de
  las sintéticas se perdieron con `/tmp`; lo que se vio está escrito abajo.

## 1. Línea de base, fotos sintéticas

Clic en (0,22; 0,35), una carga de página por valor de Sensibilidad (fijada antes del clic). Recall /
precisión / IoU en %, contra `-pared.json` (grilla 120×80, método de `simulador-calidad`).

| Foto | S=15 | **S=26** | S=40 | S=55 | Referencia |
|---|---|---|---|---|---|
| 01 living con luz | 73,5 / 99,6 / 73,3 | **82,2 / 99,3 / 81,7** | 84,2 / 83,8 / 72,4 | 84,5 / 83,6 / 72,5 | 83 / 98 |
| 02 pared plana | 77,9 / 100 / 77,9 | **77,9 / 100 / 77,9** | igual | igual | "igual que antes" |
| 03 pared oscura | 84,0 / 100 / 84,0 | **84,1 / 100 / 84,1** | 84,2 / 99,9 / 84,1 | igual | 85 |

En la 01, de S=26 a S=40 la fuga al techo salta de 0,05 % a **8,7 % de la foto**: un escalón entre los
dos valores, no una pendiente.

**Textura conservada** (desvío de OKLab L adentro de lo pintado / el de la foto, erosión 4 px). Se mide
sobre la zona que pintó Azul Profundo, la misma para todos los colores. Con la zona propia de cada color
(método de la prueba) cambia como mucho 0,003.

| Foto | Blanco Puro | Marfil | Celeste Cielo | Terracota | Verde Inglés | Negro Mate | Dispersión |
|---|---|---|---|---|---|---|---|
| 01 | 0,631 | 0,637 | 0,638 | 0,637 | 0,636 | 0,630 | 0,008 |
| 02 | 0,642 | 0,640 | 0,646 | 0,646 | 0,643 | 0,657 | 0,017 |
| 03 | 0,633 | 0,638 | 0,638 | 0,639 | 0,637 | 0,629 | 0,010 |

Referencia 0,63 con cualquier color: se cumple. La 02, de revoque casi liso, da algo más alto con todos
los colores por igual: ahí el redondeo a 8 bits pesa sobre un desvío muy chico.

**Moldura** (01, S=26): **4,52 %** (543/12 006) con la franja de la prueba y **2,55 %** con la de la
sonda del 19/9. Filo 1-2 px adentro: 0 (18/18 bordes). En 02 y 03: 0,00 %.

### La moldura no subió de 2,5 a 4,5 %: son dos franjas distintas sobre la MISMA pintura

- **Chrome no cambió.** `/var/log/dpkg.log` tiene una sola instalación de `google-chrome-stable
  152.0.7977.82-1`, el **8/9 05:31**, y ninguna actualización. El 19/9 se midió con este mismo Chrome:
  la hipótesis queda **descartada**.
- **Las fotos tampoco cambiaron.** Regenerar `generar.py` en otra carpeta da los JPG idénticos byte a byte.
- **Cambió la franja.** La sonda `historico/primera-auditoria/bordes.cjs` contaba x∈[60,82), y∈[140,700).
  `regresiones/sangrado-moldura.prueba.cjs` cuenta x∈[60,82], y∈[102,623].
- **Perfil columna por columna.** La moldura real es x=61..81 (base 239,238,233) y tiene **0 píxeles
  pintados en x=62..81** (9 en x=61). Lo pintado son las dos columnas de transición del reescalado
  1200→1024: x=60 (54 % de las filas) y x=82 (56 %). Son medio pared y medio moldura. La prueba cuenta
  las dos; la sonda no contaba la x=82.
- Con el bug reintroducido pasó lo mismo: la prueba dio 19,7 % y la sonda 16,8 %. La prueba nunca
  registró 2,5 % (`verificar.log` dice 4,5 %).
- **Qué hacer:** la referencia de la prueba es 4,5 %. El ítem abierto "La moldura manchada mide 4,5 %"
  de la BITÁCORA pasa a **descartado**. El comentario de `sangrado-moldura.prueba.cjs` ("ahora 2,5%" y "hoy da ~2.5%",
  líneas 9 y 30) debería decir 4,5 %.

## 2. Fotos reales (18): un toque de Azul Profundo con Sensibilidad 26

Puntos y zonas en `tools/auditoria/.salida/simulador-color/reales.json`, en fracciones del lienzo, para
repetir exactamente lo mismo. Cada foto tiene zonas "seguro pared" y "seguro no pared" dibujadas
mirándola con una grilla.
- **Pared**: % de la zona "seguro pared" cubierta.
- **Fugas**: zonas que no son pared y quedaron pintadas.
- **Arco**: píxeles pintados pegados al círculo del tope de radio (>0 = el tope cortó).
- **Toques**: cuántos hacen falta para llegar al 90 % de la pared con S=26. Cada toque nuevo va al
  centro del pedazo de pared sin pintar más grande, sin deshacer.
- Capturas en `.salida/simulador-color/reales/<foto>.png` (y `-s40`, `-toques`), todas miradas.

| Foto · punto | Foto pintada | Pared (1 toque) | Fugas vistas | Aviso | Arco | S=40: pared · fugas nuevas | Toques al 90 % |
|---|---|---|---|---|---|---|---|
| r01 · .32;.36 | 20,7 % | 90,5 % | ninguna | no | 0 | 95,1 % · — | 1 |
| r02 · .48;.25 | 58,4 % | 98,2 % | ninguna (la "lámpara 32 %" es pared dentro de mi zona) | no | 467 | 98,2 % · — | 1 |
| r03 · .44;.22 | 24,6 % | 99,4 % | **techo 100 %, alacenas de la cocina 80 %**, pared del otro cuarto 17 % | no | 0 | 99,6 % · + pared del fondo 61 %, mueble 65 % | 1 (con fugas) |
| r04 · .33;.22 | 18,0 % | 88,8 % | ninguna | no | 0 | **99,0 %** · — | 2 |
| r05 · .30;.20 | 37,4 % | 86,7 % | ninguna | no | **593** (arco visible a la derecha) | 86,8 % · — | 2 |
| r06 · .33;.40 | 24,7 % | 89,8 % | ninguna (el "sillón 14 %" es pared de mi zona; el sillón amarillo está intacto) | no | 0 | 94,4 % · **pared blanca de al lado 100 %** | 2 |
| r07 · .17;.27 | 35,5 % | 100 % | **techo 74 %**, la otra pared 21 % | no | **775** (arco visible) | 100 % · + cama 70 % | 1 (con fugas) |
| r08 · .40;.18 | 21,7 % | 100 % | ninguna | no | 0 | 100 % · — | 1 |
| r09 · .12;.30 | 13,3 % | 94,1 % | ninguna | no | 18 | 98,0 % · — | 1 |
| r10 · .35;.15 | 29,8 % | **77,8 %** | ninguna; la mancha de sol corta la pared en diagonal | no | 142 | 85,2 % · — | 2 |
| r11 · .25;.40 | 75,6 % | 86,5 % | **escritorio blanco 75 %**, pantalla de la lámpara y maceta blancas | no | **1265** (arco grande visible) | 86,6 % · — | 2 (escritorio 94 %) |
| r12 · .26;.40 | 30,5 % | 87,9 % | ninguna (el techo blanco NO se pinta) | no | 0 | 94,7 % · — | 2 |
| r13 · .82;.30 | 49,9 % | 99,0 % | **techo 100 %, pared izquierda 99 %, marco de ventana 70 %** | no | 252 | 99,0 % · cama 8 % | 1 (con fugas) |
| f01 · .32;.44 | 0 % | **0 %** | — | **sí** | 0 | 23,4 % · — | no llega (43 % con 8 toques; 4 dan aviso) |
| f02 · .655;.52 | 1,4 % | 21,6 % | marco de la ventana | no | 0 | 71,6 % · camino 7 % | no llega (60 % con 8) |
| f03 · .30;.69 | 0,7 % | 13,1 % | marco de la ventana 9 % | no | 0 | 15,9 % · — | no llega (50 % con 8) |
| f04 · .36;.42 | 0 % | **0 %** | — | **sí** (también con S=40) | 0 | 0 % · aviso | no llega (10 % con 8; 7 dan aviso) |
| f05 · .53;.55 | 2,4 % | 53,1 % | ninguna | no | 0 | 55,5 % · — | no llega (65 % con 8) |

Resumen. **Interiores (13):**
- 9 de 13 agarran ≥ 86 % de la pared con un toque y sin fugas visibles.
- 3 pintan además **todo el techo** (r03, r07, r13). Una pinta el escritorio y otros objetos blancos (r11).
- A 1-2 toques del 90 % en todos.

**Fachadas (5):** ninguna llega al 80 % ni con 8 toques. En 2 de 5, el primer toque sólo trae el aviso.

## 3. Congelamiento del primer clic (`congelamiento.cjs`, :3100, CPU ×4)

Referencia: tarea larga 319-339 ms, color visible a los 413-425 ms.

| Corrida | Carga del Codespace | Tarea larga (ms) | Color visible (ms) |
|---|---|---|---|
| 07:39 UTC | 5-6 en 4 núcleos (otro agente: `analizar.mjs` al 87 %) | 438 · 627 · 524 | 590 · 815 · 728 |
| 07:42 UTC | dos `analizar.mjs` al 90-100 % | 718 · 1061 · 621 | 915 · 1293 · 860 |

**Ninguna de las dos se puede comparar con la referencia**: el número crece justo con la carga ajena.
El código del worker es el mismo que midió la referencia (`varita.worker.ts` sin cambios desde
`d170d05`). La medición con el procesador libre está en la sección 7.

## 4. Hallazgos

**IMPORTANTE: en un ambiente blanco o gris, un toque en la pared pinta también el techo entero.**
- Medido en 3 de 13 interiores con la Sensibilidad por defecto: r03 (techo 100 % + alacenas 80 %), r07
  (techo 74 %), r13 (techo 100 % + la otra pared 99 % + marco de la ventana 70 %). Visto en las capturas
  `reales/r03.png`, `r07.png` y `r13.png`: la habitación entera queda azul.
- No aparece ningún aviso. La única salida es borrar el techo con el pincel.
- Es exactamente el error que el dueño no quiere ver al aplicar un color.
- En r11 pasa lo mismo con el escritorio blanco (75 %), la lámpara y la maceta.

**IMPORTANTE: la pintura termina en un arco de círculo en medio de la pared.**
- Es el tope `maxRadius` = media diagonal desde el clic (`packages/color/src/magic-wand.ts:256`).
- En la sintética 02 deja afuera el 22 % de una pared lisa con **cualquier** Sensibilidad.
- En las reales cortó en 7 de 13 interiores. El arco se ve claramente en r05, r07 y r11 (r11: 1.265 px
  pintados sobre el círculo, con la pared lisa siguiendo del otro lado).
- No parece "agarró de menos": parece roto. Subir la Sensibilidad no ayuda, y nada le dice a la persona
  que toque otra vez del otro lado.

**IMPORTANTE: la varita no sirve en fachadas reales.**
- Tejuelas (f01), troncos (f02), revestimiento de madera (f03), ladrillo (f04), tablas (f05).
- f01 y f04: el primer toque devuelve el aviso. f04 también con S=40, y 7 de sus 8 toques dan aviso.
- f02, f03 y f05 cubren el 13-53 % de la pared.
- El aviso pide "tocá una zona más lisa de la pared, o subí la Sensibilidad". En una fachada de ladrillo
  no hay zona más lisa, y subir la Sensibilidad no alcanza. El texto promete "pared, frente o fachada"
  (`photo-simulator.tsx:950`).

**MENOR: bordes escalonados ("serrucho") donde la luz cambia el tono de la pared.**
- r01 junto a las ventanas, r04 y r12 del lado de la luz, r06 abajo. El borde baja en escalones de
  ~8-16 px.
- Deducido, no medido aislado: es el freno de croma contra el color del clic cortando un degradé de tinte
  sobre la croma del JPEG, que viene submuestreada y en bloques.
- S=40 lo resuelve en r04 (88,8 → 99,0 %) y r12 (87,9 → 94,7 %), pero en r06 se pasa a la pared blanca
  de al lado (100 %).

**MENOR: una foto cuadrada o vertical no entra en el recuadro del lienzo en la compu.** El recuadro mide
628 px de alto (70vh). El lienzo mide 775 px en r06, 878 px en r09 y **1.316 px en r13**. Para ver o tocar
la parte de abajo hay que desplazarse dentro del recuadro. De paso, `locator('canvas').screenshot` captura
la interfaz que tapa el lienzo: para el kit conviene `canvas.toDataURL()`.

**Funciona bien:**
- Paredes de color con contraste (r08 verde: 100 %, cuadros y ciervos intactos; r09 negra: 94 %).
- La textura con cualquier color.
- El filo sobre la moldura.
- Ningún error de JavaScript ni de red en las 18 fotos.

## 5. Qué tienen en común las fotos donde anda mal (tarea 4, con números)

Rasgos calculados con las mismas fórmulas de `magic-wand.ts` (S=26) sobre cada foto reescalada a 1024.
El reescalado es el de PIL, así que los números son aproximados (`.salida/simulador-color/datos/rasgos.json`).

1. **Fuga al techo: pared y techo del mismo color, unidos por una sombra suave y sin línea.**
   - Entre la pared y la superficie invadida: ΔY ≤ 22 y Δcroma ≤ 2,0 (r03: 22 / 1,2; r07: 2 / 0,7;
     r13: 4 / 0,9; escritorio de r11: 13 / 2,0).
   - Entre el 92 y el 100 % de los píxeles de esa superficie pasan la correa y la croma. El único freno
     que queda es el de borde, y una esquina sombreada no lo dispara.
   - El contraejemplo es r12: techo blanco con ΔY 1 / Δcroma 1,4 (100 % pasa) y **ninguna fuga**,
     porque hay una línea nítida entre pared y techo.
   - El color no puede separar un cuarto blanco: depende de que exista una línea.
   - Las paredes oscuras nunca se fugaron (r08 con Y=68, r09 con Y=43).
2. **Cobertura corta en interiores: luz que tiñe la pared, o el tope de radio.**
   - El freno de croma (contra el clic) bloquea el 19 % de la pared en r10 (sol directo, además de
     correa 15 %), 12 % en r12 (luz cálida de la ventana), 9 % en r06 y r01 y 8 % en r04.
   - En las que no fallan está entre 0 y 5 %.
   - Por eso S=40 (croma 7,4 → 9,8) las recupera.
   - Donde corta el radio (r05, r11, r10), la Sensibilidad no cambia nada (r05: 86,7 → 86,8 %).
3. **Fachadas: textura fina del material.**
   - Desvío de Y − Ys (grano a escala de pocos píxeles): 8-14 en fachadas contra 0,3-2,4 en interiores.
   - Gradiente mediano sobre la pared: 24-61 contra 1-12.
   - El freno de paso local (1,2-5 sobre la luma suavizada 5×5) corta el 19-48 % de los pares de vecinos
     de la pared (interiores ≤ 3 %). La croma, el 6-53 %.
   - El algoritmo está hecho para revoque pintado liso y no puede seguir tejuelas, troncos ni ladrillo.
   - Además la pared ocupa poco: 1-4,6 % de la foto.
4. **El tamaño de la pared no explica nada por sí solo:** r03 (3,3 % de la foto) dio 99 %; r10 (33 %) dio 78 %.
5. **El umbral de borde por percentil se vuelve muy bajo en fotos minimalistas** (deducido, sin efecto
   medido acá): edgeTol=19 en r11, contra 88-160 en las demás. El 6,5 % de los píxeles de la pared lisa
   ya frena como "borde".

## 6. Qué mejoró y qué empeoró respecto de la referencia

- **Sin cambios:**
  - recall/precisión de la 01 (82,2 / 99,3, igual que el 2/10);
  - textura (0,630-0,638 en la 01, dispersión 0,008);
  - filo de la moldura (0).
- **La moldura "4,5 %" no es una regresión.** Es la misma pintura que el 19/9, medida con otra franja (sección 1).
- **Nuevo, porque nunca se había medido:** el comportamiento en fotos reales. Ninguna de las tres fallas
  importantes viene de un cambio reciente: el algoritmo de la varita no se toca desde `c0c362a` (19/9).
  Las sintéticas no tienen techo del mismo color, ni pared que cruce toda la foto, ni materiales con textura.

## 7. Congelamiento con el procesador libre

(pendiente: corre en segundo plano y arranca cuando no queden procesos de otro agente y la carga baje
de 1,5; registro en `tools/auditoria/.salida/simulador-color/datos/congelamiento.log`)
