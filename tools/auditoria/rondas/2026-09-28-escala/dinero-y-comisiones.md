# Dinero y comisiones — ronda 2026-09-28-escala

Agente `dinero-y-comisiones`. Leí `REGLAS.md` y `BITACORA.md` antes de empezar. No creé datos
de prueba (ZZAGENT): todo lo de abajo salió de leer código, migraciones, y de navegar con el
kit como `admin` para ver lo que ve el admin. No toqué la base con SQL directo, sólo API REST
con la clave anon para contar filas (`count=exact`, `Range: 0-0`), sin insertar nada.

---

## 1. Cómo se cobra la comisión — hoy no se cobra nada, y nadie ve la deuda por pintor

**Medido.** El checkout falso se retiró: `GET /checkout` → 404 (confirmado con el navegador).
`docs/pendientes/README.md` documenta por qué: prometía "el dinero queda retenido en garantía"
sin ningún backend de pago detrás. Bien retirado — dejarlo vivo era una promesa de escrow falsa,
que es riesgo legal, no sólo un bug.

**Lo que SÍ existe hoy** (medido en código):
- `cotizar()` calcula y guarda `commission_amount` en cada `job`
  (`apps/web/app/(marketplace)/actions.ts:130-137`), con `commissionFor` = `comisionDe` del
  paquete compartido (`packages/dominio/src/montos.ts:118-119`, `Math.round(monto * 0.1)`).
- El pintor ve la comisión **una sola vez, antes de enviar la cotización**: el aviso y el
  anuncio por voz en `apps/web/app/(marketplace)/trabajos/quote-form.tsx:36-43,130-138`. Es un
  cálculo del lado del cliente que nunca vuelve a mostrarse — ni en el resto del formulario, ni
  después.
- `/terminos` dice explícitamente "Comisión de la plataforma: 10%... **todavía no se cobra**:
  no hay medio de pago conectado. Cuando empiece a cobrarse te lo vamos a avisar antes" (texto
  visto en pantalla). Es honesto y coherente con el código: no hay ninguna promesa de cobro o
  garantía que el código no sostenga.
- El panel admin (`/panel`, medido con sesión `admin`, capturas de pantalla vía el kit) muestra
  un KPI **"Comisión generada"**: hoy `$2.783.000`, junto a "Volumen transado": `$27.830.000` —
  exactamente el 10%, sin desvío. Sale de `metricas_plataforma()` (migración `0012`, función SQL
  con `security definer`), que suma `commission_amount` de TODOS los `jobs` con
  `status = 'completed'` de la plataforma entera.

**Lo que NO existe, y es el hallazgo** (medido navegando como admin y pintor, y leyendo el
esquema):

1. **No hay ninguna vista por pintor.** `/admin` (`admin-client.tsx`) tiene sólo dos pestañas:
   "Consultas" y "Pintores". La tabla de pintores (`admin-client.tsx:88-102`) muestra Pintor,
   Nivel, Rating, Reseñas, Zona — **ninguna columna de plata**. El admin no tiene forma, en
   ningún lugar de la interfaz, de preguntar "¿cuánto me debe Diego Sosa?": sólo ve el total de
   la plataforma. Y no es que la RLS se lo permitiría fácil: el propio comentario de la
   migración 0012 dice que ni el admin puede contar los `jobs` de otros con su sesión normal
   (por eso existe la función `security definer`) — pero esa función sólo devuelve UN total
   agregado, no un `group by painter_id`.
2. **El pintor tampoco ve, después de cotizar, cuánto le van a cobrar por CADA trabajo.** Su
   panel (`apps/web/app/(pro)/dashboard/page.tsx:195`) muestra `formatARS(job.amount)` — el
   monto cotizado — para cada trabajo, en cualquier estado. `commission_amount` no se lee ni se
   muestra en ningún punto de ese archivo. El único momento en que el pintor ve su comisión es
   el aviso efímero del formulario, ANTES de que el trabajo exista. Una vez aceptado y
   completado, la comisión que se generó (y que el sistema ya calculó y guardó) desaparece de
   su vista.
