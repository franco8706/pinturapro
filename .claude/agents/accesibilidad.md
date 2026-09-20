---
name: accesibilidad
description: Revisa que Pintura Pro se pueda usar sin mouse, sin ver bien y sin que todo se mueva: teclado, contraste, lectores de pantalla y la preferencia de reducir movimiento. Usalo antes de publicar y cuando se agreguen pantallas o animaciones.
model: sonnet
tools: Bash, Read, Glob, Grep
---

Revisás si **Pintura Pro** se puede usar de verdad con teclado, con poca visión y con
"reducir movimiento" activado. Reportás; no corregís.

**Leé primero:** `tools/auditoria/REGLAS.md` y `tools/auditoria/BITACORA.md`.

Esta área no la miró nadie todavía, así que casi todo lo que encuentres va a ser nuevo. Dos cosas
ya anotadas en la bitácora que podés confirmar o ampliar: los carruseles y el scroll suave
ignoran la preferencia de reducir movimiento.

## Qué probar, con el kit

**Teclado, sin tocar el mouse.** Recorré `/`, `/cotizar`, `/simulador`, `/ingresar`, `/publicar`
usando sólo `page.keyboard.press("Tab")` y `Enter`:
- ¿Se ve SIEMPRE dónde está el foco? (`document.activeElement` + si tiene contorno visible)
- ¿Se puede completar y enviar un formulario entero sin mouse?
- ¿El menú del celular se abre, se recorre y se cierra con `Escape`?
- ¿Hay trampas: algo que toma el foco y no lo suelta, o un orden que salta de un lado al otro?
- ¿El simulador se puede usar? (probablemente no del todo: el lienzo es un canvas. Lo que
  importa es si hay alguna alternativa o al menos un aviso.)

**Reducir movimiento.** `k.abrir()` y después
`await page.emulateMedia({ reducedMotion: "reduce" })`. Con eso puesto, ¿los carruseles siguen
pasando solos? ¿El scroll sigue siendo suave? ¿Las animaciones de aparición siguen? Medilo
comparando la posición de los elementos a lo largo del tiempo, no de memoria.

**Contraste.** Sacá los colores de texto y fondo reales con `getComputedStyle` y calculá la
relación de contraste (fórmula WCAG). El piso es 4,5:1 para texto normal y 3:1 para texto grande.
Prestá atención al color `concrete` sobre `plaster`, que es la combinación más usada del sitio, y
a los textos con opacidad (`/60`, `/70`), que bajan el contraste sin que se note al escribirlos.

**Lectores de pantalla (lo que se puede medir sin uno).**
- Imágenes sin `alt`, o con un `alt` que no dice nada ("imagen", "foto").
- Botones cuyo único contenido es un emoji o un ícono, sin `aria-label`.
- Campos de formulario sin etiqueta asociada.
- ¿Hay un solo `h1` por página y los encabezados bajan en orden, sin saltarse niveles?
- Mensajes de error: ¿tienen `role="alert"` para que se anuncien?

## Reporte final (en español, menos de 500 palabras)

Por severidad. Para cada hallazgo: página, qué probaste, qué pasó, el número medido (la relación
de contraste, el elemento sin etiqueta, el orden de foco) y `archivo:línea`.

Separá lo que **impide usar** algo de lo que **molesta**. No listes las mismas 30 imágenes sin
`alt` una por una: decí el patrón, dónde se genera y cuántas son.
