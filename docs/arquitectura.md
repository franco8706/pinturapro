# Cómo está partido el proyecto (y cómo seguir partiéndolo)

Decisión del dueño, septiembre 2026: **el proyecto no tiene que ser un bloque único**. Cuando
casi todo vivía dentro de `apps/web`, eso tenía dos costos concretos, no teóricos:

- **La app móvil no podía reusar nada.** `apps/mobile` tenía su propia copia de cada regla. Cada
  cambio había que acordarse de hacerlo dos veces, y ya pasó que quedaran desincronizadas (los
  triggers de la migración 0009, el parser de montos que multiplicaba por cien).
- **Nada se podía probar por separado.** Para medir el motor de color había que levantar Next
  entero y un navegador.

Estado al 29/9/2026: las **reglas** ya viven en un solo lugar y las usan las dos apps. Las
**consultas** a la base siguen duplicadas: es lo que sigue.

## Qué hay hoy

```
apps/
  web/                 Next.js 15 (páginas, acciones de servidor, componentes)
  mobile/              Expo / React Native
packages/
  color/               ✅ motor del simulador: varita mágica + color en OKLab
  dominio/             ✅ reglas del negocio: montos y comisión, topes de largo, mensajes de
                          error, quién puede cotizar, guardas de lo que llega por la red, tamaño
                          de imágenes. Lo importan la web (`workspace:*`) y el móvil (`file:`).
  ui/                  (existe pero nadie lo usa todavía)
tools/
  auditoria/           kit de navegador y reglas para los agentes
supabase/migrations/   el esquema y la seguridad: la barrera real
```

## El criterio para sacar algo de `apps/web`

Una pieza se va a `packages/` cuando cumple las tres:

1. **No depende de la interfaz.** Ni React, ni Next, ni el DOM. Entra un dato, sale un dato.
2. **La necesita más de uno.** Hoy: web y móvil. Si sólo la usa la web, que se quede donde está;
   partir por partir agrega saltos entre carpetas sin ganar nada.
3. **Se puede probar sola.** Si para verificarla hay que levantar la app, todavía está enredada.

`packages/color` cumplió las tres: su única entrada es una `ImageData` y se mide con fotos
sintéticas y una máscara de referencia (ver `tools/auditoria/`).

## Lo que sigue, en orden de lo que más duele

1. ~~**`packages/dominio`**~~ — **hecho.** La web lo usa desde el 22/9 y el móvil desde el 29/9
   (borró 138 líneas de copias). El móvil lo declara con `"file:../../packages/dominio"` y no
   con `workspace:*`, que rompe `npm install` (medido). Metro lo resuelve solo desde Expo 52, sin
   `metro.config.js`. Falta probarlo en un celular: desde el Codespace la app no se puede
   correr. Lo vigila la prueba `reglas-compartidas`.
2. **`packages/datos`** — las lecturas de Supabase y las escrituras, con los tipos generados
   del esquema. Hoy están duplicadas en web y móvil. El paso previo ya está hecho (1/10):
   `apps/web/lib/queries.ts`, que tenía 1.577 líneas, es ahora `lib/queries/` — `base`,
   `pintores`, `obras`, `resenas`, `pedidos`, `contenido` y `metricas-admin`, con un `index.ts`
   que re-exporta lo mismo que antes. Todos dependen sólo de `base`. Lo que falta para que sea
   un paquete: que cada función reciba el cliente de Supabase en vez de crearlo (la web usa
   cookies de Next y el móvil AsyncStorage).
3. **Pruebas propias de `packages/color`**: hoy su única medición abre un navegador
   (`simulador-calidad`). Separado en el código, no en la verificación.
4. **`packages/ui`** — los tokens de diseño (colores, tipografías, escalas). No los componentes:
   la web usa Tailwind y el móvil StyleSheet, así que lo que se comparte son los valores, no el
   markup.

**Lo que NO conviene separar:** las páginas, los formularios y los componentes de la web. Son
específicos de un solo consumidor, y moverlos sólo agregaría indirección.

## La regla de oro de cada corte

Cada mudanza se cierra **midiendo lo mismo antes y después**. El motor de color se movió con esta
verificación: recall 82,2% con 99,3% de precisión, y textura conservada en 0,63 con los seis
colores, idéntico a antes de mover. Si un refactor no se puede verificar así, no está listo para
hacerse.
