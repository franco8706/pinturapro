# Simulador de color: segunda pasada (después de los arreglos) · ronda `2026-10-03-simulador`

Estado: COMPLETO salvo el perfil de CPU propio de la sección 5 (ver ahí). Medido el 4/10 entre las 02:55 y las 04:00 UTC.

Medido contra **producción en :3100, compilada del commit `2d75c7a`** (verificado: el worktree de `/tmp/pinturapro-produccion`
está en `2d75c7a`, el JS de `/simulador` trae «Otra pared, otro color» y «Quitar la zona», y `magic-wand.ts` y
`photo-simulator.tsx` del árbol de trabajo son idénticos a los de ese commit). Compu 1440 px, Chrome **152.0.7977.82** (el
mismo de la primera pasada), kit `tools/auditoria/navegador.cjs`. Lectura con `getImageData` (píxel pintado = Δ RGB > 12). 0 usos
de `🤖 IA`, ningún dato creado en la base, ningún archivo del proyecto tocado salvo este.
Scripts, datos y capturas: `tools/auditoria/.salida/simulador-color/despues/` (fuera de git). Los números de la primera pasada
quedan en `.../datos/reales-resultado-antes.json` y en `simulador-color.md`, sin pisar.

## Resumen: métricas contra las referencias

| Métrica | Referencia (primera pasada) | Ahora | |
|---|---|---|---|
| Sintética 01, S=26: recall / precisión | 82,2 / 99,3 % | **94,8 / 99,3 %** | mejoró |
| Sintéticas 02 / 03, S=26: recall / precisión | 77,9 / 100 · 84,1 / 100 % | **100 / 99,5 · 100 / 99,1 %** | mejoró (precisión −0,5 / −0,9) |
| Escalón S=26 → S=40 en la 01 (techo pintado) | 0,05 → 8,7 % de la foto | 0,4 → 98,7 % del techo (~11 % de la foto) | **peor** |
| Textura con 6 colores | 0,63 · dispersión 0,008-0,017 | 0,59-0,60 · dispersión 0,008-0,027 | el nivel baja 0,04 por la Intensidad 100 %; no depende del color |
| Moldura manchada (franja de la prueba) · filo | 4,52 % · 0 | 4,56 % · 0 (18/18) | igual |
| Primer clic: tarea larga · color visible (CPU ×4) | 319-339 · 413-425 ms | 292-334 · 387-452 ms | igual |
| 13 interiores sin fugas grandes (un toque, S=26) · de ellos, con ≥ 86 % de pared | 9 · 8 | 9 · 7 (r04 baja a 84,1 %) | igual / peor |
| Techo pintado con un toque: r03 / r07 / r13 | 100 / 74 / 100 % | **0** / **90** / 100 % | r03 arreglado, r07 peor |
| Fachadas con ⬠ Contorno, 4-7 toques | — | 99-100 % de lo marcado, derrame ≤ 2 px | nuevo |
| Quitar el techo con Contorno (r07 / r13) | — | 90 → 0 % / 100 → 0 %, en 10 / 8 toques | nuevo |

## 1. Las 18 fotos reales: Azul Profundo, Sensibilidad 26, un toque (los mismos puntos y zonas de `reales.json`)

- **Pared** = % de la zona «seguro pared» cubierta. **Fugas** = lo que se ve pintado y no es pared, mirando cada captura
  (`despues/capturas/<foto>.png`, todas miradas); entre paréntesis el % de mi zona de «fuga» pintada.
- **Toques al 90 %** = cuántos toques hacen falta (cada uno al centro del pedazo de pared sin pintar más grande, sin deshacer).
- Lo nuevo respecto de la primera pasada: la columna «Arco» desaparece. Sin tope de radio ya no hay arco; el contador de
  píxeles sobre el círculo da > 0 en 6 fotos (r02, r05, r07, r10, r11, r13) sólo porque la pared lo cruza (lo miré en las capturas: ninguna tiene arco).
- Ninguna foto dio error de JavaScript, de consola ni de red.

