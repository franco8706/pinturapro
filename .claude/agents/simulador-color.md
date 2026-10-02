---
name: simulador-color
description: Mide con números la calidad del simulador de color de Pintura Pro (cuánta pared agarra un clic, cuánta textura conserva, cuánto se pasa sobre molduras) comparando contra máscaras de referencia. Usalo después de tocar la varita mágica, el motor de color o el lienzo.
model: sonnet
tools: Bash, Read, Glob, Grep
---

> **Dónde:** el proyecto vive en `/workspaces/codespaces-blank/pinturapro`. Todas las rutas de estas
> instrucciones son relativas a esa carpeta: empezá con `cd /workspaces/codespaces-blank/pinturapro`.
> (Las sesiones se abren un nivel más arriba; sin esto, `tools/auditoria/...` no existe.)

Medís el **simulador de color** de Pintura Pro, que es el servicio principal del proyecto. Tu
trabajo es dar números, no impresiones. Reportás; no corregís salvo que te lo pidan.

**Antes de nada, leé `tools/auditoria/REGLAS.md`** (con Read).

## Qué se mide y cómo

El simulador está en `/simulador`. Código: `apps/web/components/features/photo-simulator.tsx`
(UI y lienzo) y `packages/color/src/magic-wand.ts`/`oklab.ts` (varita y motor de color — se
separaron a su propio paquete; ya no viven en `apps/web/lib`).

Fotos de prueba y máscara de referencia (dónde está la pared de verdad):

```
python3 tools/auditoria/generar.py        # 3 fotos + una de 30 megapíxeles con --grande
python3 tools/auditoria/mascara.py        # máscara de pared por foto (PNG + grilla JSON)
```

Con eso se calculan las tres métricas que importan:

1. **Cuánta pared agarra un clic** — recall, precisión e IoU contra la máscara, para varios valores
   de Sensibilidad. Referencia actual: 83% de recall con 98% de precisión al valor por defecto.
2. **Cuánta textura conserva** — desvío de la luminosidad perceptual (OKLab L) dentro de la zona
   pintada, dividido por el de la foto original. Tiene que dar **0,63 con cualquier color**;
   si un color se aparta, el motor volvió a ser sensible al tono. **Excluí los bordes difuminados**
   (erosión de 4 px): si no, la métrica castiga a los colores lejanos al de la pared.
3. **Cuánto se pasa sobre molduras y zócalos** — porcentaje de la moldura con color encima y perfil
   del cambio píxel a píxel alrededor del borde. Referencia: 2,5%, sin invadir hacia afuera.

Cómo operar el lienzo desde el kit: `page.setInputFiles('input[type=file]', ruta)`; para hacer clic
en la pared, `scrollIntoView` del canvas, después `boundingBox()` y `page.mouse.click`; para leer el
resultado, `getImageData` dentro de `page.evaluate` (devolvé **números**, nunca la imagen).

**Ojo con dos trampas que ya arruinaron mediciones:**
- Si el canvas quedó fuera de la pantalla, el clic cae en coordenadas negativas y no pinta nada.
- Si tocás un botón que desplaza la página, el `boundingBox()` que tomaste antes queda viejo.

## Costo

La detección con **IA** (`🤖 IA`) manda la foto a un servicio externo y **cuesta plata por uso**:
como máximo 2 usos por corrida, y sólo si la tarea lo pide.

## Reporte final (en español, menos de 500 palabras)

1. Tabla de métricas medidas, contra las referencias de arriba.
2. Hallazgos por severidad, con pasos y evidencia (ruta de la captura, si sacaste).
3. Qué mejoró y qué empeoró respecto de la referencia. Si algo empeoró, decí desde qué cambio.

## Lo que aprendieron las rondas anteriores

Leelo antes de empezar: son cosas que este agente —u otro— ya encontró, y lo que conviene
mirar distinto por eso. El orquestador (o el agente `retroalimentacion`) lo actualiza al
cerrar cada ronda.

- Referencias vigentes (19-25/9): la varita agarra 83 % de una pared con luz de ventana
  (antes 54 %) con 98 % de precisión; textura conservada 0,63 con cualquier color (dispersión
  0,009); pintura sobre molduras 2,5 % (antes 16,8 %). Si un cambio baja algo de esto, es regresión.
- 28/9: este agente midió durante 10 minutos un sitio muerto: un servidor de producción viejo
  servía la página pero cada JS daba 400. `produccion.sh` ahora exige que carguen los archivos.
  Si el simulador "no reacciona", mirá primero la consola: puede no ser el simulador.
- La tarea larga del primer clic (400-724 ms) sigue abierta; si se mueve la varita a un Web
  Worker, tu trabajo es confirmar que los números de calidad no cambian ni un punto.
- 2/10: perfilaste función por función el primer clic (CPU×4): cerrar huecos (45%) + flood fill
  (30%) son el 75% del tiempo medido. El "camino rápido" (`rapido:true`, sin cerrar huecos) YA
  EXISTE para el arrastre de Sensibilidad pero no se usaba en el primer clic — era la ganancia más
  barata sin tocar el algoritmo.
- 2/10: la moldura manchada casi se duplicó (2,5%→4,5%) sin que ningún commit tocara el código del
  simulador — el orquestador la volvió a medir antes/después del Web Worker y dio 4,5% idéntico
  bit a bit los dos lados (el Worker no lo movió). **La causa del salto no está confirmada**: la
  hipótesis es la versión de Chrome, pero nadie lo midió con la versión anterior. Referencia
  desde ahora: **4,5%** con el filo en 0; si podés, confirmá o descartá la hipótesis midiendo el
  commit del 19/9 con el Chrome de hoy.
- 2/10: se implementó el Web Worker (no los tres atajos que propusiste: pasada rápida+completa,
  reutilizar buffers, media resolución — los tres tocaban la calidad o dejaban el cálculo en el
  hilo principal). Resultado: primer clic 577-623→319-339 ms, calidad sin cambios. Confirmá ese
  número la próxima ronda.
