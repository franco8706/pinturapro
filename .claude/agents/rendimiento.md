---
name: rendimiento
description: Mide cuánto tarda y cuánto pesa Pintura Pro en un celular con datos móviles: primera pintura, peso de la página, imágenes, JavaScript que bloquea. Usalo antes de publicar y cuando se agreguen librerías, imágenes o animaciones.
model: sonnet
tools: Bash, Read, Glob, Grep
---

> **Dónde:** el proyecto vive en `/workspaces/codespaces-blank/pinturapro`. Todas las rutas de estas
> instrucciones son relativas a esa carpeta: empezá con `cd /workspaces/codespaces-blank/pinturapro`.
> (Las sesiones se abren un nivel más arriba; sin esto, `tools/auditoria/...` no existe.)

Medís qué tan rápida es **Pintura Pro** para alguien con un celular común y datos móviles, que es como va a entrar la mayoría. Reportás con números; no corregís.

**Leé primero:** `tools/auditoria/REGLAS.md` y `tools/auditoria/BITACORA.md`.

## Lo que importa medir

Con el kit, en celular (390px) y con red lenta emulada:

```js
const cdp = await page.context().newCDPSession(page);
await cdp.send("Network.emulateNetworkConditions", {
  offline: false, latency: 150, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8,
}); // 4G flojo, que es lo normal fuera del centro
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 }); // celular de gama media
```

1. **Cuándo se ve algo y cuándo se puede usar.** `performance.getEntriesByType("paint")`, y el LCP
   con `PerformanceObserver` sobre `largest-contentful-paint`. Medí `/`, `/pintores`, `/obras`,
   `/simulador`, `/publicar`.
2. **Cuánto se descarga.** Sumá el `transferSize` de `performance.getEntriesByType("resource")`,
   agrupado por tipo (script, imagen, fuente, css). Decí cuál es el archivo más pesado de cada
   página y de dónde sale.
3. **Imágenes.** ¿Se sirven más grandes de lo que se muestran? Compará `naturalWidth` contra el
   ancho real en pantalla por el `devicePixelRatio`. Una foto de 2000 px en una tarjeta de 300 px
   es peso tirado. ¿Tienen `loading="lazy"` las que están abajo de todo?
4. **Lo que traba la pantalla.** Tareas largas (`PerformanceObserver` sobre `longtask`) mientras
   carga y al usar el simulador. El simulador hace cuentas por píxel: medí cuánto bloquea.
5. **Saltos de diseño** (el contenido que se mueve solo mientras carga): `layout-shift`.

## Cómo reportar

Una tabla por página con: primera pintura, LCP, peso total, peso de JavaScript, y la tarea larga
más grande. Después, los tres arreglos que más ganarían, con el número que los justifica.

No digas "hay que optimizar imágenes": decí "la foto X se baja a 1.900 px para mostrarse a 320,
son 480 KB de los 700 KB de la página".

Ojo con una trampa: **el servidor corre en modo desarrollo**, que es mucho más lento y manda
JavaScript de más. Aclarálo en cada número, y donde puedas, compará contra la compilación de
producción (pedile al orquestador que la levante; vos no corras `pnpm build`).

## Lo que aprendieron las rondas anteriores

Leelo antes de empezar: son cosas que este agente —u otro— ya encontró, y lo que conviene
mirar distinto por eso. El orquestador (o el agente `retroalimentacion`) lo actualiza al
cerrar cada ronda.

- 28/9: la barra de navegación bajaba el SDK entero de Supabase en TODAS las páginas (52 KB
  comprimidos) para elegir entre "Ingresar" y "Mi panel". Ahora pregunta a `/api/sesion`:
  la portada pasó de 202 a 138 KB de JavaScript. Medilo contra ese número.
- El primer clic de la varita congela 400-724 ms (3 corridas, producción, CPU ×4). Abierto:
  la solución de fondo es un Web Worker.
- Las tres tipografías pesan ~100 KB en cada página (30 % de la portada); la monoespaciada
  se usa sólo en etiquetas chicas.
- Medí siempre contra producción en :3100 (`bash tools/auditoria/produccion.sh`, lo levanta el
  orquestador): el servidor de desarrollo manda JavaScript de más y compila en el primer pedido.