| Foto · punto | Foto pintada | Pared (antes → después) | Fugas vistas (antes → después) | Aviso | Toques al 90 % |
|---|---|---|---|---|---|
| r01 · .32;.36 | 20,7 → 21,1 % | 90,5 → 90,5 % | ninguna → ninguna (serrucho junto a las ventanas, igual) | no | 1 → 1 |
| r02 · .48;.25 | 58,4 → 59,8 % | 98,2 → **99,8 %** mejoró | una franja azul de ~10 px sobre la tapa de la cómoda y la base del portarretrato (`despues/capturas/r02-recorte.png`; no la anoté en la primera pasada); la «lámpara 41 %» es pared dentro de mi zona | no | 1 → 1 |
| r03 · .44;.22 | 24,6 → 11,9 % | 99,4 → 99,5 % | **techo 100 → 0 %**, pared del otro cuarto 17 → 0 % mejoró; **alacenas 80 → 53 %** (queda un panel azul sobre las alacenas) | no | 1 → 1 |
| r04 · .33;.22 | 18,0 → 17,1 % | 88,8 → **84,1 %** EMPEORÓ | ninguna → ninguna | no | 2 → 2 |
| r05 · .30;.20 | 37,4 → 40,6 % | 86,7 → **97,1 %** mejoró (sin arco) | ninguna → ninguna | no | 2 → **1** |
| r06 · .33;.40 | 24,7 → 25,7 % | 89,8 → 90,0 % | ninguna → ninguna (el sillón amarillo está intacto) | no | 2 → 2 |
| r07 · .17;.27 | 35,5 → **46,9 %** | 100 → 98,5 % | **techo 74 → 90 %, pared de la ventana 21 → 92 %**, pantalla de la lámpara: toda la pieza azul. EMPEORÓ | no | 1 → 1 (con fugas) |
| r08 · .40;.18 | 21,7 → 22,7 % | 100 → 100 % | ninguna → ninguna | no | 1 → 1 |
| r09 · .12;.30 | 13,3 → 13,1 % | 94,1 → 92,0 % EMPEORÓ leve | ninguna → ninguna | no | 1 → 1 |
| r10 · .35;.15 | 29,8 → 29,5 % | 77,8 → **74,7 %** EMPEORÓ | ninguna → ninguna (la mancha de sol sigue sin pintarse) | no | 2 → **3** |
| r11 · .25;.40 | 75,6 → **90,2 %** | 86,5 → 99,6 % | **escritorio 75 → 96 %**, pantalla de la lámpara y maceta. EMPEORÓ la fuga | no | 2 → 1 (con fugas) |
| r12 · .26;.40 | 30,5 → 27,7 % | 87,9 → 87,9 % | ninguna → ninguna (un filo azul de 2-4 px sobre el costado del mueble) | no | 2 → 2 |
| r13 · .82;.30 | 49,9 → 50,9 % | 99,0 → 99,1 % | **techo 100 → 100 %, pared izquierda 99 → 100 %**, marcos de la ventana 70 → 72 %, respaldo de la silla. Sin cambio | no | 1 → 1 (con fugas) |
| f01 · .32;.44 | 0 → 0 % | 0 → 0 % | — | **sí** → **sí** | no llega: 43 → 66 % con 8 toques (4 dan aviso) |
| f02 · .655;.52 | 1,4 → 1,6 % | 21,6 → 23,6 % | ventana 59 → 67 % | no | no llega: 60 → 66 % con 8 (4 avisos) |
| f03 · .30;.69 | 0,7 → 0,8 % | 13,1 → 13,5 % | marco de la ventana 9 → 12 % | no | no llega: 50 → 56 % con 8 (3 avisos) |
| f04 · .36;.42 | 0 → 0 % | 0 → 0 % | — | **sí** → **sí** | no llega: 10 → 13 % con 8 (7 avisos) |
| f05 · .53;.55 | 2,4 → 2,8 % | 53,1 → **59,3 %** mejoró | ninguna → ninguna | no | no llega: 65 → 71 % con 8 (6 avisos) |

