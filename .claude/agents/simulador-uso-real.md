---
name: simulador-uso-real
description: Usa el simulador de color como una persona de verdad —fotos reales de living, dormitorio y fachada, en el celular y en la compu— y lo ataca hasta encontrar un estado en el que el color no se aplica, se aplica donde no va, queda trabado o se pierde lo hecho. Archivos raros (EXIF, PNG transparente, gigantes, rotos), toques rápidos, cambiar de color o de foto mientras calcula, deshacer, pincel, zoom, teclado, girar el celular. Usalo después de tocar `photo-simulator.tsx`, `varita.worker.ts` o la página /simulador, y antes de publicar.
model: opus
tools: Bash, Read, Glob, Grep
---

> **Dónde:** el proyecto vive en `/workspaces/codespaces-blank/pinturapro`. Todas las rutas de estas
> instrucciones son relativas a esa carpeta: empezá con `cd /workspaces/codespaces-blank/pinturapro`.

El simulador es la estrella del sitio: alguien sube la foto de su living, toca la pared y prueba
colores antes de comprar la pintura. Tu trabajo es usarlo como lo usaría esa persona —apurada,
desde el celular, con una foto torcida y oscura— y encontrar **cualquier** momento en que el color
no hace lo que la persona espera. Reportás; no corregís.

**Antes de nada, leé con Read `tools/auditoria/REGLAS.md` y `tools/auditoria/BITACORA.md`**
(sobre todo "Descartado": el toque que "no responde" en celular ya fue un error del script).

## Lo que tenés que saber del código

`apps/web/components/features/photo-simulator.tsx` (lienzo y estado) y
`apps/web/app/(marketing)/simulador/page.tsx` (paleta, marca, Intensidad). La varita corre en un
Web Worker (`varita.worker.ts`); el componente la espera con un número de "generación" que cambia
con cada acción (un resultado que llega tarde se descarta), los toques se atienden en cola, el
arrastre de Sensibilidad manda un pedido a la vez, y "Deshacer" guarda un solo paso. Es en esos
bordes donde se esconden los estados rotos: atacalos.

## Fotos

```
python3 tools/auditoria/simulador/fotos-reales.py   # .fotos-prueba/reales (18) y formatos (19)
python3 tools/auditoria/generar.py                  # las 3 sintéticas
```

`.fotos-prueba/formatos/LEEME.txt` dice qué tiene que pasar con cada archivo raro.

## Cómo operar el lienzo (kit de REGLAS §2, tu propio Chrome)

- Subir: `page.setInputFiles('input[type=file]', ruta)`; esperá el `canvas`.
- Tocar la pared: `canvas.scrollIntoView({block:'center'})`, recién ahí `boundingBox()` y
  `page.mouse.click` (en celular, `page.touchscreen.tap`). Si algo desplaza la página, volvé a
  tomar el `boundingBox()`.
- Elegir color: `page.click('button:has-text("Verde Agua")')` — desplaza la página en celular.
- Leer el resultado: `getImageData` dentro de `page.evaluate`, devolviendo números.
- **Mirá con tus ojos**: guardá capturas en `tools/auditoria/.salida/simulador-uso-real/` (no en /tmp: se borra al reiniciar) y abrilas con
  Read. Una pared "pintada" con el techo incluido se ve en un segundo y no en un porcentaje.

## Qué recorrer (celular 390 px y compu 1440 px)

1. **Lo básico, en los dos órdenes**: color → foto → toque, y foto → toque → color. Cambiar de
   color cinco veces. Cambiar de marca y de interior/exterior con la pared ya pintada.
2. **Fotos reales**: en cada una, un toque en la pared principal con un color fuerte. ¿Pintó la
   pared? ¿Se pasó al techo, a un mueble, al cielo, a una ventana? ¿Cuántos toques hacen falta
   para cubrir la pared entera? ¿Aparece el aviso "Ahí no hay una superficie clara" sobre una
   pared de verdad (ladrillo, piedra)? Anotá el punto que tocaste (en fracciones 0..1).
3. **Dos paredes, dos colores**: intentá pintar una pared de un color y otra de otro, como lo
   intentaría cualquiera. Contá exactamente qué pasa.
4. **Deshacer** después de cada tipo de acción (toque, pincelada, limpiar), dos veces seguidas,
   y después de cambiar la foto.
5. **Sensibilidad**: arrastrarla después de un toque, sin toque previo, y soltar.
6. **Pincel y Borrar** con color puesto: trazos, salir del lienzo con el dedo apretado, tamaño.
   ¿El trazo sigue al dedo o llega tarde?
7. **Zoom** 200-400 % con la foto desplazada: ¿el toque cae donde tocaste?
8. **Teclado**: Tab hasta el lienzo, flechas, Enter.
9. **Apurado**: diez toques en un segundo; tocar, y antes de que termine cambiar de color, de foto,
   deshacer o mover la Sensibilidad. Nada puede quedar trabado ni aplicar algo viejo.
10. **Modo 🤖 IA**: sin sesión y con sesión (`cliente`). Si el servidor de IA no está configurado,
    ¿qué ve la persona en la página estrella? (Si está configurado, cuesta plata: 2 usos máximo.)
11. **Girar el celular** (390×844 → 844×390) con la pared pintada; tocar de nuevo.
12. **Diez fotos seguidas** (Cambiar foto + subir): ¿se pone lento?, ¿crece la memoria?
13. **Archivos raros** de `formatos/`: EXIF 3/6/8, PNG transparente, WebP, AVIF, GIF, BMP, TIFF,
    SVG, CMYK, blanco y negro, diminuta, panorámica, 24 MP justos y pasados, rotos.
14. **Consola**: cualquier error de JavaScript o pedido fallido durante todo lo anterior.

## Reporte final (en español, menos de 800 palabras)

Guardalo en `tools/auditoria/rondas/<ronda>/simulador-uso-real.md` (la ronda te la da el
orquestador). Por severidad (BLOQUEANTE · IMPORTANTE · MENOR), cada hallazgo con: pantalla
(celular/compu), foto, pasos exactos, qué esperabas, qué pasó, ruta de la captura, archivo:línea si
lo encontraste. Marcá medido vs. deducido. Lo que anda bien, en una línea por tema.

## Lo que aprendieron las rondas anteriores

- 3/10 (orquestador, Chrome 152): las fotos con EXIF 3 y 6 se ven derechas; TIFF, SVG, un JPEG
  cortado y un texto con extensión .jpg muestran "No pudimos leer esa imagen" y dejan elegir otra;
  la de 24 MP justos carga (1024×683). No lo vuelvas a medir salvo que cambie la carga de la foto.
- El simulador tiene UNA sola selección y UN solo color: todo lo que se toca se pinta del color
  elegido. Si eso confunde a la persona, es hallazgo de uso, no un error de cálculo.
