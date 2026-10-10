# dinero-y-comisiones · etapa 3 de la suscripción (transferencia) · 8/10/2026

Código auditado: commit `301ebfd` (+ `58735e4`, sólo BITÁCORA). Base: **local** (`127.0.0.1:54321/54322`, 0001-0027).
La base en vivo no se tocó (ni se leyó `apps/web/.env.local`). Web: el :3000 compartido. Nada del producto se editó.
Scripts y capturas: `tools/auditoria/.salida/dinero-y-comisiones/` (cada hallazgo dice cuál lo reproduce).

Marcas: **[medido]** = lo corrí contra la web/base local y copié el número; **[deducido]** = sale de leer el código, sin
poder dispararlo del todo; **[sintético]** = con un CSV o una entrada armada por mí, no con un banco real.

## Resumen: lo que encontré, de mayor a menor

| # | Sev. | Qué pasa | Plata en juego (caso real) | |
|---|---|---|---|---|
| D1 | IMPORTANTE | Una misma transferencia se acredita dos veces si el dueño la confirma a mano ("Llegó") y después carga el extracto que la trae (o la misma plata en otra exportación) | Un mes gratis = **$7.700** por duplicado, y el "ingreso del mes" inflado en lo mismo. Medido: 1 transferencia real de $7.700 → 3 filas en el libro ($23.100) y 92 días de acceso | medido |
| D2 | IMPORTANTE | El aviso de transferencia **no vence nunca**: el extracto se compara contra su precio viejo, "Mi plan" lo sigue mostrando y esconde "Ya transferí" | Dólar +9,7 % a los 20 días: el pintor paga **$7.469** de un plan de **$8.500** y se confirma solo (**−$1.031, 12,1 %**). Con el dólar a la baja, el que paga el precio de hoy queda "a revisar" | medido |
| D3 | IMPORTANTE | "Llegó" registra en el libro el monto **del aviso**, no lo recibido; el extracto sabe lo recibido pero no lo guarda | Libro por encima de lo cobrado: +$400 (transfirió $8.000, libro $8.400), +$700 (transfirió $7.000, libro $7.700), +$231 en cada pago legítimo del 97 % | medido |
| D4 | IMPORTANTE (privacidad, no es plata perdida) | El pintor lee su fila del libro por la API, y trae la **línea entera del extracto con el SALDO de la cuenta del negocio** | Cada pintor que paga ve cuánta plata tenía el dueño en el banco cuando transfirió (medido: `…;7.700,00;1.234.567,00`) y el UUID del admin | medido |
| D5 | MENOR hoy → IMPORTANTE con tráfico | Si falla algo entre anotar el pago y recalcular el acceso, el pintor queda **pagado y sin acceso**, sin forma de arreglarlo desde la web (el reintento dice "ya estaba"); la única salida duplica | un mes de acceso retenido ($7.700) o un mes de más al repararlo | medido (falla forzada) |
| D6 | MENOR hoy → IMPORTANTE con transferencias antes del corte | Un pago hecho antes de que exista la fecha de fin del lanzamiento no se recalcula cuando el dueño la fija | 44 días pagos sin acceso en el ejemplo (hasta un mes, $7.700, por pintor) | medido + dominio |
| D7 | MENOR hoy (latente) → IMPORTANTE al sumar Mercado Pago | `recalcularAcceso` suma los pagos de **prueba** del libro y los guarda como acceso de producción | un mes por cada pago sandbox: medido con 1 pago real + 1 de prueba → **61 días** | medido |
| D8-D16 | MENOR | Ver tabla más abajo (redondeo sin explicar, fecha del libro = hora de procesar, deriva de 3 días/año, código recortado, extractos raros, etc.) | pesos, no miles | medido / sintético |

Lo que **no** encontré: el JS y el SQL del precio coinciden en 3.000.000 de cotizaciones; el 97 % es exacto; `sumarMes` coincide con
Postgres en 52.609 instantes; el parser del extracto no leyó más de lo real con ninguno de los formatos de banco argentinos probados (la excepción teórica es el de tres decimales al estilo EE.UU., D14-d); la comisión no puede volver
por la API; el pintor no puede escribir en nada del cobro. Detalle y tablas al final.

