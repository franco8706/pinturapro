# Arquitectura modular — ronda 2026-09-28-escala

Medido leyendo código (`packages/*`, `apps/web/lib`, `apps/mobile/lib`, `node_modules/.pnpm`), sin
navegador ni servidor. `packages/color` y `packages/dominio` ya existen; nada estaba marcado
`corregido` en la BITÁCORA que haya vuelto a romperse.

## 1. El móvil YA PUEDE importar `@pinturapro/dominio` — falta declararlo, no configurar Metro

La nota de "Metro necesita configuración extra" (BITÁCORA, abierto) **ya no es cierta**.
`apps/mobile` usa **Expo 52.0.49** con `@expo/metro-config@0.19.12` instalado
(`node_modules/.pnpm/@expo+metro-config@0.19.12`), y ese paquete detecta el monorepo **solo**:
`getWatchFolders.js` y `getModulesPaths.js` llaman a `getMetroServerRoot()`
(`@expo/config/paths.js:155`), que sube directorios hasta encontrar la raíz del workspace pnpm y
agrega `packages/*` a `watchFolders` y `nodeModulesPaths` — sin `metro.config.js` propio (no
existe ninguno en `apps/mobile`) y sin variable `EXPO_NO_METRO_WORKSPACE_ROOT` seteada. Esto es
así desde el SDK ~48 de Expo, no algo nuevo de esta ronda.

Lo único que falta es la declaración de la dependencia:

- **`apps/mobile/package.json`** (bloque `dependencies`, junto a la línea `"@supabase/supabase-js": "^2.45.4"`): agregar `"@pinturapro/dominio": "workspace:*"`.
- Después de `pnpm install` en la raíz, `apps/mobile/node_modules/@pinturapro/dominio` queda
  symlinkeado (hoy `apps/mobile/node_modules/@pinturapro` **no existe**; en cambio
  `apps/web/node_modules/@pinturapro/{color,dominio}` sí están symlinkeados — verificado con `ls`).
- Reemplazar en **`apps/mobile/lib/mutations.ts`**: `mensajeDeError` (línea 21-64) → `import { mensajeDeError } from "@pinturapro/dominio"`; `toInt` (línea 92-121, exportada y usada también en `apps/mobile/app/cotizar/[id].tsx:4,62,68`) → `import { montoDesdeTexto as toInt } from "@pinturapro/dominio"`; `TOPES`/`NOMBRE_DEL_CAMPO`/`revisarLargos` (línea 129-158) → `import { TOPES, revisarLargos } from "@pinturapro/dominio"` (las claves ya coinciden: `titulo, descripcion, ubicacion, bio, nombre, notaCotizacion, comentarioResena`).
- De paso, `commission_amount: Math.round(amount * 0.1)` (`mutations.ts:247`) y
  `Math.round((toInt(amount) as number) * 0.1)` (`cotizar/[id].tsx:69`) → `comisionDe(amount)`.

**Cómo probarlo** (no se puede desde el Codespace): en una máquina con Expo, `pnpm install`,
`cd apps/mobile && npx expo start`, abrir en un teléfono (Expo Go) `/cotizar/[id]` y `/publicar`,
y repetir a mano los casos que ya vigila `reglas-compartidas.prueba.cjs` (`"150.000,50"`,
`"1,500,000"`, `"-99999"`) verificando que Metro no tira "Unable to resolve module" y que el
resultado no cambia. La prueba de sincronía deja de comparar dos implementaciones (que es un
parche) y pasa a comparar la misma función importada dos veces, con la deuda 100% cerrada.

## 2. Corte de `apps/web/lib/queries.ts` (1.516 líneas, 26 archivos lo importan)

Sin llamadas cruzadas entre las funciones exportadas (verificado con grep): cada una habla sola
con Supabase, así que el corte no tiene ciclos. Propuesta: `lib/queries/` con un `index.ts` que
re-exporta todo, para no tocar los 26 importadores.

| Módulo | Funciones | Líneas hoy |
|---|---|---|
| `base.ts` (compartido) | `dbError`, `BAJA`, `SUPA`, `levelFromRating`, `colorFor`, `formatARS`, `ErrorDeLecturaDeDatos` | 1-90, 321-350, 1133-1138 |
| `pintores.ts` | `getPainters`, `getPainterById` (+`PainterDetail`,`ReviewView`), `getPainterExtras`, `getOwnProfile` (+`OwnProfile`,`ErrorDeLecturaDePerfil`), `getReviewsForPainter` | 90-321, 375-483, 620-673 |
| `obras.ts` | `getProjects`, `getProjectBySlug`, `getProjectsByOwner`, `getOwnedProjectBySlug` (+`OwnedProjectForm`) | 146-235, 350-375, 570-620 |
| `pedidos.ts` | `getJobsForClient` (+`ClientJobView`), `getJobsForPainter` (+`JobView`), `getOpenServiceRequests` (+`ServiceRequest`), `getPedidosYaCotizados`, `getQuotesForClient` (+`QuoteView`), `getPedidosDelCliente` (+`PedidoPropio`), `getContactoDelTrabajo` (+`ContactoContraparte`), `getMiTelefono` | 483-570, 673-928, 1206-1368 |
| `contenido.ts` | `getFaqs`, `getResources` (+`ResourceKind`,`Resource`), `getNews` (+`NewsItem`) | 928-1056 |
| `resenas.ts` | `getRecentReviews` (+`Testimonial`) | 1056-1116 |
| `metricas-admin.ts` | `getLeads` (+`LeadView`), `getMetricasPlataforma`, `getVolumenMensual`, `getActividadReciente`, `getNumerosReales` | 1138-1206, 1368-1516 |