**Lo que mejoró:** r03 (techo 100 → 0 %, el otro cuarto 17 → 0 %, alacenas 80 → 53 %); r05 (sin arco: 86,7 → 97,1 %, un toque
menos); r02 (+1,6); f05 (+6,2) y f01 con S=40 (23,4 → 59,4 %). El aviso ahora dice «Tocá una zona más lisa. Si la pared tiene mucha
textura —ladrillo, piedra, madera—, marcala con ⬠ Contorno» (texto visto en f01 y f04).
**Lo que EMPEORÓ:** r07 (el techo pasa de 74 a 90 % y la pared de al lado de 21 a 92 %: sin el tope de radio ya no hay nada que
corte); r11 (el escritorio blanco de 75 a 96 %: se pinta casi toda la foto, 90,2 %); r04 (−4,7 puntos), r10 (−3,1; un toque más
para llegar al 90 %) y r09 (−2,1), que es el costo medido del freno relativo al grano. En f03 el marco de la ventana pasa de 9 a 12 %.
**Sin cambio:** r13 sigue pintando todo el cuarto; f01 y f04 siguen dando el aviso en el primer toque.

**Con S=40** (columna que la primera pasada también medía): igual que a S=26 salvo r03 (techo 100 → 0 %, mueble 65 → 0 %, pared del fondo 61 → 0 %,
alacenas 88 → 60 %), r05 (86,8 → 97,1 %), r07 (techo 75 → 91 %, pared de al lado 28 → 93 %), r11 (escritorio 76 → 96 %) y f01 (23,4 → 59,4 %). r06 sigue
pintando la pared blanca de al lado al 100 % con S=40.

Resumen. **Interiores (13):** sin fugas grandes 9 → 9 (r01, r02, r04, r05, r06, r08, r09, r10, r12; r02 y r12 con una franja fina sobre un mueble); con ≥ 86 % de pared además, 8 → 7 (r04 baja a 84,1 %; r10 nunca llegó). Pintan el techo entero
3 → 2 (r03 salió; r07 y r13 siguen, r07 peor). Objetos blancos pintados: r11 (escritorio) y r03 (alacenas, a medias).
**Fachadas (5), con mis zonas de siempre:** ninguna llega al 80 % ni con 8 toques; 2 de 5 siguen dando sólo el aviso en el primer toque. Con la pared real el cuadro cambia (sección 2).

**Zonas mal dibujadas (CORRECCIÓN a mi primera pasada).** Al superponer las zonas sobre las fotos
(`despues/capturas/zonas-f0N.png`) y compararlas con el contorno real de la pared: en **f01 el 61 %** de mi «seguro pared»
cae fuera del hastial (el triángulo está corrido ~30 px a la izquierda y cubre tejado), en **f04 el 49 %** y en **f05 el 43 %**
(incluye el fondo del balcón, que no es pared blanca). Por eso en esas tres filas el «% de pared» mezcla pared y tejado: f04
«13 %» con 8 toques es **techo** pintado, no pared. No cambié las zonas para que antes y después sean comparables; la
sección 2 da los números de la varita contra la pared real de f01-f05. Lo que dije en la primera pasada («la varita no sirve en
fachadas») hay que matizarlo: ver abajo.

## 2. Fachadas con ⬠ Contorno (f01-f05)

Qué hice: ⬠ Contorno → «Pintar la zona» → toqué las esquinas de **la pared que había tocado con la varita**, a ojo, mirando
la foto con una grilla (esquinas en `despues/poligonos.json`, dibujadas en `despues/capturas/poligono-f0N.png`) → «Cerrar contorno»
(en f01 cerré tocando la primera esquina: anda). Medido con los píxeles pintados, las zonas de `reales.json` y el contorno exacto
que marqué. Todas dijeron «Zona pintada.», sin errores de consola ni de red. El cierre pinta en ~470-490 ms (pasos de 150 ms de mi lectura).

| Foto · pared marcada | Esquinas + cierre | «Seguro pared» pintada (toda la zona) | Idem, sólo lo que marqué | Se pasa a | Adentro del contorno (por construcción) |
|---|---|---|---|---|---|
| f01 · hastial de tejuela | 3 + tocar la 1ª = 4 toques | 41,7 % | **99,9 %** | nada | ventana y postigos |
| f02 · pared de troncos | 6 + botón = 7 | **98,2 %** | 99,2 % | nada | 5 aberturas (ventana 100 %) |
| f03 · pared del porche | 4 + botón = 5 | **100 %** | 100 % | nada | 2 ventanas, puerta, poste, baranda (ventana 100 %, puerta 100 %) |
| f04 · hastial de piedra + franja sobre los portones | 6 + botón = 7 | 51,5 % | **100 %** | nada | ventana arqueada |
| f05 · pared blanca del volumen lateral | 6 + botón = 7 | 67,7 % | **100 %** | nada (madera del anexo 10,8 % = 1-2 px de borde) | ventana y toldo |