---

## D1 · La misma transferencia suma dos meses (a mano + extracto, o dos exportaciones)  — IMPORTANTE [medido]

**Entrada exacta** (script `flujo-b1.cjs`): pintor ZZAGENT, dólar 1540, "Ya transferí" → aviso $7.700 (`PP-0021`). El dueño toca **"Llegó"**.
Después carga un extracto con la línea que trae ESA transferencia: `08/10/2026;TRANSF RECIBIDA PP-0021 …;;7.700,00;100.000,00`.

| Paso | Qué salió | Qué debería |
|---|---|---|
| "Llegó" | libro: `manual:592cb1a4…` $7.700; acceso hoy + 31 días | igual |
| extracto con la misma plata | **"1 confirmadas"**; libro: 2ª fila `extracto:ce2a31…` $7.700; acceso hoy + **61** días | "ya cargada": 0 confirmadas, 31 días |
| la misma plata en OTRA exportación del banco (`7700,00;100000,00` en vez de `7.700,00;100.000,00`) | **"1 confirmadas"**; 3ª fila; acceso hoy + **92** días | "ya cargada" |
| el mismo archivo otra vez (control) | "1 ya cargadas antes" | igual (esto sí lo frena) |

En el banco entró UNA transferencia de $7.700; el libro suma $23.100 y el pintor tiene tres meses.

**Dónde:** `apps/web/lib/pagos/transferencia.ts:192` (la confirmación a mano usa `eventoId = manual:<cobro>`) y `:230` (el extracto usa
`extracto:<sha256 del texto de la línea>`): son dos llaves que no se conocen. `:241-261`: si no hay cobro abierto (porque "Llegó" lo dejó
`pagado`), arma otro con el precio de hoy (`avisarTransferencia`) y, como 7.700 ≥ 97 % de 7.700, lo confirma. La llave del extracto es el
texto crudo: cualquier cambio de formato del mismo movimiento (miles, saldo, espacios) es otra línea.

**Plata:** $7.700 de acceso regalado por cada duplicado (al dólar de hoy) + el mismo importe de más en "Ingreso del mes"
(`metricas_suscripciones`, 0027:598; /admin y /panel). Cuándo ocurre: cada vez que el dueño confirma a mano algo que después
aparece en un extracto (lo normal si usa "Llegó" mientras espera el extracto del mes). **[deducido]** La inversa también es una
trampa: si el extracto cobra una transferencia sin aviso y el pintor aprieta "Ya transferí" después, queda un "Esperando" que el
dueño puede confirmar de nuevo.

**Arreglo sugerido:** antes de acreditar una línea, buscar en el libro un cobro del mismo pintor y monto de los últimos ~25 días y pedirle
confirmación al dueño; que "Llegó" guarde fecha y monto para poder emparejar la línea.

## D2 · El aviso nunca vence: se valida contra el precio viejo  — IMPORTANTE [medido]

**Entrada exacta** (`flujo-b2.cjs`): aviso con el dólar a 1540 → $7.700 (`PP-0023`). Se lo envejece 20 días (`created_at`, `vence_en` en el
pasado; el estado sigue `pendiente`). Entra un dólar a 1690 (+9,7 %: no llega al 10 %, queda vigente solo) → precio de hoy **$8.500**.
- "Mi plan" muestra a la vez `Monto de hoy $ 8.500` y `Esperamos $ 7.700 con el código PP-0023`, y **no hay botón "Ya transferí"**.
- El extracto trae `…;7.469,00;…` (el 97 % del aviso viejo): **"1 confirmadas"**, libro $7.469 con la cotización VIEJA (id 62), 31 días de acceso.
- **Pagó $7.469 de $8.500: faltan $1.031 (12,1 %).** Un aviso al día perdería como máximo el 3 % ($255).

| Suba del dólar sobre 1540 | Precio de hoy | Paga (97 % del aviso viejo) | Se pierde | % del precio |
|---|---|---|---|---|
| 1 % | $7.800 | $7.469 | $331 | 4,2 % |
| 2 % | $7.900 | $7.469 | $431 | 5,5 % |
| 5 % | $8.100 | $7.469 | $631 | 7,8 % |
| 8 % | $8.400 | $7.469 | $931 | 11,1 % |
| 9,9 % | $8.500 | $7.469 | $1.031 | 12,1 % |