`dbError`/`SUPA` se usan en las 6 categorías por igual (confirmado por grep); `BAJA` en
pedidos/reseñas; `levelFromRating`/`colorFor` en pintores y en `getQuotesForClient` (línea 894,
porque esa consulta también arma el nivel del pintor — única dependencia cruzada real entre
módulos, y ya la resuelve importar `base.ts`).

**Otros que también pasan las 400 líneas** (sólo estos tres en todo `apps/web`):
`components/features/photo-simulator.tsx` (1.115, un solo componente — candidato a separar
lógica de canvas de la UI, no a este corte) y `app/(pro)/dashboard/actions.ts` (426, 5 Server
Actions — ya son unidades independientes, corte menor).

## 3. Copias que ya se desviaron o están por desviarse

- **Comisión, tercera copia sin atar** (IMPORTANTE, distinto de lo ya `corregido`): la web
  importa `comisionDe`/`COMISION` de `@pinturapro/dominio` (`apps/web/lib/utils.ts:1,31,34`,
  única fuente, con la prueba `reglas-compartidas` vigilando). El móvil hoy calcula `amount * 0.1`
  **hardcodeado dos veces**, sin ni siquiera una constante local:
  `apps/mobile/lib/mutations.ts:247` y `apps/mobile/app/cotizar/[id].tsx:69`. Da lo mismo que
  `COMISION = 0.1` por ahora, pero es exactamente el patrón que ya causó "se mostró 8% guardando
  10%" — dos lugares que nada ata. Se cierra solo con el cambio del punto 1.
- **`puedeCotizar`: la web y el móvil usan lógicas de signo opuesto** (IMPORTANTE). Web
  (`apps/web/app/(marketplace)/actions.ts:126`) usa `puedeCotizar(perfil.type)` de
  `packages/dominio/src/roles.ts:12` — **lista blanca**: sólo `painter`/`company` pueden. Móvil
  (`apps/mobile/lib/mutations.ts`, función `cotizar`) hace `if (perfil.type === "client") return
  error` — **lista negra**: todo lo que no sea `client` puede. Hoy coinciden porque sólo existen
  tres tipos, pero si se agrega un cuarto rol, el móvil lo dejaría cotizar por defecto y la web lo
  bloquearía por defecto. La barrera real es la policy `jobs_insert_painter_quote`
  (`es_pintor()`, migración 0016) en la base, así que no es explotable hoy — es una asimetría de
  diseño, no un agujero. Se corrige importando `puedeCotizar` en el mismo cambio del punto 1.
- **`mensajeDeError` del móvil le faltan 4 ramas** de `packages/dominio/src/errores.ts:44-53`
  (`full_name_largo`, `message_largo`, `email_largo`, `phone_largo`). En la práctica no se ven
  porque `revisarLargos` local ya frena esos campos antes de tocar la base con los mismos topes —
  pero es la misma clase de bug que ya pasó (`errores.ts:4-8`, la nota deja constancia). Se cierra
  con el mismo cambio.
- **`packages/color` no se puede probar sola todavía**: no tiene `pruebas.ts` propio (a
  diferencia de `packages/dominio`); su única medición, `simulador-calidad`, abre un Chrome real
  con `k.abrir()` (`tools/auditoria/regresiones/simulador-calidad.prueba.cjs:31`). Por el criterio
  de `docs/arquitectura.md` ("si para verificarla hay que levantar algo, no está separada de
  verdad"), está separada en código pero no en verificación.
- **Sin violaciones de dirección de dependencias**: ningún archivo de `packages/*/src` importa de
  `apps/` (grep sobre los tres paquetes, sin resultados reales). **`packages/ui` sigue sin
  consumidores** (ningún `package.json` de `apps/*` lo declara) — dato ya conocido, sigue igual.

## Nota

`docs/arquitectura.md` está desactualizado: en "Qué hay hoy" no lista `packages/dominio` (ya
existe hace rondas) y en "Lo que sigue" lo describe como pendiente. No lo edité (no corrijo
código/docs), pero el orquestador debería actualizarlo para que la próxima ronda no arranque de
un mapa viejo.