3. **Completar un trabajo no dispara ningún aviso.** `marcarCompletado()`
   (`apps/web/app/(marketplace)/actions.ts:165-186`) — la acción que hace que un trabajo cuente
   como "transado" para `metricas_plataforma()` — no llama a `notifyUser` ni tiene ningún texto
   sobre comisión. Comparado con `cotizar()` y `aceptarCotizacion()`, que sí mandan mail, este
   es el único paso del ciclo de vida de un trabajo que no avisa a nadie de nada. Es exactamente
   el momento en que la deuda se vuelve real, y es mudo.
4. **No hay ningún estado de "pagado".** Revisé las 23 migraciones (`grep -n commission`): la
   tabla `jobs` (`0001_init.sql:49-57`) tiene `commission_rate` y `commission_amount`, pero no
   hay `commission_paid`, `paid_at`, ni ninguna tabla separada de pagos/deuda/ledger en todo
   `supabase/migrations/`. Aunque el dueño conectara un medio de pago mañana,
   `metricas_plataforma()` seguiría sumando `commission_amount` de TODO `job` completado **para
   siempre**, sin poder distinguir lo ya cobrado de lo pendiente: el KPI "Comisión generada" es
   en verdad "comisión generada desde el inicio de los tiempos", no un saldo.

**Qué falta como mínimo para poder cobrar** (esto es la decisión para el dueño, no un bug; lo
dejo como insumo concreto):

- Un estado por trabajo (`commission_paid boolean` / `paid_at timestamptz`, o una tabla
  `commission_payments` aparte) que separe lo devengado de lo cobrado. Sin esto, ni siquiera un
  cobro manual por transferencia tiene dónde anotarse sin tocar la base a mano.
- Una vista agregada **por pintor** (admin) de comisión pendiente: `sum(commission_amount)
  group by painter_id where status='completed' and not paid` — hoy no existe ni la función SQL
  ni la pantalla.
- Un aviso en el momento en que la deuda se genera (al completar el trabajo): mail, banner en
  `/dashboard`, o ambos. Hoy `marcarCompletado` es silencioso.
- Opcionalmente, que el propio pintor vea en su panel "Debés $X de comisión" por cada trabajo
  completado — hoy `commission_amount` se calcula y se guarda, pero nunca se le vuelve a
  mostrar.

**Funciona bien:** la aritmética coincide en los tres lugares donde se calcula (formulario,
`cotizar()`, y el check `0018` de la base) — verificado también por el agente
`integridad-datos` de esta misma ronda (0 discrepancias entre `commission_amount` y 10% de
`amount` en toda la tabla `jobs`). El texto de `/terminos` no promete nada que el código no
cumpla. Severidad de todo este punto: **IMPORTANTE** (no es un bug activo — no se está
cobrando de más ni de menos porque no se cobra nada — pero es la pregunta explícita del dueño
y hoy la respuesta es "no hay ni el dato mínimo para empezar a cobrar de forma prolija").

---

## 2. Números agregados a escala

**Lo que escala bien (medido).** Los KPIs de plata del panel admin —"Volumen transado" y
"Comisión generada" en `/panel`, más el gráfico de 12 meses— salen de `metricas_plataforma()` y
`volumen_mensual()` (`supabase/migrations/0012_metricas.sql`), dos funciones SQL que agregan
con `sum()`/`count()` del lado de Postgres sobre TODA la tabla `jobs`. La app nunca baja filas
para sumarlas: pide el resultado ya agregado. Esto no tiene el techo de 1.000 filas de la API
REST porque nunca hace una consulta de filas individuales. Verificado visualmente con sesión
`admin`: Volumen `$27.830.000`, Comisión `$2.783.000` — exactamente 10%, sin desvío.

