# App móvil — verificación del plan "importar @pinturapro/dominio" (ronda 2026-09-28-escala)

Encargo: revisar con evidencia el punto 1 de `arquitectura-modular.md` antes de que el
orquestador lo aplique. Todo lo de abajo es **por código**, salvo lo marcado "medido en
sandbox" (pruebas reales de `npm`/`pnpm` en `/tmp`, fuera del repo, sin tocar el servidor
compartido ni el proyecto).

## Veredicto

**El plan es seguro con UN ajuste obligatorio**: no usar `"workspace:*"` en
`apps/mobile/package.json`. Usar `"file:../../packages/dominio"`. El resto del plan
(Metro/Babel, las cuatro funciones, EAS) se sostiene.

## 1. `apps/mobile` y el workspace

- **`pnpm-workspace.yaml`** (raíz): `packages: ["apps/*", "packages/*"]` → `apps/mobile` SÍ es
  miembro del workspace pnpm. Confirmado leyendo el archivo.
- **`apps/mobile/node_modules/@pinturapro` no existe hoy** (`ls` da "No such file or
  directory"); `apps/web/node_modules/@pinturapro/{color,dominio}` sí están symlinkeados. Es
  decir: nadie corrió `pnpm install` en la raíz después de que `apps/mobile/package.json`
  quedara sin la dependencia — coherente con que hoy no está declarada.
- **`apps/mobile` no tiene lockfile propio** (ni `package-lock.json` ni `pnpm-lock.yaml`
  dentro de la carpeta). El único lockfile del repo es `/pnpm-lock.yaml`, en la raíz, y el
  `package.json` raíz no declara `"workspaces"` (campo que sólo npm/yarn/bun leen); usa
  `"packageManager": "pnpm@9.0.0"`.

### `"workspace:*"` rompe `npm install`, MEDIDO (no deducido)

`CLAUDE.md` y `docs/mobile-plan.md` instruyen `cd apps/mobile && npm install`. Reproduje esa
instrucción exacta en un sandbox con la misma profundidad de carpetas (`apps/mobile` y
`packages/dominio`, dos niveles bajo la raíz) y `npm 11.9.0` (el que hay en este entorno):

```
npm error code EUNSUPPORTEDPROTOCOL
npm error Unsupported URL Type "workspace:": workspace:*
```

Pasa **igual con o sin** un `"workspaces"` declarado en el `package.json` raíz, e **igual
corriendo `npm install` desde la raíz o desde `apps/mobile`**: npm 11 no entiende el
protocolo `workspace:` en ningún caso (es de pnpm/Yarn). La guía oficial de Expo
("Work with monorepos", docs.expo.dev, actualizada 25/9/2026) dice que "Bun, npm y pnpm
soportan `workspace:*`", pero lo medido con la versión real de npm de este proyecto contradice
esa frase — puede ser una versión más nueva de npm, o una imprecisión de la doc. **Lo que
importa acá es lo medido**: si el orquestador aplica `"@pinturapro/dominio": "workspace:*"`
tal cual dice `arquitectura-modular.md`, cualquiera que siga `CLAUDE.md` al pie de la letra
ve ese error y la instalación no termina. No es algo que vea un usuario final en el teléfono;
es un bloqueo para quien desarrolla o compila la app (y, si el paso de instalación de EAS
Build cae a npm en vez de pnpm, también ahí).

### La alternativa segura, MEDIDA en los dos escenarios

`"@pinturapro/dominio": "file:../../packages/dominio"` (relativo desde `apps/mobile/package.json`
hasta `packages/dominio`, que es exactamente la distancia real: dos `..` para llegar a la
raíz).

- **`npm install` standalone en `apps/mobile`** (sin que npm sepa nada del workspace pnpm):
  instala limpio, crea `node_modules/@pinturapro/dominio -> ../../packages/dominio` (symlink),
  y `require.resolve("@pinturapro/dominio")` resuelve al `main` real
  (`packages/dominio/src/index.ts`). Medido.
- **`pnpm install` desde la raíz del monorepo** (el flujo real de la web/CI, con
  `pnpm-workspace.yaml` presente): mismo resultado, mismo symlink. pnpm trata un `file:` local
  que cae dentro del workspace igual que `workspace:*` en la práctica (sin el chequeo de rango
  semver que hace `workspace:`, pero acá no hace falta: es un paquete interno sin versión
  publicada). Medido.

Es la misma sintaxis que ya sugería la consigna de la tarea, ahora confirmada con las dos
herramientas reales.

### EAS Build

`apps/mobile/eas.json` ya está en el lugar correcto: la doc oficial de Expo ("Set up EAS Build
with a monorepo", actualizada 26/6/2026) exige que `eas.json` viva "en la raíz de la carpeta de
la app" — es decir `apps/mobile/eas.json`, no la raíz del repo. Eso ya está bien, sin cambios.

Sobre "sube sólo la carpeta o el repo entero": la misma doc, en el mismo párrafo, da el
ejemplo oficial de un `postinstall` que hace `cd ../.. && yarn build` para compilar paquetes
hermanos del monorepo — lo que sólo tiene sentido si **el monorepo completo está presente en
el disco del builder**, no sólo `apps/mobile`. Es la única evidencia directa que hay (no hay
una build real para confirmarlo desde este entorno): el repo entero llega al builder, así que
`packages/dominio` va a estar ahí. Lo que no pude confirmar (deducido, no medido) es si el
paso de instalación de EAS detecta el `pnpm-lock.yaml` de la raíz y corre `pnpm install` ahí
(en cuyo caso `workspace:*` también funcionaría en EAS), o si instala con npm dentro de
`apps/mobile` sin lockfile propio (en cuyo caso repetiría el error de arriba). Por eso la
recomendación es `file:...` igual: funciona en los dos mundos sin apostar a cuál detecta EAS.

## 2. Metro/Babel sí transpila un paquete `.ts` sin compilar fuera de `apps/mobile`

Confirmado leyendo el código fuente instalado (`node_modules/.pnpm/@expo+cli@0.22.28`,
`@expo+metro-config@0.19.12`, `@expo+config@10.0.11`, `@react-native+metro-babel-transformer@0.76.5`)
y contrastado con la doc oficial de Expo:

- **Detección de monorepo sin `metro.config.js`**: no hay ningún `metro.config.js` en
  `apps/mobile`. `@expo/cli` (`instantiateMetro.js`) hace
  `hasConfig.isEmpty ? getDefaultConfig(projectRoot) : undefined` — si no hay archivo de
  config, usa el default de `@expo/metro-config`, que llama a `getMetroServerRoot()`
  (`@expo/config/paths.js`) → `resolveWorkspaceRoot()`, un paquete que busca **literalmente
  `pnpm-workspace.yaml`** (lo confirmé con `grep` sobre su bundle) entre otros marcadores de
  monorepo. Encuentra el de la raíz del repo y agrega `packages/*` a `watchFolders` y a
  `nodeModulesPaths` (`getWatchFolders.js`, `getModulesPaths.js`). La doc oficial de Expo
  ("Work with monorepos") lo confirma en texto: desde SDK 52 esto es automático, "no tenés que
  configurar Metro a mano". Coincide con lo que ya afirmaba `arquitectura-modular.md`.
- **La diferencia real con Next.js/`transpilePackages`**: Next (webpack/SWC) excluye
  `node_modules` de la transformación por defecto, por eso `apps/web/next.config.js` necesita
  `transpilePackages: ['@pinturapro/color', '@pinturapro/dominio']` explícito. Metro **no**
  tiene esa exclusión: el transformer de babel
  (`@react-native/metro-babel-transformer/src/index.js`, función `buildBabelConfig`) arma UNA
  sola configuración de babel (la de `apps/mobile/babel.config.js`, extendida) y la aplica a
  **todos** los archivos que bundlea, sin importar si están en `node_modules` o no — sólo
  desactiva el plugin de Fast Refresh cuando el path contiene `node_modules` (una diferencia
  cosmética, no funcional). Y detecta `.ts`/`.tsx` por extensión (`isTypeScriptSource`) para
  parsearlos con soporte de tipos antes de transformarlos igual. No hace falta ningún
  `transpilePackages` equivalente en RN.
- **Nada en `packages/dominio/src/*.ts` usa APIs de Node o del DOM** (leí las seis fuentes:
  `montos.ts`, `topes.ts`, `errores.ts`, `roles.ts`, `entrada.ts`, `imagen.ts`): sólo
  `Uint8Array`, regex, `String`, `Math`, y un `typeof FormData !== "undefined"` que es seguro
  aunque `FormData` no exista. Nada que rompa el bundle de React Native.

## 3. Comparación función por función (firma y comportamiento)

| Móvil (copia local) | Paquete (`@pinturapro/dominio`) | Resultado |
|---|---|---|
| `toInt(v: string): number \| null` (`mutations.ts:92-121`) | `montoDesdeTexto(v: unknown): number \| null` (`montos.ts`) | **Idénticas byte a byte** en el cuerpo (mismas 13 líneas de reglas, mismo orden, mismo `MONTO_MAXIMO`/`1_000_000_000`). Sólo cambia el tipo del parámetro (`string` → `unknown`), que no afecta en runtime y es compatible en todos los call sites actuales (`string` es asignable a `unknown`). `toInt("-99999")` → `null` en las dos; `toInt("1,500,000")` → `null` en las dos (antes del arreglo del parser (BITÁCORA, "El parser de montos adivinaba en vez de rechazar") daba `1`, ya corregido en ambas copias); `toInt("150.000,50")` → `150000` en las dos. Reemplazo directo: `import { montoDesdeTexto as toInt } from "@pinturapro/dominio"`. |
| `mensajeDeError(error)` (`mutations.ts:21-63`) | `mensajeDeError(error)` (`errores.ts`) | El paquete es un **superconjunto estricto**: mismas 7 ramas que ya tiene el móvil (23505, 23514 con 6 sub-casos, "ya tiene un pintor asignado", 40P01, 42501, "Transición no permitida", monto/comisión, fetch failed, default) **más 4 ramas de 23514 que al móvil le faltan** (`full_name_largo`, `message_largo`, `email_largo`, `phone_largo`). El orden de los `if` difiere entre las dos copias, pero cada condición mira un `code`/patrón mutuamente excluyente, así que el orden no cambia el resultado para ningún caso existente. Reemplazo directo, sin pérdida de comportamiento y con 4 mensajes nuevos traducidos. |
| `TOPES`/`revisarLargos` (`mutations.ts:129-157`) | `TOPES`/`revisarLargos` (`topes.ts`) | El paquete tiene 3 claves más (`mensaje`, `email`, `telefono`) que el móvil hoy no usa. Las 7 claves que el móvil SÍ usa (`titulo`, `descripcion`, `ubicacion`, `bio`, `nombre`, `notaCotizacion`, `comentarioResena`) tienen el **mismo valor numérico** en las dos copias. La función itera distinto (`Object.entries` vs `Object.keys`) pero hace la misma cuenta (`(valor ?? "").length > TOPES[campo]`) y arma el mismo mensaje (`"${nombre legible} no puede superar los ${tope} caracteres."`, con el mismo texto de "nombre legible" para las 7 claves compartidas). Reemplazo directo: `import { TOPES, revisarLargos } from "@pinturapro/dominio"`. |
| `Math.round(amount * 0.1)` (`mutations.ts:247`) y `Math.round((toInt(amount) as number) * 0.1)` (`cotizar/[id].tsx:69`) | `comisionDe(monto: number): number` = `Math.round(monto * COMISION)`, `COMISION = 0.1` (`montos.ts`) | Mismo cálculo, mismo redondeo, misma constante `0.1`. Después del `if (!amount) return...` de `cotizar()`, `amount` queda tipado `number` (no `null`), así que `comisionDe(amount)` encaja sin casteos extra. Reemplazo directo. |
| `if (perfil.type === "client") return error` (lista negra, `mutations.ts:234-236`) | `puedeCotizar(tipo): boolean` = `tipo === "painter" \|\| tipo === "company"` (lista blanca, `roles.ts`), con `MOTIVO_NO_PUEDE_COTIZAR` = `"Las cotizaciones las envían los pintores. Tu cuenta es de cliente."` (texto **idéntico**, carácter por carácter, al que ya devuelve el móvil) | Mencionado en `arquitectura-modular.md` punto 3, no era parte de los 4 nombres pedidos pero se cierra con el mismo cambio: cambia de lista negra a lista blanca, sin diferencia de comportamiento hoy (sólo existen `client`/`painter`/`company`), pero deja de depender de que ningún cuarto rol aparezca sin actualizar el móvil. |

**No hay ninguna diferencia de comportamiento con texto inválido**: las dos copias de la
función de montos devuelven `null` (nunca `NaN`, nunca `0`, nunca lanzan) ante cualquier
entrada ambigua o vacía — confirmado leyendo las dos implementaciones línea por línea, son la
misma.

## 4. El diff exacto para el orquestador

**`apps/mobile/package.json`** — agregar en `dependencies` (no importa la posición
alfabética, pero por prolijidad va antes de `@react-native-async-storage`):

```diff
   "dependencies": {
+    "@pinturapro/dominio": "file:../../packages/dominio",
     "@react-native-async-storage/async-storage": "1.23.1",
     "@supabase/supabase-js": "^2.45.4",
     "expo": "~52.0.0",
```

**`apps/mobile/lib/mutations.ts`**:

- Línea 1, después del import de `supabase`, agregar:
  ```ts
  import {
    montoDesdeTexto as toInt,
    mensajeDeError,
    comisionDe,
    TOPES,
    revisarLargos,
    puedeCotizar,
    MOTIVO_NO_PUEDE_COTIZAR,
    type TipoDePerfil,
  } from "@pinturapro/dominio";
  ```
  **Ojo con este paso**: `import { montoDesdeTexto as toInt } from "..."` crea un binding
  local usable, pero **no** lo re-exporta solo. `apps/mobile/app/cotizar/[id].tsx:4` hace
  `import { cotizar, toInt } from "@/lib/mutations"`, así que hace falta agregar
  `export { toInt };` en algún punto del archivo (por ejemplo, junto al resto de los
  `export function`) o el import de la pantalla se rompe con "toInt is not exported".
- Borrar líneas 12-63 (comentario + función `mensajeDeError` local).
- Borrar líneas 75-121 (comentario + función `toInt` local).
- Borrar líneas 123-157 (comentario + `TOPES` + `NOMBRE_DEL_CAMPO` + `revisarLargos` locales).
- Línea 233-236, reemplazar:
  ```diff
  -  if ((perfil as { type?: string } | null)?.type === "client") {
  -    return { error: "Las cotizaciones las envían los pintores. Tu cuenta es de cliente." };
  -  }
  +  if (!puedeCotizar((perfil as { type?: TipoDePerfil } | null)?.type)) {
  +    return { error: MOTIVO_NO_PUEDE_COTIZAR };
  +  }
  ```
- Línea 247:
  ```diff
  -    commission_amount: Math.round(amount * 0.1),
  +    commission_amount: comisionDe(amount),
  ```

**`apps/mobile/app/cotizar/[id].tsx`**:

- Línea 4, agregar una línea debajo:
  ```diff
   import { cotizar, toInt } from "@/lib/mutations";
  +import { comisionDe } from "@pinturapro/dominio";
  ```
- Línea 69:
  ```diff
  -              {formatARS(Math.round((toInt(amount) as number) * 0.1))}.
  +              {formatARS(comisionDe(toInt(amount) as number))}.
  ```

Después de aplicar: `pnpm install` desde la raíz (crea el symlink en
`apps/mobile/node_modules/@pinturapro/dominio`). No se puede correr `npx expo start` ni probar
en un teléfono desde este entorno — queda para quien tenga Expo Go a mano, repitiendo los
casos de `reglas-compartidas.prueba.cjs` (`"150.000,50"`, `"1,500,000"`, `"-99999"`) contra
`/cotizar/[id]` y `/publicar`.

## 5. Migraciones 0021-0023: sin impacto en el móvil

`grep -rn "is_admin|leads|recalc_profile_rating" apps/mobile` no devuelve nada. Ni
`lib/queries.ts` ni `lib/mutations.ts` ni ninguna pantalla leen `is_admin`, insertan en
`leads` ni llaman `recalc_profile_rating`. Las tres cosas que ahora dan 401 (0021 son sólo
índices, sin cambio de permisos) no las toca la app móvil hoy. Sin hallazgo.

## Qué desaparecería solo con `packages/datos` compartido

Si `queries.ts`/`mutations.ts` del móvil se reemplazaran por un paquete compartido (el
`packages/datos` que menciona `docs/arquitectura.md` como pendiente), desaparecerían de raíz
las 5 diferencias de la tabla del punto 3 — hoy cada una necesita que alguien recuerde tocar
el móvil a mano cada vez que cambia la web (es exactamente lo que ya pasó con el parser de
montos y con los triggers de 0009). La comparación función-por-función de este reporte deja de
tener sentido porque no habría dos implementaciones para comparar: habría una sola,
importada dos veces. Mientras tanto, con sólo `packages/dominio` (este cambio), la superficie
que puede desincronizarse baja mucho pero no desaparece: las *queries* (lecturas de Supabase)
siguen duplicadas entre `apps/web/lib/queries.ts` y `apps/mobile/lib/queries.ts`, y esas no
las tocó este plan.
