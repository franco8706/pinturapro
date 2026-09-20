# Cómo está partido el proyecto (y cómo seguir partiéndolo)

Decisión del dueño, septiembre 2026: **el proyecto no tiene que ser un bloque único**. Hoy casi
todo vive dentro de `apps/web`, y eso tiene dos costos concretos, no teóricos:

- **La app móvil no puede reusar nada.** `apps/mobile` ya tiene su propia copia de las consultas y
  de las escrituras. Cada regla de negocio que cambia hay que acordarse de cambiarla dos veces, y
  ya pasó que quedaran desincronizadas (los triggers de la migración 0009).
- **Nada se puede probar por separado.** Para medir el motor de color hay que levantar Next entero
  y un navegador.

## Qué hay hoy

```
apps/
  web/                 Next.js 15 (páginas, acciones de servidor, componentes)
  mobile/              Expo / React Native
packages/
  color/               ✅ motor del simulador: varita mágica + color en OKLab
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

1. **`packages/dominio`** — las reglas del negocio que hoy están repartidas entre las acciones de
   la web y las de móvil: qué estados puede tener un trabajo y qué transición es válida, cómo se
   calcula la comisión, qué puede hacer cada rol, y los textos de error traducidos
   (`lib/errores-db.ts`). Es lo que más se desincroniza entre las dos apps.
2. **`packages/datos`** — las lecturas de Supabase (`lib/queries.ts`) y las escrituras, con los
   tipos generados del esquema. Hoy están duplicadas en web y móvil.
3. **`packages/ui`** — los tokens de diseño (colores, tipografías, escalas). No los componentes:
   la web usa Tailwind y el móvil StyleSheet, así que lo que se comparte son los valores, no el
   markup.

**Lo que NO conviene separar:** las páginas, los formularios y los componentes de la web. Son
específicos de un solo consumidor, y moverlos sólo agregaría indirección.

## La regla de oro de cada corte

Cada mudanza se cierra **midiendo lo mismo antes y después**. El motor de color se movió con esta
verificación: recall 82,2% con 99,3% de precisión, y textura conservada en 0,63 con los seis
colores, idéntico a antes de mover. Si un refactor no se puede verificar así, no está listo para
hacerse.