**Con el dólar a la baja** (1540 → 1400, −9,1 %, precio de hoy $7.000): el pintor transfiere lo que ve en "Monto de hoy" ($7.000) =
90,9 % del aviso viejo → "1 para revisar". Si el dueño toca "Llegó", el libro anota **$7.700** (ver D3). Hasta −3 % confirma solo ($7.500 = 97,4 % del aviso viejo);
a −5 % ya cae a revisar ($7.400 = 96,1 %).

**Dónde:** `transferencia.ts:241-250` busca "el cobro más reciente" en estados `pendiente|a_revisar|vencido` **sin mirar `vence_en`**; nada
escribe `vencido` (no existe `conciliar.ts`, solo está el valor del enum, 0027:159); `apps/web/lib/queries/suscripciones.ts:303-309`
(`getMisPagos`) tampoco mira `vence_en`, y `plan/page.tsx:157-165` esconde `YaTransferi` mientras haya un aviso, por viejo que sea.
`plan/actions.ts:42` le promete al pintor "Este monto vale hasta el 11/10/2026" y el extracto no lo respeta.

**Plata:** $330-$1.030 por pago en los casos de arriba; mientras no corra el job de vencimiento (etapa 5), cualquier aviso olvidado
sirve de precio fijo para siempre.

## D3 · "Llegó" anota lo pedido, no lo recibido  — IMPORTANTE (contable) [medido]

`flujo-a.cjs` (A2/A3): precio visto $8.000 (dólar 1585), al avisar el dólar ya estaba en 1680 → aviso **$8.400**. El pintor transfiere $8.000
(= 95,2 %) → extracto: "1 para revisar". El dueño toca "Llegó": libro `monto_ars = 8400`, `linea_extracto = null`. Transfirió 8.000, el
libro dice 8.400 (**+$400**). En `flujo-b2.cjs` (B3.4): transfirió $7.000, libro **$7.700 (+$700)**. Y aunque la transferencia haya sido
legítima del 97 % ($7.469), "Llegó" anota $7.700 (+$231), mientras que por extracto anota $7.469.

**Dónde:** `transferencia.ts:190` (`monto: c.monto_ars`). Al marcar `a_revisar` (`:264`) el monto recibido (`l.monto`) se pierde: ni el
dueño lo ve en la lista (`admin-client.tsx` solo muestra "Monto pedido") ni se guarda.
**Plata:** el libro es lo que se factura y lo que suma "Ingreso del mes": queda por encima de lo cobrado en esa diferencia.

## D4 · El pintor lee la línea del extracto, con el saldo de la cuenta del negocio  — IMPORTANTE (privacidad) [medido]

`flujo-b5.cjs`: pintor con sesión y clave anon → `GET /rest/v1/pagos_suscripcion?select=…` → 200:
`{"linea_extracto":"08/10/2026;TRANSF RECIBIDA PP-0045 JUAN PEREZ CUIT 20-12345678-9;;7.700,00;1.234.567,00","confirmado_por":"d0b1d5da-…",…}`.
La última columna es el **saldo de la cuenta del banco**; también viaja cualquier otro texto de la línea y el UUID de la cuenta admin.
**Dónde:** columna `linea_extracto` (0027:209), `grant select … pagos_suscripcion to authenticated` a nivel tabla (0027:633) +
`pagos_propios` (0027:660); se guarda en `transferencia.ts:156`.
**Arreglo sugerido:** guardar solo fecha/concepto/monto/código (o un hash), o `revoke select (linea_extracto, confirmado_por)`.

## D5 · Pagado en el libro, sin acceso, y sin cómo repararlo  — MENOR hoy [medido con falla forzada]