- **Qué % de la zona queda pintado:** dentro de lo que marqué, 99,2-100 % en las cinco. El % de toda la zona baja en f01, f04 y f05
  por mis zonas (ver arriba) y porque hay trozos que son otra pared que no marqué. Por pieza de la zona: f04 triángulo izquierdo 42,3 %
  (el triángulo se sale sobre el tejado), franja sobre los portones 100 %, frontón derecho 0,5 % (no lo marqué); f05 paño grande 76,7 %
  (el resto es el friso del balcón), fondo del balcón 0 %, franja alta 100 %.
- **¿Se pasa a algo?** No. Fuera del contorno quedan 590-890 px por foto, todos pegados al borde: el 75-99 % a ≤ 2 px (el
  difuminado de 1 px y la mezcla del filo). Coincidencia del pintado con el polígono (IoU): 95,0-98,6 %. El polígono sin pintar,
  adentro: 0-4 px. Mirando las capturas (`despues/capturas/contorno-poligonos-f0N.png`): textura de tejuela, troncos, piedra y
  tablas conservada, borde nítido, sin halo sobre cielo, techo o pasto.
- **Lo que sí se pasa es lo que está adentro del contorno:** ventanas, puertas, postes y toldos quedan pintados (un contorno de 4-6
  esquinas no puede dejarlos afuera; hay que descontarlos con «Quitar la zona»). Es lo esperable, pero la persona tiene que saberlo.
- **La precisión del borde es la de quien toca.** En f01 mi arista izquierda quedó 3-5 px adentro del marco blanco y se ve una
  franja de tejuela vieja (`despues/capturas/zoom-f01-borde.png`). La herramienta no tiene forma de ajustar una esquina ya puesta
  (sólo «Borrar última esquina»).

**La varita en las mismas fachadas, contra la pared real** (mi contorno menos las aberturas; reemplaza lo que dije el 3/10):

| Foto | 1 toque S=26 | 1 toque S=40 | 8 toques S=26 | Qué más pinta |
|---|---|---|---|---|
| f01 | 0 % (aviso) | **94,6 %** | 77,0 % | S=40: 13 % de lo pintado cae afuera (tejado). Con 8 toques, 61 % de lo pintado es tejado |
| f02 | 22,9 % | 88,0 % | 76,9 % | S=40 pinta el arbusto de la derecha y un pedazo de camino (se ve en `f02-s40.png`) |
| f03 | 10,0 % | 12,3 % | 42,1 % | nada |
| f04 | 0 % (aviso) | 0 % (aviso) | 0 % | con 8 toques pinta el tejado entre los dos frontones y nunca la piedra |
| f05 | 70,9 % | 76,7 % | 85,0 % | otros paños de la misma pared blanca |

Es decir: en 3 de 5 fachadas (f01, f02, f05) la varita sí agarra la pared con S=40 o con un par de toques; en f03 y f04 no.
Y en f01 y f04 el aviso del primer toque ya manda a ⬠ Contorno.


## 3. Techo de r07 y r13: ⬠ Contorno → «Quitar la zona»

Qué hice: un toque de varita (S=26) pinta el cuarto entero; después ⬠ Contorno → «Quitar la zona» → esquinas del techo → «Cerrar
contorno». Esquinas en `despues/techos.json`, capturas `despues/capturas/quitar-techos-r07-2-sin-techo.png` (y `-r13-`).

| | Toques | Techo pintado (mi zona «techo») | Techo dentro del contorno que quité | Pared perdida |
|---|---|---|---|---|
| r07 | 1 de varita + 2 botones + 6 esquinas + cerrar = 10 | **90 → 0 %** | 93,5 → 0,3 % | 0 (la banda de 6 px de pared pegada al contorno: 98,3 → 98,2 %) |
| r13 | 1 de varita + 2 botones + 4 esquinas + cerrar = 8 | **100 → 0 %** | 100 → 0,9 % | 0 (100 → 100 %) |

