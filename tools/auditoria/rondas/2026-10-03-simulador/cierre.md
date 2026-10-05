# Cierre de la ronda del simulador (3-5/10/2026)

Pedido del dueño: *"foco absoluto en el simulador, que es la estrella de la página y el servicio
más importante; debe funcionar a la perfección y no debe haber errores a la hora de aplicar los
colores"*. Este cierre es del orquestador: dice qué se verificó de cada reporte, qué se corrigió
(commit y prueba) y qué no era. Cuando un reporte y este cierre no coinciden, vale el cierre.

Agentes: `simulador-color` (2 pasadas), `simulador-fidelidad` (nuevo), `simulador-uso-real` (nuevo,
2 pasadas), `rendimiento`. El límite de uso del plan cortó agentes cuatro veces y el Codespace se
reinició tres: los reportes parciales en el repo y los scripts en `.salida/` hicieron que nada se
perdiera.

## Lo que se midió por primera vez

**Fotos reales.** Hasta esta ronda la varita se afinaba con 3 fotos sintéticas, que daban 82-84 %
de pared con 99 % de precisión. Con 18 fotos reales (`tools/auditoria/simulador/fotos-reales.py`;
puntos y zonas en `tools/auditoria/simulador/reales.json`) aparecieron:
- el corte en arco del tope de radio, en 7 de 13 interiores;
- el techo pintado en cuartos blancos (3 de 13);
- ninguna fachada utilizable (5 de 5).

**El color contra la muestra**, en ΔE2000, con los 48 colores. La réplica de `simulador-fidelidad`
dio bit a bit lo mismo que el navegador en 864 lienzos.

## Corregido, con su prueba (cada prueba vista fallar contra el código anterior)

| Qué | Antes → después | Prueba | Commit |
|---|---|---|---|
| El color de la pared no era el elegido (Intensidad 90 %, croma de los claros) | Blanco Puro sobre pared roja ΔE 7,40 → 0,61; Marfil 2,40 → 0,43 | `simulador-color-fiel`, `pruebas-color` | c7b8189 |
| Recorte de gama corría el tono de los oscuros | 43,5° → 2,7° a L=0,15 | `pruebas-color` | 067c6ea |
| Pintura cortada en arco | recall sintética 82,2 → 94,7 % | `simulador-calidad` (piso 90 %), `pruebas-color` | 067c6ea |
| Techo de un cuarto blanco pintado (r03) | 100 → 0 % | `pruebas-color` (esquina tenue) | 067c6ea |
| Deshacer se llevaba la pared anterior | 262.451 → 0 px; ahora vuelve exacto | `simulador-acciones` | c7b8189 |
| Color viejo si se elegía otro mientras calculaba | la pared quedaba azul con Arena marcado | `simulador-carreras` | f762aec |
| IA: la foto nueva pintada con regiones de la anterior (BLOQUEANTE) | 699.392 px → 0 | `simulador-carreras` | 89a2a34 |
| Pincel con círculos sueltos | 2-25 huecos → 0 | `simulador-acciones` | 89a2a34 |
| Dos paredes, dos colores | imposible → "＋ Dejar <color> y pintar otra pared" | `simulador-acciones` | 89a2a34, 6d78561 |
| Fachadas y techo del mismo color | sin salida → ⬠ Contorno (pintar / quitar) | `simulador-acciones`, `pruebas-color` | f762aec |
| Colores lejos de la foto en el celular | 630 px → 42 px; Intensidad 1.000 → 94 px | `simulador-celular` | 89a2a34, 5067477 |
| Contorno del color viejo y línea gris en el borde | r08: 50 % del borde verde → 19 %; línea gris 3.037 → 50 px | `simulador-borde`, `pruebas-color` | dc8534c, f45b5d7 |
| Deshacer tras la ✕, pared fija sin corrección, ver original que tapaba todo, Intensidad que cambiaba paredes fijas | (2ª pasada de `simulador-uso-real`) | `simulador-acciones` | 6d78561 |
| IA colgada: 70 s trabado y después nada | "Cancelar" y aviso por tiempo | `simulador-carreras` (reloj simulado) | 6d78561 |

## Velocidad (celular de gama media, CPU ×4, compilación de producción)

| Qué | Antes | Ahora |
|---|---|---|
| Cambiar de color (Intensidad 100 %) | 241 ms (22/9) | ~100 ms (2d75c7a, `rendimiento`) |
| Borde de la selección (cada toque, trazo, Deshacer) | 229 ms (versión del 4/10) / 142 (2d75c7a) | ~5× más rápido que la del 4/10, idéntico píxel a píxel |
| Cargar una foto (r11): pasarla a OKLab + copia | 561-592 ms | 272-283 ms: 2×, idéntico (huella igual) |
| Cargar una foto (r11): pantalla congelada | 675-689 ms | 377-399 ms (5067477, 3 corridas válidas de 10) |
| Primer toque, tarea larga | 319-339 ms (referencia) | 247-269 ms (5067477, máquina cargada) |
| Primer toque, hasta ver el color | 413-425 ms | 344-387 ms |
| Diez toques seguidos | 1,06 s congelado | 0,43-0,51 s |

## Lo que resultó falso o no era

- **"La moldura subió de 2,5 % a 4,5 %"**: dos franjas distintas sobre la misma pintura (pasado a
  "descartado" en la BITÁCORA). Chrome no cambió.
- **Mi primera hipótesis del 3/10, que la IA del modo 🤖 no estaba configurada**: sí lo está en este
  Codespace (Replicate); el problema era otro (la carrera al cambiar de foto).
- **"El segundo color no se aplica"** (5/10, `simulador-color-fiel` en rojo): era la PRUEBA. El botón
  "＋ Dejar Blanco Puro y pintar otra pared" también dice el nombre del color y `page.click`
  apretaba ése. Las pruebas eligen ahora con `button[aria-pressed]` (REGLAS).
- **"La carga de la foto, 3× más rápida"** (lo escribí yo antes de remedir): medida otra vez en Chrome
  sobre 5067477, la conversión con su copia para el worker pasó de 561-592 a 272-283 ms, o sea **2×**.
  Corregido en la tabla de arriba, en la BITÁCORA y en CLAUDE.md. Las mediciones de "cambiar de color"
  y "primer toque" de esa remedición no llegaron a correr: el Codespace se apagó a las 04:36.

## Abierto (en la BITÁCORA)

- r07 y r13: un toque sigue pintando el techo (esquina demasiado tenue para cualquier freno por
  color). Salida: Contorno → Quitar la zona.
- El ancla en percentil: decisión, no error (los blancos con luz fuerte ~ΔE 4 más oscuros en la
  mediana).
- La Intensidad < 100 % sigue por el camino lento (~200 ms en gama media); el defecto es 100 %.