`flujo-b4.cjs` (B10): se agrega una restricción de prueba que frena **solo** las filas `transferencia` de un pintor ZZAGENT (retirada
después), y el dueño toca "Llegó": se anota el pago, se marca `pagado`, y `recalcularAcceso` revienta al crear la fila de acceso.
Resultado: aviso `pagado`, **1 pago en el libro, 0 filas de suscripción, `puede_cotizar = false`**. El aviso ya no sale en la lista (no hay
reintento), y repetirlo diría "ya estaba". La única forma de repararlo desde la web es cargar un extracto con esa plata, que
**crea otro pago**: 2 pagos, +2 meses (D1).
**Dónde:** `transferencia.ts:158` (`if (error.code === "23505") return "ya_estaba"` antes de `:160-161`), `:160` (el `update` de
`cobros` no mira el error), todo sin transacción. El disparador real **[deducido]**: un corte entre el `insert` y el recálculo.

## D6 · Pago antes del fin del lanzamiento: lo guardado queda viejo  — MENOR hoy [medido]

`flujo-b4.cjs` (B9): `lanzamiento_hasta = NULL`, el pintor paga → `vigente_hasta` = 8/11. El dueño fija el fin del lanzamiento en 22/11
(se restauró NULL después) → **sigue 8/11**. Con el fin ya fijado, el dominio (`vigenteHasta(…, {desde})`) da 22/12: **44 días pagos sin
acceso** (`puede_cotizar` los corta el día en que termine el lanzamiento) hasta el próximo pago. Nada recalcula al cambiar
`ajustes_de_cobro`. **Dónde:** `acceso.ts:34-35` (se lee `lanzamiento_hasta` solo dentro de `registrarPago`). "Mi plan" ofrece pagar con la
fecha en NULL y sin ningún aviso (`plan/page.tsx:153-155` solo avisa si la fecha ya existe). La BITÁCORA dice "mientras dure el lanzamiento,
nadie paga": es una promesa del dueño, no de la pantalla. **Plata:** hasta un mes ($7.700) por pintor que haya pagado antes de la fecha.

## D7 · Los pagos de prueba suman acceso real  — MENOR hoy (latente) [medido]

`flujo-b3.cjs` (B7): libro con un cobro `modo='prueba'` (sandbox) + una transferencia real confirmada → acceso **hoy + 61 días** con un solo
pago real. `acceso.ts:21` lee los movimientos del pintor sin mirar `modo`, y la fila que escribe es `modo = 'produccion'`, que es la que
`puede_cotizar` acepta (0027:310). La corrección que figura en la BITÁCORA ("sólo cuentan las filas de producción") vale para
`suscripciones.modo`, no para este recálculo. Hoy no se puede alcanzar (nada escribe `modo='prueba'`); aparece en cuanto exista
`sincronizar.ts` de Mercado Pago. **Plata:** un mes por cada pago sandbox.

---

## D8-D16 · MENOR