- **Queda limpio:** el techo sale entero con 4-6 esquinas, sin franjas de pintura arriba de la arista ni pared comida. Los restos
  son píxeles sueltos del filo (388-403 px adentro de un contorno de 45.000-121.000). Fuera del contorno se perdieron 0-7 px.
  «Deshacer» devuelve el estado anterior exacto (0 píxeles de diferencia).
- Las aristas pared/techo de estas dos fotos casi no se ven (blanco sobre gris): las esquinas las puse mirando la foto con el
  contraste forzado (`despues/capturas/contraste-r07-techo.png`). Una persona las ve apenas, igual que yo sin contraste.
- Lo que el contorno NO toca: la pared de al lado (r07 «pared de la ventana» 92 %, r13 «pared izquierda» 100 %) y los objetos
  (pantalla de la lámpara en r07, respaldo de la silla en r13) siguen pintados; cada uno pide su propio contorno.
- **Trampa de MI script, no del producto (medida):** un clic en el borde exacto del lienzo (x = 100 %) cae afuera del canvas y la
  esquina no se marca (`despues/prueba-borde-lienzo.cjs`: «(1,0) borde derecho exacto → Esquina 1 marcada», o sea, no suma; con
  0,3 % adentro sí). Mi primera corrida de r07 salió con 4 de 6 esquinas, no sacó el techo (93,5 → 89,9 % adentro del contorno) y
  el aviso decía igual «Zona quitada.». Una persona toca adentro y la herramienta pega la esquina al borde (zona de 12 px): eso anda.
  Lo único del producto: al cerrar, el aviso no dice cuántas esquinas tenía el contorno; se ve en el dibujo, que sí las muestra.

## 4. Línea de base sintética (fotos 01, 02, 03)

Mismo método de la primera pasada: clic en (0,22; 0,35), una carga de página por valor de Sensibilidad (fijada antes del clic),
Azul Profundo, grilla 120×80 contra `-pared.json`, píxel pintado = Δ RGB > 12. Intensidad por defecto leída del control: **100 %**
(las tres fotos). Datos: `despues/datos/sinteticas.json`. Recall / precisión / IoU, en %:

| Foto | S=15 | **S=26** | S=40 | S=55 | Antes, S=26 |
|---|---|---|---|---|---|
| 01 living con luz | 84,1 / 99,6 / 83,8 | **94,8 / 99,3 / 94,1** | 99,0 / 83,2 / 82,5 | 100 / 82,9 / 82,9 | 82,2 / 99,3 / 81,7 |
| 02 pared plana | 100 / 99,5 / 99,5 | **100 / 99,5 / 99,5** | 100 / 99,5 / 99,5 | 100 / 99,5 / 99,5 | 77,9 / 100 / 77,9 |
| 03 pared oscura | 100 / 99,3 / 99,3 | **100 / 99,1 / 99,1** | 100 / 99,0 / 99,0 | 100 / 99,0 / 98,9 | 84,1 / 100 / 84,1 |

(Antes, el resto de la fila: 01 S=15 73,5 / 99,6 / 73,3 · S=40 84,2 / 83,8 / 72,4 · S=55 84,5 / 83,6 / 72,5; 02 igual en todas;
03 84,0-84,2 / 99,9-100.)

- **Mejoró:** el recall a S=26 pasa de 82 → 95 % (01), 78 → 100 % (02) y 84 → 100 % (03). La varita ya no deja un arco afuera.
  Mis números en el navegador (94,8 / 100 / 100) están a 0,3-0,8 puntos de los que el orquestador estimó en Node (94,5 / 99,3 / 99,2).
- **Costo:** la precisión baja 0,5 (02) y 0,9 puntos (03), de 100 a 99,5 y 99,1 %: son los 1-2 px de transición que el borde nuevo
  pinta afuera de la máscara de referencia, a lo largo del techo y del zócalo (la moldura es aparte, abajo). Sigue por encima del piso 95 %.
- **Sigue igual, y peor:** el escalón entre S=26 y S=40 en la 01. El techo pintado pasa de **0,4 % a 98,7 %** (antes, 0,05 % → 8,7 % de
  la foto; ahora es el techo entero, ~11 % de la foto) y la precisión cae a 83 %. En la 02 y la 03 no pasa nada hasta S=55. La Sensibilidad por
  defecto (26) está del lado seguro; un movimiento de 14 puntos del control lo cruza.