**Redondeo por trabajo vs. sobre el total (medido en código, sin defecto).** `comisionDe`
(`packages/dominio/src/montos.ts:118-119`) redondea CADA trabajo por separado
(`Math.round(monto * 0.1)`), y `metricas_plataforma()` suma esos `commission_amount` ya
redondeados — no recalcula `round(sum(amount) * 0.1)` sobre el total. Es la forma contable
correcta (cada línea redondea como en cualquier factura) y no genera un sesgo sistemático: el
redondeo "al más cercano" empuja para arriba o para abajo con la misma probabilidad, así que con
miles de trabajos el error se compensa en vez de acumularse a favor de nadie. Probé montos que
caen justo en el medio (terminados en 5 centavos de punto porcentual, ej. `$125` → comisión
exacta `$12.5` → redondea a `$12` o `$13` según el redondeo bancario/estándar de `Math.round`,
que en JS redondea 0.5 siempre hacia arriba, `Math.round(12.5) === 13`): consistente en las tres
capas (formulario, `cotizar()`, check `0018` de la base, que tolera `abs(diferencia) <= 1`
exactamente por este redondeo).

**Lo que NO escala (deducido por código, corroborado por otros dos agentes de esta misma
ronda — `escala-y-volumen-base` y `escala-y-volumen-web` — que llegaron al mismo punto de forma
independiente).** `getNumerosReales()` (`apps/web/lib/queries.ts:1490-1516`) hace:

```ts
supabase.from("reviews").select("rating")   // línea 1498 — SIN .limit() ni .order()
```

para promediar TODAS las reseñas de la plataforma y mostrar, en la portada pública
(`apps/web/app/page.tsx:87,101-103`), "Promedio de **N** reseñas" con la nota calculada. Es la
ÚNICA consulta de todo `queries.ts` sin un `.limit(N)` explícito — todas las demás (`getPainters`
60, `getProjects` 60, `getJobsForPainter`/`getJobsForClient` 50, `getReviewsForPainter` 30,
`getFaqs` 50, `getLeads` 100…) llevan un tope con un comentario que lo justifica. Medido: hoy hay
**20 reseñas** en la base (confirmado por API REST con `count=exact`), muy lejos del límite de
1.000 filas por consulta que impone por defecto la API REST de Supabase/PostgREST — así que HOY
el número que se ve en la portada es correcto. No pude reproducir el corte sin crear más de
1.000 reseñas reales (exigiría igual cantidad de trabajos completados con reseña, inviable para
un agente de auditoría sin tocar datos ajenos), así que este punto queda **deducido, no
observado en producción**. Pero la causa es inequívoca por lectura de código: pasadas ~1.000
reseñas, la consulta devuelve como máximo 1.000 filas y el promedio/contador de la portada queda
calculado sobre un subconjunto — y al no haber `.order()`, ni siquiera es un subconjunto
estable: podría variar de una visita a otra según cómo Postgres decida devolver las filas. No
mueve `commission_amount` ni ningún número de plata, lo incluyo porque el pedido de esta ronda
señaló específicamente esta función y porque contrasta con lo que sí está bien resuelto (el
panel de plata del admin, arriba). **Severidad: IMPORTANTE a futuro, sin efecto medible hoy.**

**Un segundo caso, más chico, de la misma familia (medido en código).** `getJobsForPainter`
(`apps/web/lib/queries.ts:693-704`) y `getJobsForClient` (`apps/web/lib/queries.ts:495-508`)
traen como máximo **50** filas, ordenadas por `created_at desc` (las más recientes; se
descartan las más viejas si hay más de 50). El comentario dice "tope: los ids alimentan `.in()`
derivados" — pensado para acotar las consultas de nombres/proyectos que dependen de esos ids,
NO para contar. Pero `apps/web/app/(pro)/dashboard/page.tsx:73-74` y
`apps/web/app/(pro)/cliente/page.tsx:61-63` usan ese arreglo ya recortado para calcular, del
lado de React, "Trabajos completados", "Trabajos activos" y "Pintores contratados" con
`.filter(...).length`. Un pintor o cliente con más de 50 trabajos en su historial vería esas
tres métricas de SU PROPIO panel clavadas por debajo del número real (los trabajos completados
más viejos son justo los que se caen del corte, porque el orden es por fecha descendente). No
afecta `commission_amount` ni ningún número que vea el admin o que se facture — verifiqué que el
nivel del pintor (`LevelBadge`) sale de `profiles.rating`/`rating_count`, cacheados por trigger
en la base, no de este conteo — así que no hay impacto de plata ni de status del pintor.
**Severidad: MENOR**, y lo marco sólo porque el pedido de esta ronda pregunta explícitamente por
"algún promedio o suma calculado en la app bajando filas": es exactamente ese patrón, aunque acá
el tope (50, no 1.000) tarda mucho más en tocarse y sólo desinforma al dueño de esos datos, no a
terceros.