| # | Entrada → salió → correcto | Dónde | Plata |
|---|---|---|---|
| D8 | **El precio se ve distinto del cálculo de cabeza.** Dólar 1540,40: la pantalla dice `Hoy son $ 7.800, al dólar oficial … ($ 1.540)`; 5 × 1.540 = 7.700. `formatARS` corta los centavos del dólar y el redondeo hacia arriba a la centena no se explica ni en "Mi plan" ni en /terminos ("Es el precio final"). Pasa en el 2,4 % de las cotizaciones posibles (3.675 de 150.001 entre 1.000 y 2.500). Sobreprecio del redondeo: medio **$49,97 (0,59 %)**, máximo **$99,95** [medido en `a0-mi-plan.png`, `redondeo-visible.mjs`] | `plan/page.tsx:96-101`, `queries/base.ts:129-132`, `suscripcion.ts:72-75` | ≤ $100 por mes |
| D9 | **La fecha del libro es la hora de procesar, no la de la línea** (`01/10/2026` en el extracto → `fecha = 2026-10-08T09:49:26Z`). El acceso empieza cuando el dueño carga el extracto (un pintor que pagó el día del vencimiento queda sin cotizar hasta entonces) y el "Ingreso del mes" de una transferencia del 31/10 cargada el 2/11 cae en noviembre. `fecha` de la línea se lee (`extracto.ts:98`) y no se usa [medido, B8] | `transferencia.ts:154` | días de espera; ingreso en el mes equivocado |
| D10 | **Pagos puntuales desde el 29, 30 o 31 pierden 3 días por año.** 12 pagos encadenados desde el 31/1/2027 terminan el 28/1/2028 (362 días; desde el ancla serían 365). El tope de fin de mes se vuelve el nuevo ancla y nunca vuelve a subir. Solo les pasa a los que pagan antes de que venza [medido con el dominio] | `suscripcion.ts:50-59` + `:135-138` | ≈ 3/30 × $7.700 ≈ **$760 por año** por pintor |
| D11 | **Código recortado = otro pintor.** `codigoEnTexto("PP-003")` → `PP-0003`; `"PP-00371"` → `PP-0371`; `"PAGO PP 3 CUOTAS"` → `PP-0003`. Si el banco corta el concepto, la plata de un pintor le da el mes a otro. El resumen del extracto solo cuenta ("1 confirmadas"): no dice a quién [medido con la función pura; deducido el efecto] | `suscripcion.ts:207` | un mes ($7.700) mal atribuido |
| D12 | **Pagar de más no se acredita ni se avisa:** `$15.400` (2 meses) → "1 confirmadas", libro $15.400, **un** mes. Dos líneas idénticas en el mismo extracto → 1 sola (las dos son plata real; con saldo distinto no pasaría) [medido, B4/B5] | `transferencia.ts:230-239` | $7.700 que el pintor paga y no recibe |
| D13 | **Dos lecturas sueltas** (`cotizacion_vigente` y `precio_ars`, en `Promise.all`): si el dólar cambia entre una y otra, `cobros.cotizacion_id` apunta a un dólar y `monto_ars` sale de otro. Con escrituras seguidas: **16 de 300** pares desfasados. En producción (3 lecturas por día) la probabilidad es ≈ 1 en un millón; en la base compartida vi un pago de $4.850 de otro agente (97 % de $5.000) atado a mi cotización de 1540: puede ser esto o su inserción directa, no lo cuento como evidencia [medido con `carrera-precio.cjs`] | `transferencia.ts:96-100`, `queries/suscripciones.ts:62-68` | despreciable; rompe la conciliación `monto ↔ cotización` |
| D14 | **El extracto, en los bordes (todo [sintético]):** (a) importe SIN signo + columna Tipo (D/C): 13.610 débitos de 60.000 extractos se leyeron como pago (un "Devolución PP-0037" saliente daría otro mes); (b) un renglón del preámbulo con "Importe", "Total créditos", "Ingresos" o "Haber" en las primeras 10 líneas se toma por encabezado y se lee **0** créditos; (c) CSV en Latin-1 con "Crédito" → 0 créditos, sin explicación; (d) `770.000` (770 pesos con tres decimales al estilo EE.UU.) → **770000** (×1000) y `0.500` → 500: la única forma de leer MÁS que lo real (un punto seguido de tres cifras es un separador de miles, por diseño); (e) `(7.547,00` sin cerrar → **+7547** | `extracto.ts:29-40`, `:63-98` | la mayoría falla "seguro" (0 líneas); (a), (d) y (e) pueden dar un mes por menos |
| D15 | **Sin camino para devoluciones:** nada inserta `devolucion`/`contracargo`; /terminos promete "te devolvemos lo pagado" (10 días). Una devolución hecha por el banco no baja el acceso ni el ingreso. Además el KPI de /panel (`panel/page.tsx:62-63`) es bruto (no resta devoluciones) | — | $7.700 por devolución |
| D16 | **Restos:** `/panel` vacío todavía dice "el volumen, la **comisión** y la evolución" (`panel/page.tsx:86`); `comision` sigue leyéndose sin usarse (`queries/metricas-admin.ts:84,124,133`); /admin dice "US$5" fijo (`admin-client.tsx:199`); un salto real con el control (BCRA) todavía en el valor de ayer queda **`descartada`** (no `a_confirmar`) y el botón "Confirmar" solo sale para `a_confirmar` (`admin-client.tsx:224`): el dueño no puede forzarla (medido: 1700 vs control 1519,99); la primera lectura del dólar sin control ni anterior entra sin freno (probé 15.400) | varios | — |

`reglas-compartidas` no atrapa D16 porque busca `comisión del 10`/`Comisión 10`/fórmulas, no la palabra suelta.

---

## Lo que probé y dio bien (tablas)

**1. `precioEnPesos` (JS) contra `precio_ars` (SQL).** `precio-js-sql.mjs`, `precio-sql.mjs`, `precio-funcion-real.mjs`.