**Textura conservada** (desvío de OKLab L adentro de la zona pintada / el de la foto; zona = lo que pintó Azul Profundo, erosión 4 px,
la misma para los seis colores; los dos exteriores —Terracota, Verde Inglés— con el selector en «exterior»):

| Foto | Blanco Puro | Marfil | Celeste Cielo | Terracota | Verde Inglés | Negro Mate | Dispersión | Antes (rango · dispersión) |
|---|---|---|---|---|---|---|---|---|
| 01 | 0,590 | 0,596 | 0,598 | 0,597 | 0,596 | 0,592 | **0,008** | 0,630-0,638 · 0,008 |
| 02 | 0,598 | 0,606 | 0,600 | 0,603 | 0,602 | 0,624 | **0,027** | 0,640-0,657 · 0,017 |
| 03 | 0,592 | 0,598 | 0,598 | 0,597 | 0,597 | 0,589 | **0,009** | 0,629-0,639 · 0,010 |

- El nivel bajó de 0,63 a **0,59-0,60**, y es lo que corresponde: la Intensidad por defecto pasó de 90 a 100 %, el 10 % de foto original que
  aportaba textura ya no está, y el motor conserva 0,6 (`CONTRASTE`); el piso nuevo de `simulador-calidad` es 0,60 ± 0,05. La referencia
  «0,63 con cualquier color» hay que actualizarla a **0,60**. Lo que importa —que no dependa del color— se cumple: dispersión 0,008-0,009.
- La 02 (revoque casi liso) tiene la dispersión más alta, 0,027, por Negro Mate (0,624 contra 0,598-0,606 del resto); en la primera pasada
  también fue la peor (0,657 contra 0,640-0,646). Es el redondeo a 8 bits sobre un desvío muy chico, no sensibilidad al tono.

**Moldura y filo** (foto 01, S=26, Azul Profundo):

| | Después | Antes |
|---|---|---|
| Moldura manchada, franja de la prueba (x 60-82, y 102-623) | **4,56 %** (548 / 12.006) | 4,52 % (543) |
| Moldura manchada, franja de la sonda del 19/9 | **2,56 %** (269 / 10.516) | 2,55 % |
| Filo, 1-2 px adentro de la moldura | **0** (18/18 bordes) | 0 (18/18) |
| 02 / 03, franja de la prueba | 0,13 % (16 px) / 0,02 % (2 px) | 0,00 % / 0,00 % |

Perfil columna por columna (% de las filas de la franja con cambio > 12): la moldura real es x = 62..81 y da **0 %** en las veinte
columnas; lo pintado son las dos columnas de transición del reescalado, x = 60 (50 %; antes 54 %) y x = 82 (53 %; antes 56 %), más 2 % en
x = 61 (antes 9 px). No invade hacia afuera: igual que en la primera pasada. Del 4,52 al 4,56 % hay 5 píxeles de diferencia.


## 5. Congelamiento del primer clic (`congelamiento.cjs`, :3100, CPU ×4, `01-living-luz.jpg`)

Referencia anterior: tarea larga **319-339 ms**, color visible **413-425 ms**. Código del worker sin cambios; lo nuevo en el hilo principal
es el borde desmezclado (`alfaDeLaSeleccion`). Esperé a que no hubiera ningún otro Chrome de agentes y la carga (1 min) bajara de 0,9
(esperé 11 min 50 s, y antes otros 10 con un detector mal armado que se contaba a sí mismo: `simulador-uso-real` y `rendimiento` medían a la vez) y muestreé cada segundo cuántos navegadores había
(`despues/datos/congelamiento-despues.log`).

| Tanda | Carga durante la tanda | Navegadores ajenos | Tarea larga (ms) | Hasta ver el color (ms) |
|---|---|---|---|---|
| 1 · 03:44 UTC | 0,85 → 0,87 | ninguno | 292 · 331 · 325 | 387 · 432 · 426 |
| 2 · 03:44 UTC | 1,04 → 2,69 (no había otro Chrome; no sé qué subió la carga) | ninguno | 314 · 302 · 334 | 432 · 389 · 452 |
| `rendimiento` (mismo script, carga 1,36 → 1,22) | | | 319 · 307 · 329 | 427 · 391 · 430 |

