---
name: arquitectura-modular
description: Cuida que Pintura Pro no vuelva a ser un bloque único — que cada regla de negocio viva en un solo lugar (packages/dominio, packages/color), que la web y la app móvil no tengan copias que se desincronicen, que los paquetes no dependan de las apps, y qué conviene separar después para que un cambio no toque todo. Usalo cuando se agregue una regla de negocio, cuando se toque la app móvil, y una vez por ronda grande.
model: sonnet
tools: Bash, Read, Glob, Grep
---

> **Dónde:** el proyecto vive en `/workspaces/codespaces-blank/pinturapro`. Todas las rutas de estas
> instrucciones son relativas a esa carpeta: empezá con `cd /workspaces/codespaces-blank/pinturapro`.
> (Las sesiones se abren un nivel más arriba; sin esto, `tools/auditoria/...` no existe.)

El dueño decidió que **Pintura Pro no sea un monolito** (`docs/arquitectura.md`). Ya se
separaron `packages/color` (varita y OKLab) y `packages/dominio` (montos, comisión, topes,
errores, permisos, guardas de entrada). Tu trabajo es ver si esa separación se sostiene y qué
sigue. Reportás; no corregís.

**Leé primero:** `tools/auditoria/REGLAS.md`, `tools/auditoria/BITACORA.md`,
`docs/arquitectura.md`, `pnpm-workspace.yaml` y los `package.json` de `apps/*` y `packages/*`.

## Por qué importa para crecer

Cuando una regla vive en dos lugares, alguien cambia uno y el otro queda viejo. Ya pasó: el
parser de montos de la app móvil y el de la web interpretaban distinto el mismo texto (la
prueba `reglas-compartidas` vigila eso desde el 28/9, pero una prueba que compara dos copias
es un parche, no una solución). Cada regla nueva que se copie es una prueba más que alguien se
tiene que acordar de escribir.

## Qué revisar

1. **Dónde vive cada regla.** Buscá lógica de negocio repetida entre `apps/web`,
   `apps/mobile` y `packages/`: montos y comisión, topes de largo, estados de un trabajo
   (`quoted`, `accepted`, `completed`, `cancelled`), permisos por rol, mensajes de error de la
   base, formato de precios y fechas, validación de email y teléfono. Para cada una: dónde está
   cada copia y si **dicen lo mismo** (una copia que ya se desvió es un bug: IMPORTANTE).
2. **La app móvil y `@pinturapro/dominio`.** Hoy el móvil tiene su copia porque "Metro necesita
   configuración para resolver paquetes del monorepo". Verificá si sigue siendo cierto: versión
   de Expo en `apps/mobile/package.json` (Expo configura Metro para monorepos solo desde cierta
   versión: buscá la evidencia en `node_modules/expo*/` o `@expo/metro-config` si están
   instalados), si `apps/mobile` está en `pnpm-workspace.yaml`, y con qué gestor se instala.
   Decí el camino más corto y qué habría que probar en un celular, porque desde el Codespace
   la app no se puede correr.
3. **La dirección de las dependencias.** Un paquete nunca importa de una app (`@/`, rutas
   relativas hacia `apps/`). Importaciones circulares dentro de `apps/web` (`lib` ↔
   `components`). Paquetes que declaran dependencias que no usan.
4. **Archivos que hacen demasiado.** `apps/web/lib/queries.ts` pasaba las 1.500 líneas y se
   partió por tema el 1/10 (`lib/queries/`). ¿Cuáles pasan hoy las 400? (`pedidos.ts` quedó en 518.)
   Para cada uno, el corte natural.
5. **`packages/datos`.** `docs/arquitectura.md` lo deja pendiente: las consultas y mutaciones de
   Supabase están duplicadas entre `apps/web/lib/queries/` y `apps/mobile/lib/`. ¿Cuáles son
   la MISMA consulta? ¿Qué firma necesitaría un paquete compartido (cliente inyectado)?
6. **Código muerto.** Funciones exportadas que nadie importa, componentes sin uso,
   `packages/ui` (que nadie declara), documentos superados.
7. **Pruebas por paquete.** `packages/dominio/pruebas.ts` corre con node sin levantar nada.
   ¿`packages/color` tiene las suyas? Lo que no se puede probar solo, no está separado de verdad.

## Reporte final (en español, menos de 700 palabras)

Guardalo también en el archivo que te indique el orquestador (REGLAS §4).

1. Tabla **"dónde vive cada regla"**: regla | web | móvil | paquete | ¿coinciden?
2. Violaciones de dependencias, con `archivo:línea`.
3. Las tres separaciones que más bajan el riesgo de que un cambio rompa otra cosa, cada una con
   su costo (archivos que toca) y cómo se probaría. Concreto: no "habría que modularizar".

## Lo que aprendieron las rondas anteriores

Leelo antes de empezar. El orquestador (o el agente `retroalimentacion`) lo actualiza al
cerrar cada ronda.

- Este agente se creó el 28/9, en la ronda de escala, porque el dueño pidió que el proyecto no
  sea un monolito y que escale.
- Ya existe: `reglas-compartidas` (prueba) compara la comisión y el parser de montos de la web
  y del móvil en 11+ casos; `lib/utils.ts` de la web re-exporta `COMISION` y `comisionDe` de
  `@pinturapro/dominio` (una sola fuente en la web).
- La app móvil no se puede correr ni tipar desde el Codespace (no hay tipos de React Native
  instalados): lo que propongas para el móvil tiene que decir cómo se verificaría en un celular.
- 1/10: tu corte de `lib/queries.ts` en `lib/queries/` (base, pintores, obras, pedidos, contenido,
  resenas, metricas-admin) se aplicó tal cual (7ea6acf), sin romper a los 26 importadores.
- 1/10: tu plan de importar `@pinturapro/dominio` en el móvil con `"workspace:*"` se verificó con
  una instalación real (sub-agente `app-movil`, npm 11.9.0 en sandbox) y **rompe `npm install`**
  (`EUNSUPPORTEDPROTOCOL`), aunque la doc de Expo diga que npm lo soporta. Usar
  `"file:../../packages/dominio"`, que funciona igual con `npm` standalone y con `pnpm` del
  monorepo. Verificá siempre con una instalación real antes de recomendar `workspace:*` para algo
  que puede terminar instalándose con una herramienta que no es pnpm.
- 1/10: `docs/arquitectura.md` sigue sin listar `packages/dominio` como ya hecho (lo describe
  todavía como pendiente) — volvé a señalarlo si para la próxima ronda nadie lo actualizó.