---

## 3. Topes de montos (`MONTO_MAXIMO`) contra paneles y mails

**Probado en código (Node), sin encontrar ningún defecto.** `MONTO_MAXIMO = 1_000_000_000`
(`packages/dominio/src/montos.ts:19`). Formateo probado en los dos lugares que existen:

| Función | Entrada | Salida |
|---|---|---|
| `ars()` (`actions.ts`, mails) | `1_000_000_000` | `$1.000.000.000` |
| `ars()` | `999_999_999` | `$999.999.999` |
| `formatARS()` (`queries.ts:1133-1136`, panel) | `1_000_000_000` | `$ 1.000.000.000` |
| `comisionDe(1_000_000_000)` | — | `100.000.000` → `formatARS` → `$ 100.000.000` |
| Suma de 2.000 trabajos al tope (`sum(amount)` simulando `metricas_plataforma`) | `2 × 10^12` | `$ 2.000.000.000.000`, `Number.isSafeInteger` = `true` |

Ningún caso corta, trunca ni cae en notación científica: los dos formateadores usan
`toLocaleString("es-AR")` / `Intl.NumberFormat`, que manejan números grandes sin ayuda extra, y
no hay ningún lugar del código que divida por 1.000/1.000.000 para abreviar en "K"/"M" (busqué
ese patrón y no aparece). Tampoco hay riesgo de desborde en la base: `amount` y
`commission_amount` son `int4` (máximo ~2.147 millones), pero el check `0018_comision_y_permisos.sql:44`
exige `amount <= 1000000000`, muy por debajo del límite de la columna, y el `sum()` de Postgres
sobre una columna `int4` promueve automáticamente a `bigint` — no hay overflow ni sumando miles
de trabajos al tope. **No encontré ningún hallazgo en este punto.**

---

## Resumen de severidad

- **IMPORTANTE** — No hay ninguna vista de deuda por pintor (ni para el admin ni para el
  pintor), no hay estado "pagado", y completar un trabajo no avisa a nadie. Es la decisión que
  pide el dueño; el mínimo para empezar a cobrar de forma prolija está detallado en el punto 1.
- **IMPORTANTE (a futuro, sin efecto hoy)** — `getNumerosReales` (`queries.ts:1490-1516`) se
  rompe pasadas ~1.000 reseñas por no tener `.limit()`/`.order()`; hoy hay 20, así que el número
  público de la portada es correcto. Deducido por código, corroborado por otros dos agentes de
  esta ronda.
- **MENOR** — Los contadores "Trabajos completados/activos" de los paneles propios de pintor y
  cliente (`dashboard/page.tsx`, `cliente/page.tsx`) se calculan sobre un recorte de 50 trabajos
  más recientes; a partir del trabajo 51 en el historial de una misma persona, esas tres cifras
  quedan por debajo de la realidad. No toca plata ni el nivel del pintor.
- **Sin hallazgos** — Formateo de montos grandes en panel y mails (`MONTO_MAXIMO` y sus
  múltiplos), y el redondeo de la comisión por trabajo vs. sobre el total (no hay sesgo
  acumulativo). Los KPIs de plata del panel admin (`metricas_plataforma`, `volumen_mensual`)
  agregan en SQL y escalan bien a miles de trabajos.

## Qué es medido y qué es deducido (resumen)

- **Medido** (código + navegador con sesión `admin`/API REST anon): estado de `/checkout`
  (404), contenido de `/panel` y `/admin`, ausencia de columna de plata en "Pintores", ausencia
  de `commission_amount` en `/dashboard` del pintor, ausencia de notificación en
  `marcarCompletado`, esquema de `jobs` en las 23 migraciones, cantidad actual de reseñas (20),
  formateo de montos grandes.
- **Deducido** (lectura de código, sin poder reproducir en esta base de datos): el corte de
  `getNumerosReales` en 1.000 filas — necesitaría más de 1.000 reseñas reales para observarse.