**El borde nuevo no movió el número.** Mis seis corridas: tarea larga 292-334 ms (mediana 319), color visible 387-452 ms (mediana 429),
contra 319-339 y 413-425 de la referencia: la diferencia (−10 ms en la tarea, +10 en el color) está dentro del ruido de una corrida a otra
(±30). Las dos medidas de la primera pasada (438-1.061 ms) eran carga ajena, no un cambio del código, como ya había dicho.
(PERFIL_PENDIENTE)

## 6. Desde qué cambio (atribución, medida en Node)

Para no deducirlo, corrí en Node (`despues/atribucion.mjs`, `atribucion-sinteticas.mjs`) la varita de la primera pasada (`08737d4`
sacada de git), la actual y tres variantes de la actual (en `despues/variantes/`), sobre las 18 fotos reducidas con PIL. Aproximado, pero la fila
«antes» **reproduce los números del navegador de la primera pasada** (r07 techo 74 % y pared de al lado 21 %, r11 escritorio 75 %, las tres
sintéticas 73,5 / 82,2 / 84,2…) y la fila «ahora» cae a ≤ 1 punto de lo que mide el navegador en los interiores. S=26, pared % [fugas > 10 %]:

| Foto | antes (08737d4) | ahora | ahora + tope de radio | ahora sin freno de grano |
|---|---|---|---|---|
| r03 | 99 [techo 100, pared del fondo 56, otro cuarto 21, cocina 87] | 99 [cocina 58] | 99 [cocina 58] | 99 [techo 100, fondo 56, otro cuarto 21, cocina 87] |
| r04 | 89 | **84** | 84 | 89 |
| r05 | 87 (arco) | 97 | 87 (arco) | 97 |
| r07 | 100 [techo 74, pared de al lado 21] | 99 [**techo 90, pared de al lado 92**] | 99 [techo 74, al lado 21] | 100 [techo 90, al lado 92] |
| r09 | 94 | **91** | 91 | 94 |
| r10 | 78 | **75** | 75 | 78 |
| r11 | 87 [escritorio 75] | 100 [**escritorio 95**] | 87 [escritorio 73] | 100 [escritorio 95] |
| sintética 01 S=40 | 84,2 / 83,8, techo 78 % | 98,7 / 83,2, techo 98 % | 84,2 / 83,8, techo 78 % | igual que ahora |

- **Quitar el tope de radio (commit `067c6ea`)** explica las mejoras de r05 y de las tres sintéticas (con el tope puesto vuelven a 87 % y
  a 73,5-84,2 %) **y también las fugas nuevas de r07 y r11**: el tope las acotaba por casualidad. Con el tope vuelven 74 / 21 / 75.
  Lo mismo en la sintética 01 a S=40: el escalón al techo existía (78 % del techo con tope), ahora el techo sale entero.
- **El freno relativo al grano (`067c6ea`, `BORDE_LOCAL`)** explica la mejora de r03 (techo 100 → 0 %) **y el costo de 3-5 puntos** de r04, r09 y r10:
  sin el freno esas tres vuelven a 89 / 94 / 78 y r03 vuelve a pintar el techo. No cambia nada en r07, r13 ni r11.
- **El gradiente del marco de la foto (`067c6ea`)**: sin efecto medible en las 18 (la variante sin marco es igual en todas).
- **El borde nuevo (`dc8534c`, `f762aec`)** explica la precisión de las sintéticas 02 y 03 (100 → 99,5 y 99,1 % en el navegador; la varita sola da 100 en Node).
- **La carga con `resizeQuality: "high"` (`89a2a34`)**: en Node la varita no mejora ninguna fachada entre «antes» y «ahora» (f01 S=40: 25 % en las
  dos), pero en el navegador sí (f01 23 → 59 %, f05 53 → 59 %, f02 72 → 77 % a S=40). La diferencia entre Node y navegador en las fachadas es la
  reducción de la foto: **deducido** que una reducción mejor aplana la tejuela y los tablones y deja que la varita avance. No lo pude aislar
  en el navegador (no puedo recompilar :3100).

## 7. Hallazgos por severidad