| Qué | Casos | Diferencias |
|---|---|---|
| JS contra referencia exacta con enteros, US$5, dólar 0,01…30.000,00 | 3.000.000 | 0 |
| La expresión de `precio_ars` contra la referencia exacta, mismo rango | 3.000.000 | 0 |
| JS contra SQL, fila a fila (SQL en la base, JS en Node) | 3.000.000 | 0 |
| 11 planes futuros (US$0,99; 4,99; 5,01; 5,50; 5,99; 7,25; 9,99; 10; 12,50; 19,99) × dólar 1.000,00-2.500,00 | 11 × 150.001 | 0 / 0 |
| La función **real** `precio_ars('pintor')` con 36 dólares insertados en una transacción con ROLLBACK (1540; 1540,01; 1540,5; 1234,567; 999,99; 1500,005; 1699,99; 1720,01…) contra `precioEnPesos(5, valor guardado)` | 36 | 0 |
| Lo mismo contra el valor CRUDO de 3+ decimales | 36 | 4 (1500,001→7.600 vs 7.500; 1500,004; 1540,004→7.800 vs 7.700; 1560,001). `precioEnPesos` **no la llama ningún camino de producción** (solo pruebas): la base guarda `numeric(12,2)` |
| La ruta REAL `/api/cotizacion/actualizar` con fuentes simuladas (`ruta-dolar.cjs`): 1540,005→se guarda 1540,01→$7.800; 1540,004→1540,00→$7.700; 1560,5→$7.900 | 7 casos | `precio_ars()` = `/trabajos` = "Mi plan" en los 7 (la caché de /trabajos se renueva) |

**2. Controles del dólar** (`dolar-controles.mjs`, 16 bordes): salto de +10 % exacto → vigente; +10,01 % → a_confirmar; fuentes +5 % exacto → vigente;
+5,01 % → descartada; control inválido/0 → vigente; valor 0/NaN/negativo/Infinity → nada. Venta como texto con coma (`"1.540,50"`) → "no se pudo leer" (no se guarda).

**3. El 97 %** (`tolerancia.mjs`): el umbral `floor(pedido×0,97)` es **exactamente** el 97 % para 20.000 precios múltiplos de 100 (sin error de coma flotante).
En la web: $7.468 (96,99 %) → "para revisar"; $7.469 (97,00 %) → confirmada; $7.699 → confirmada.

**4. `montoDeExtracto`** (`monto-extracto.mjs`, 75 entradas): `7.547,00`, `7547`, `$ 7.547,00`, `7,547.00`, `77.00`, `7.547` (→ siete mil quinientos), `1.234.567,89`,
`-7.547,00`, `(7.547,00)`, `7 547,00` (también con espacio duro), `ARS 7.547,00`, `+7.547,00`, `00007700`, `1.000.000`/`1,000,000`: todos al valor correcto; `7.547,00 CR`, `7.547,00-`, `1e3`,
`0x1F`, `NaN`, `−7.547,00` (signo unicode): rechazados. El formato EE.UU. sin decimales (`7,547`) se lee **más chico** (7,547): falla seguro.
**Fuzz de `leerExtracto`** (`extracto-fuzz.mjs`, 60.000 extractos con verdad conocida: 8 diseños de columnas × 8 estilos de número × `;`/`,` × preámbulos × CRLF): **0 montos mayores que el real**;
**0 débitos o saldos leídos como crédito** en 7 de 8 diseños (Débito/Crédito, Débitos/Créditos, Debe/Haber, Egresos/Ingresos, Importe con signo, con comprobante antes del importe).

**5. Fechas** (`fechas.mjs`): `sumarMes` = Postgres (`+ interval '1 month'` en hora de Buenos Aires) en **52.609** instantes (cada 30 min, 2026-2028): 0 diferencias. 31/1→28/2, 29/2/2028→29/3, 31/1 23:59 AR→28/2 23:59,
31/10 23:30 AR (=1/11 02:30 UTC)→30/11 23:30. Pago adelantado 3 días: 6/12 (correcto, no pierde días); tarde 3 días: 9/12 (correcto, no regala);
mismo día/mismo instante, dos pagos: 6/12; con fin de lanzamiento: el mes cuenta desde el fin (1/1/2027) y dos pagos dentro del lanzamiento → 1/2/2027.

**6. Métricas** (`metricas.sql`, transacción con ROLLBACK): el "ingreso del mes" corta en hora argentina. Filas: 30/9 23:59:59 AR ($1) fuera; 30/9 21:30 AR, que ya es 1/10 en UTC ($300) fuera; 1/10 00:00:00 AR ($20) dentro;
modo `prueba` ($4.000) fuera; $50.000 dentro; 31/10 23:59:59 AR ($600.000) dentro → +$650.020 exactos. Las devoluciones van aparte (+$50.000), no restan del ingreso.
/panel = /admin = `metricas_suscripciones()` ($289.710 ese momento).

**7. Lo que la base deja entrar** (`cotizar-por-api.cjs`, `escritura-pintor.cjs`, `comision.sql`): por la API con la sesión de un pintor con acceso: monto 0, −5.000, 999 → 400 "El monto mínimo de una cotización es $1.000"; 1.000 y
1.000.000.000 → 201; 1.000.000.001 → 403; 150000,5 / 1000000000,4 / "150.000" → 400 (no entero); 2147483648 → 400 (fuera de rango); null → 403; estado `accepted` directo → 403.
Con comisión 0 / negativa (−5.000 / −0,1) / enorme (99.999 / 0,9) / vieja (15.000 / 0,1): **entra y se guarda `commission_rate = null`, `commission_amount = null`** en los 4 casos. Con la clave anon y la sesión de un pintor:
escribir en `suscripciones`, `cobros`, `pagos_suscripcion`, `ajustes_de_cobro`, `planes`, `cotizaciones_dolar` → 403 en las 6; `puede_cotizar(uid ajeno)` → `false`; `metricas_suscripciones()` y `cancelaciones_tras_aceptar()` → `[]`;
`cotizaciones_dolar`, `eventos_pago`, `ajustes_de_cobro` (con `select=*`) → 403. Sin sesión, `precio_ars` → 7.700 (público, a propósito).

**8. Los dos lados de $100.000** (`cotizar-100000.cjs`): el pintor escribe `100.000` → eco "Vas a cotizar $100.000." + "El cliente te paga a vos el total: Pintura Pro no cobra comisión sobre tus trabajos."; la base guarda `amount = 100000`, comisión `null`;
/dashboard del pintor muestra $ 100.000 y /cliente del cliente muestra $ 100.000. Los cuatro lados cierran, sin la palabra comisión en ninguno.

**9. Mi plan = aviso = cobro** (`flujo-a.cjs`, A1): cobros.monto_ars (8.000) = lo que dice el mensaje ("esperamos $8.000") = `precio_ars()` del momento, y `cotizacion_id` = la que estaba vigente al apretar (57, no la que veía la página, 56).
**Si el dólar cambia entre ver y apretar:** el aviso usa el precio de AL APRETAR. Hasta +2,6 % (1540→1580) una transferencia exacta de lo visto ($7.700) sigue alcanzando; a 1580,01 el precio salta a $8.000 y $7.700 es el 96,25 %: queda a revisar.
(Se ve en el mensaje "esperamos $8.000", no en una advertencia.) Medido: la página en $7.800 (dólar 1540,40) y el dólar a 1585 (+2,9 %) → aviso $8.000 (7.800/8.000 = 97,5 %, alcanza) y +6,0 % (1585→1680: 8.000/8.400 = 95,2 %, a revisar).

## Pruebas que faltan (cada una tiene que verse en rojo hoy)