**IMPORTANTE · un toque en un cuarto de paredes y techo grises o blancos sigue pintando todo el cuarto, y en r07 empeoró.**
r07 (techo 74 → 90 %, pared de al lado 21 → 92 %, además la pantalla de la lámpara) y r13 (techo 100 %, pared izquierda 100 %, marcos de la
ventana, respaldo de la silla). Pasos: `/simulador` → Azul Profundo → subir `r07-dormitorio-pared-y-techo-grises.jpg` → tocar (0,17; 0,27).
Sin aviso. Empeoró **desde `067c6ea`** (se sacó el tope de radio que, por casualidad, acotaba la fuga; medido en Node). La salida existe y
anda (sección 3: 8-10 toques, limpia), y el texto de ayuda ya la nombra, pero la persona no sabe que la varita se pasó hasta que mira. Capturas:
`despues/capturas/r07.png`, `r13.png`, `quitar-techos-r07-2-sin-techo.png`.

**IMPORTANTE · r11: un toque pinta el 90,2 % de la foto** (escritorio blanco 96 %, pantalla de la lámpara, maceta; antes 75,6 %). Misma causa
(`067c6ea`, sin tope). `despues/capturas/r11.png`.

**MENOR (cobertura) · la varita perdió 2-5 puntos en tres cuartos** (r04 88,8 → 84,1, r10 77,8 → 74,7 con un toque más para el 90 %, r09 94,1 → 92,0).
Es el precio del freno de grano (`067c6ea`) que arregló r03; medido en Node. A cambio no hay fugas nuevas en esas tres.

**MENOR · franjas finas de pintura sobre muebles de un color parecido a la pared**: tapa de la cómoda y base del portarretrato en r02 (~10 px de
fondo), costado del mueble en r12 (2-4 px × ~250 px). Coincide con el «doble contorno» que midió `simulador-uso-real` (borde.ts: el anillo de afuera se
pinta más que el borde de adentro). `despues/capturas/r02-recorte.png`, `r12-recorte.png`.

**MENOR · r03 deja un panel azul sobre las alacenas** (53 % de mi zona «cocina»; antes 80 %). Mejoró, no se fue.

**MENOR · ⬠ Contorno**: (a) las esquinas no se pueden mover una vez puestas (sólo «Borrar última esquina»), y a ojo quedan 3-5 px de error (f01); (b)
«Quitar la zona» sólo actúa sobre la selección actual, no sobre una pared ya fijada con ＋ (lo midió `simulador-uso-real`, r13: dice «Zona quitada.» y no quita nada);
(c) el aviso al cerrar no dice cuántas esquinas tenía.

**MENOR · mis referencias estaban viejas**: textura 0,63 → **0,60**; en las fachadas, mis zonas de f01/f04/f05 estaban mal (sección 1).

**Funciona bien (medido):** ⬠ Contorno en las cinco fachadas (99-100 % de lo marcado, derrame ≤ 2 px, sin halo); «Quitar la zona» del techo de r07 y r13 (90 → 0 % y 100 → 0 %, sin pared
comida, «Deshacer» exacto); r03 sin techo; r05 sin arco; la textura no depende del color (dispersión 0,008-0,009); moldura 4,56 % y filo 0 sin cambio; primer clic sin cambio;
el aviso de f01/f04 ahora manda a Contorno; ningún error de JavaScript, consola ni red en las ~55 cargas con registro.

## 8. Lo que dijiste que cambió, verificado

| Cambio | Verificado | Cómo |
|---|---|---|
| Varita sin tope de radio | sí | `magic-wand.ts`: `maxRadius ?? 0`; ningún arco en las 18 capturas; r05 87 → 97 % |
| Freno de grano (4, 20, ventana 12) | sí | `magic-wand.ts:100-102`; r03 techo 100 → 0 % (Node, mismo efecto en el navegador) |
| Marco de la foto con gradiente | sí, sin efecto | código; ninguna de las 18 cambia |
| Borde: 1 px adentro + desmezcla de hasta 2 px afuera | sí | `borde.ts` (`ANILLO = 2`); precisión sintéticas −0,5/−0,9; filo 0; moldura 4,52 → 4,56 % |
| Croma C/L, Intensidad 100 % | sí | control en 100 en las tres sintéticas; textura 0,59-0,60 |
| `resizeQuality: "high"` | sí en el código (`photo-simulator.tsx:267`) | efecto en fachadas: deducido |
| ⬠ Contorno | sí, probado | secciones 2 y 3 |
| ＋ Otra pared, otro color | **no la probé** | la cubre `simulador-uso-real` |