1. `extracto-transferencias`: "Llegó" y después el extracto con esa plata → **0 confirmadas** (hoy: 1). Y la misma línea con otro formato.
2. Aviso de más de 3 días: no valida el extracto contra su precio (o avisa); "Mi plan" ofrece volver a avisar (hoy: confirma con el 97 % del viejo y esconde el botón).
3. "Llegó" sobre un `a_revisar` registra lo recibido (hoy: lo pedido).
4. Un pintor no puede leer `linea_extracto` ni `confirmado_por` de su fila (`comoUsuario`).
5. `recalcularAcceso` ignora los pagos `modo='prueba'`; y una falla entre el libro y el acceso se repara reintentando.
6. Fijar `lanzamiento_hasta` recalcula el acceso de quien ya pagó.
7. En `packages/dominio/pruebas.ts` (puras): 12 pagos puntuales desde el 31/1 terminan el 31/1 (hoy 28/1); `codigoEnTexto("PP-003")` no debería resolver a PP-0003; `montoDeExtracto("770.000")`/`("(7.547,00")`;
   una prueba que compare `precioEnPesos` con `precio_ars` (hoy solo se comparan dos números escritos a mano).

## Datos creados y estado en que queda la base local

- Pintores/clientes/pedidos `ZZAGENT …` y avisos (`cobros`), códigos y suscripciones: **borrados** (verificado: 0 perfiles ZZAGENT, 0 usuarios `zzagent-*`).
- `ajustes_de_cobro.lanzamiento_hasta`: lo cambié una vez a +45 días y lo **restauré a NULL** (verificado). La restricción temporal de D5 (`zz_falla_*`): **retirada** (0 restan).
- Dólares: 7 filas `ZZAGENT dinero` (ids 58, 61, 62, 64, 66, 254, 256, todas `descartada`; el libro las referencia, no se pueden borrar); los de las otras pruebas se borraron. **Vigentes al terminar: 0** (como al empezar).
- **Libro de pagos** (sólo se agrega; no se puede limpiar): **17 filas mías** (`modo` producción salvo 1 de prueba que inserté en B7), sin pintor (la cuenta se borró). La suma de "Ingreso del mes" de la base local está inflada por esto y por las pruebas anteriores.
- **Interferencia con otro agente** (misma base, a la vez): vi dólares `ZZAGENT abuso-marketplace` (ids 253, 255) y pagos `ZZAGENT TRANSF RECIBIDA PP-0028 ($8.800)` y `PP-0030 ($4.850)`, más dos `manual:` ajenos, atados a MIS cotizaciones (61 y 66). Entre ~09:35 y ~10:10 UTC mis dólares
  (1540, 1585, 1680, 1690, 1400…) fueron "el vigente" de la base local: si otro agente vio un precio raro en ese rato ($8.400, $8.500, $7.000), fui yo.
- Capturas: `a0-mi-plan.png`, `a2-a-revisar.png`, `panel-kpi.png`. El puerto 54399 (fuentes simuladas) se liberó. No se tocó nada del producto.

## Lo que NO pude medir

- Esperar días de verdad: el fin del lanzamiento (D6) y el vencimiento de un aviso (D2) se emularon moviendo `created_at`/`vence_en` y fijando `ajustes_de_cobro`; el cálculo es el del producto, el reloj no.
- Bancos reales: todos los extractos son inventados por mí (reglas del módulo, no archivos de un banco). El diseño con importe sin signo + "Tipo" y el de 3 decimales son hipótesis de formato.
- Mercado Pago (débito y QR), mails (sin `RESEND_API_KEY`), el job de vencimiento y el aviso de 7 días: no existen todavía.
- La base en vivo: no tiene 0024-0027; no se tocó.

## Resumen (el corto)

Mayor a menor, todos verificados: **(1)** la misma transferencia se acredita dos veces si pasa por "Llegó" y por el extracto (o por dos exportaciones): 3 meses por $7.700;
**(2)** el aviso no vence: con el dólar +9,7 %, $7.469 de $8.500 se confirman solos (−$1.031), y la pantalla muestra dos precios y esconde el botón; **(3)** "Llegó" anota lo pedido, no lo recibido (+$231 a +$700 por pago);
**(4)** el pintor lee el saldo de la cuenta del negocio en su propia fila del libro; **(5-7)** pagado-sin-acceso sin reparación, pago previo a la fecha de fin que no se recalcula (44 días), pagos de prueba que suman acceso real; **(8-16)** menores.
Bien: precio JS=SQL en 3 M de casos, 97 % exacto, fechas = Postgres, parser sin lecturas mayores que la realidad (salvo el formato teórico de 3 decimales, D14-d), comisión imposible de reingresar, el pintor no escribe nada del cobro, y los cuatro lados de $100.000 cierran.
