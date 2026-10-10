# abuso-marketplace · etapa 3 de la suscripción (transferencia) · 8/10/2026

Papeles: **pintor-tramposo** y **robot** (el cliente no le paga nada a la plataforma). Código probado: commit 301ebfd.
Todo contra la **base local** (127.0.0.1:54321, con 0024-0027) y el **servidor de desarrollo :3000**. No toqué la base en vivo,
ni `apps/web/.env.local`, ni el código ni las pruebas del producto. **Medido** = lo vi pasar; **deducido** = lo leí en el código.

## Respuesta corta

- **¿Se puede cotizar sin acceso por la puerta de la base? No.** REST con la sesión propia (una cotización, un lote de 3, un
  upsert, el cuerpo de la app vieja con comisión, `status = accepted`), escritura en las 8 tablas del cobro, lectura de lo ajeno
  y las RPC: todo frenado, con el motivo correcto (medido, ver "Lo que aguanta").
- **¿Se puede conseguir el acceso sin pagar lo que corresponde? Sí, por la puerta del pago**: el que da acceso a un pintor es
  `procesarExtracto`, y ahí hay tres grietas (H1, H2, H3). Más una de diseño (H6): el acceso se mide al *enviar* la cotización,
  no al recibir el trabajo.
- **Hoy nada de esto debería alcanzarse en producción** (según lo que sé del estado: la base en vivo no tiene la 0027, el
  lanzamiento no tiene fecha de fin, y la transferencia necesita `TRANSFERENCIA_ALIAS`/`TITULAR` en el entorno; sin eso "Mi plan"
  dice "Muy pronto"). Se vuelve real el día que se configure la cuenta o se fije la fecha de corte. **Ninguno es BLOQUEANTE para
  publicar; H1-H5 hay que cerrarlos antes de cobrar.**
- De lo que figura como corregido en la BITÁCORA y toqué (cotizar sin suscripción, H1/H8/H10 por REST, libro intocable), nada
  volvió a romperse.

## Hallazgos, de mayor a menor

### H1 · El lector del extracto confía en el texto que escribe el pintor — IMPORTANTE (antes de cobrar)

El concepto/referencia lo escribe el pintor y termina dentro del CSV del banco. `leerExtracto` (`packages/dominio/src/extracto.ts`)
no comprueba que cada fila tenga las mismas columnas que el encabezado, decide el separador contando caracteres en las primeras 5
líneas (línea 72), y no pone tope al importe (`montoDeExtracto`, líneas 29-40; `transferenciaAlcanza`,
`suscripcion.ts:212-215`). Tres consecuencias, todas **medidas**:

**H1a · $1,00 reales se leen como $7.700 y dan un mes** (condicional: el banco no escapa el separador y el texto libre va ANTES
de la columna del importe).
- Pasos: pintor nuevo → Mi plan → "Ya transferí" (aviso $7.700, código PP-0020). CSV `Fecha;Referencia;Importe;Saldo` con la
  fila `08/10/2026;ZZAGENT PP-0020;7700,00;1,00;1.234.567,89` (el pintor escribió `PP-0020;7700,00` como referencia; lo que entró
  fue 1,00). /admin → Cobro → Cargar extracto.
- Resultado: "1 créditos leídos: 1 confirmadas". Libro: `monto_ars = 7700`, `confirmado_por` = el admin, `vigente_hasta` +31 días,
  `puede_cotizar` pasa de false a true. Script `e2e1.cjs`. El mismo corrimiento con comillas sin escapar (`"…","7700.00"`) y con un
  salto de línea dentro de la referencia lo da igual (`parser.mjs` C1, D1); con comillas bien escapadas lee 1,00 (control B0).
- Ganancia: **un mes (≈ US$5) por cada $1 transferido**, sin tope, todos los meses. Pierde el dueño. El libro queda con un
  ingreso falso que infla "Ingreso del mes".
- Rastro: el libro guarda la línea cruda (`…;7700,00;1,00;…`, se ve a ojo), pero **/admin no lista los pagos del libro**; sólo
  hay contadores y un `console.info` con cifras (`admin/actions.ts:121`).
- Prueba de 2 minutos para el dueño: transferirse $1 a sí mismo con la referencia `PP-0001;7700,00` (y otra con `a,b,c` y otra
  con `x"y`), exportar el CSV y abrirlo en un editor de texto: si el `;` o la coma no quedaron entre comillas, el ataque anda.

**H1b · La "coma-bomba": cualquier persona que haga una transferencia anula la lectura de TODO el archivo** (sin requisito de
escape: una coma dentro de un archivo con `;` no es nada especial para el banco).
- Pasos: extracto `;` con tres créditos, el del medio con la referencia `ZZAGENT saboteador, gracias,,,,,,,,,,,,,,,,,,,,,,,,,`
  (25 comas), entre las primeras 5 líneas. Resultado: **"0 créditos leídos: 0 confirmadas…"**; los dos pintores honestos del mismo
  archivo quedan `pendiente` y sin pagos (`e2e5.cjs`, E1; en el lector: `parser.mjs` E1).
- Ganancia del atacante: ninguna; **sabotaje** por $1 por archivo. Obliga a confirmar a mano ("Llegó") o a editar el CSV.

**H1c · Una línea envenenada corta la carga entera con la pantalla de error** (condicional, igual que H1a).
- Pasos: referencia `PP-x;99999999999999` → el importe leído es 99.999.999.999.999 → `registrarPago` revienta con
  `numeric field overflow` (`transferencia.ts:159`) y nadie lo atrapa (`procesarExtracto` no tiene try/catch; `cargarExtracto`,
  `admin/actions.ts:118-120`, tampoco). La pantalla de /admin se reemplaza por "ALGO SE ROMPIÓ … Código de referencia";
  repetir la carga da lo mismo. Con la línea envenenada primero y una sana de otro pintor después: la sana **nunca se procesa**
  (`e2e4.cjs`, S11; log del servidor: `Error: registrarPago: numeric field overflow`).
- Efecto: nadie más puede confirmarse por extracto hasta que el dueño encuentre y saque la línea a mano.

**Defensa más barata para H1 (una sola, ~15 líneas + prueba):** en `leerExtracto`, `if (c.length !== cols.length)` → la línea no se
lee y se cuenta en el resumen ("N líneas con otro formato: revisalas"); decidir el separador por el encabezado, no por conteo;
tope de importe (p. ej. más de 10 × el precio → "para revisar"); `try/catch` por línea en `procesarExtracto`. Si el banco trae
Saldo, verificar `saldo_anterior + crédito = saldo` lo cierra del todo. Hoy la prueba tendría que ser: el CSV de H1a da "ilegible".

### H2 · Un solo pago real da dos meses — IMPORTANTE (antes de cobrar)

La clave de repetición es el sha256 del texto crudo de la línea (`transferencia.ts:230`), y la confirmación a mano usa otra
(`manual:<id del aviso>`, línea 192). Nada une las dos, ni dos exportaciones del mismo movimiento.
- **Pasos (a mano + extracto)**: pintor "Ya transferí" ($7.700) → el admin ve la plata en el banco y aprieta "Llegó" (1 pago,
  +31 días) → a fin de mes carga el extracto, que trae esa misma transferencia → "1 confirmadas" → **2 pagos, +61 días**
  (`e2e2.cjs`, S2).
- **Pasos (dos exportaciones)**: la misma transferencia en el CSV del home banking (`08/10/2026;…;7.700,00;…`) y en el de la app
  (`2026-10-08,…,7700.00,…`) → las dos "1 confirmadas" → **2 pagos, +61 días** (`e2e5.cjs`, S12).
- Ganancia: **+1 mes (≈ $7.700) cada vez** que el dueño procese dos veces un pago; el pintor no hace nada raro: alcanza con
  que haya apretado "Ya transferí". Pierde el dueño. Rastro: dos filas en el libro (una `manual:` con `linea_extracto` null);
  sólo por SQL.
- **Defensa más barata**: antes de auto-confirmar una línea, mirar el libro del pintor de los últimos ~7 días; si hay un pago
  (de cualquier origen) por un monto dentro del 3 %, mandar la línea a "para revisar" como "posible duplicado". Y que la clave
  salga de (código, monto, fecha normalizada), no del texto crudo.

### H3 · El aviso vencido fija el precio: se paga el dólar viejo — IMPORTANTE en coherencia, plata chica

`procesarExtracto` busca el último cobro abierto con `estado in (pendiente, a_revisar, vencido)` y **no mira `vence_en`**
(`transferencia.ts:242-250`). Nada pone `vencido` (búsqueda en todo el repo: sólo el enum y esta lectura), así que un "Ya
transferí" de hace meses sigue fijando el monto. El texto del aviso ("Este monto vale hasta el 11/10/2026") promete 3 días.
- Pasos (`e2e2.cjs`, S3): aviso por $7.700; se lo envejece a "$5.000, creado hace 40 días, vencido hace 37" (simula un dólar
  más barato). "Mi plan" muestra **dos montos a la vez** ("Monto de hoy $7.700" y "Esperamos $5.000 con el código PP-…") y
  **no muestra el botón "Ya transferí"** (`plan/page.tsx:157-165` y `queries/suscripciones.ts:301-309` no filtran por `vence_en`).
  Extracto con $4.850 → "1 confirmadas"; libro `monto_ars = 4850` (63 % del precio de hoy), +31 días.
  Contraprueba (sin ningún aviso abierto): los mismos $4.850 quedan "para revisar".
- Cuánto se gana: la suba del dólar desde el aviso más el 3 % de tolerancia, **por pago**. Con el dólar +10 %: paga $7.469 en
  vez de $8.500 (−12 %); +30 %: $7.469 en vez de $10.100 (−26 %). Para tener *varios* meses congelados hacen falta varios avisos
  vigentes (deducido: cada pago consume el aviso abierto más nuevo): apretar en paralelo deja 1 a 4 por ráfaga (medido, `rafaga.cjs`: 2, 2, 4, 1; en desarrollo, en producción hay más
  paralelismo) y hay que llamar a la acción sin pasar por la pantalla, que esconde el botón. Un pintor honesto lo hace sin querer:
  la pantalla le dice "Esperamos $5.000".
- Perjudicado: el dueño (si el dólar sube) o el pintor (si baja: paga lo de hoy y le queda "para revisar").
- **Defensa más barata**: en esa consulta, `.gt("vence_en", ahora)`; los vencidos se marcan `vencido` al leer (y "Mi plan"
  vuelve a ofrecer el botón). Mejor: comparar contra el dólar del día de la fecha de la línea, no del aviso.

### H4 · El admin no ve lo que necesita para no equivocarse — IMPORTANTE (es lo que deja pasar H1-H3)

- **La cola muestra 50 filas** (`queries/suscripciones.ts:354-356`, del más nuevo al más viejo): con 56 avisos abiertos (1 "para
  revisar" viejo + 55 "Esperando"; los 55 los inserté yo con la clave de servicio para simular bots) la pantalla muestra 50 y **el
  "para revisar" desaparece**, mientras el contador dice "Transferencias para revisar: 1" (`e2e4.cjs`, S6). Como nada vence los
  avisos, la cola sólo crece. Un robot con cuentas (alta sin captcha, ya conocido) o la carrera de H3 la llenan.
- **El monto que llegó no se guarda ni se muestra**: al mandar una línea a `a_revisar` sólo se cambia el estado (líneas 263-267); la
  tabla dice "Monto pedido". "Llegó" registra **el monto pedido**, con `linea_extracto: null` (líneas 186-195): una línea de $1,00 +
  "Llegó" dejó **$7.700** en el libro (`e2e1.cjs`, S10), sin un solo dato en pantalla que diga cuánto entró.
- **No hay lista de pagos registrados** en /admin: ninguna confirmación automática deja huella visible (sólo "Ingreso del mes").
- "Llegó" es un clic sin confirmación, junto a "No llegó".
- **Defensa más barata**: guardar `monto_recibido` y la línea al pasar a `a_revisar` y mostrarlos; "Llegó" por defecto con lo
  recibido; ordenar "para revisar" primero y avisar "N más sin mostrar"; marcar `vencido` a los 3 días; una tabla "Últimos 30
  pagos" con origen (extracto o a mano) y la línea.

### H5 · El pintor lee la línea cruda del banco de su pago — MENOR (condicional)

`pagos_suscripcion` tiene `grant select` de tabla a `authenticated` (0027:633) y la policy `pagos_propios` (línea 660): el pintor
hace `GET /rest/v1/pagos_suscripcion` y recibe `linea_extracto` completa, `confirmado_por` (el uuid de la cuenta admin "Pintura
Pro"), `cotizacion_id`, `proveedor_evento_id` (medido, `e2e1.cjs` S7). Si el CSV del banco trae **Saldo**, cada pintor que
pagó se lleva el saldo de la cuenta del negocio en ese instante (en mi CSV de prueba: `1.234.567,89`); más nombre y CUIT de quien
transfirió. El mismo patrón en `cobros` (`datos`, `proveedor_ref`) y `suscripciones` (`nota`).
- **Defensa más barata**: `grant select (id, pintor_id, fecha, monto_ars, proveedor, tipo)` por columna en vez del grant de tabla
  (la policy sigue igual). Dos líneas de migración; la pantalla "Mi plan" sólo usa `fecha`, `monto_ars`, `proveedor`, `tipo`.

### H6 · La cotización enviada sobrevive a la suscripción, y con ella el teléfono del cliente — DISEÑO / decisión del dueño

La barrera está en *enviar*: `puede_cotizar()` en la policy y el trigger. Pero `enforce_job_rules` (0027:461-520) no mira el
acceso al aceptar, y `contacto_del_trabajo` tampoco. Medido (`rest2.cjs`): pintor con acceso cotiza → se le acaba el acceso →
el cliente **acepta igual** → el pintor, sin acceso, **recibe el teléfono**, pasa a `in_progress` y `completed`; para cotizar otro
pedido sigue frenado. No hay vencimiento de pedidos ni de cotizaciones (sin `expir`/`valid_until` en las migraciones).
- Cuánto se gana: un mes pago (o la última semana del lanzamiento) alcanza para cotizar todo el tablero (tope de la base: 30 por
  hora y cuenta) y conservar *todas* esas cotizaciones vivas mientras los pedidos sigan abiertos. El producto cobra el acto de
  enviar, no el de recibir trabajo.
- **Defensa más barata**: en `enforce_job_rules`, la transición `quoted → accepted` exige `puede_cotizar(old.painter_id)` (el
  cliente ve "esta cotización ya no está vigente"); o aceptarlo y anotarlo: con 3 pintores no cuesta nada.

### H7 · Ruido de robots y terceros — MENOR

- **"Ya transferí" sin tope por cuenta**: en secuencia no duplica (medido); en paralelo deja 1-4 avisos vigentes por ráfaga
  (`avisarTransferencia`, líneas 81-95 vs 108-122, sin índice único en `cobros`). Cada aviso duplicado es una fila más en la
  cola y otro mes si el admin aprieta "Llegó" en los dos (H2).
- **Un tercero marca "para revisar" el aviso de cualquiera**: una transferencia de $1 con el código ajeno (son correlativos:
  PP-0001, PP-0002…) pasa el aviso del pintor a `a_revisar`; su "Mi plan" dice "Recibimos una transferencia con tu código, pero
  el monto no alcanza…" y le esconde el botón (medido, `e2e1.cjs` S5). Si el pintor no tenía aviso, `procesarExtracto` le arma uno.
  Su pago real igual se procesa (la consulta incluye `a_revisar`). Cuesta $1 y deja la identidad del que transfirió en el banco.
  Dos códigos en el mismo concepto: gana el primero (medido). Un pago suficiente con código ajeno le regala un mes a ese pintor:
  **adivinar o reusar códigos no le sirve a nadie para ganar acceso**, sólo para molestar a otro o para pagar por él.
- `/api/health` (público, sin caché): 7 consultas a la base por visita (el cobro sumó una). Amplificación 7:1 para un robot;
  una caché de 10-15 s en memoria alcanza.

## Lo que aguanta (medido)

- **Cotizar sin acceso**, como pintor con su sesión (`rest.cjs`): cotización suelta, lote de 3, upsert `merge-duplicates`, cuerpo
  con `commission_rate/amount`, `status=accepted` → todas `400 P0001 "Necesitás una suscripción activa para cotizar"`, 0 trabajos
  creados. Contraprueba con acceso manual: 201. Una cotización retirada no resucita ("Transición no permitida: cancelled -> quoted").
- **Escribir en el cobro**: INSERT en `suscripciones`, `cobros`, `pagos_suscripcion`, `codigos_de_pago`, `cotizaciones_dolar`,
  `ajustes_de_cobro`, `planes`, `eventos_pago`; UPDATE de `ajustes_de_cobro`, `planes`, `suscripciones`; DELETE del libro;
  `PATCH profiles is_admin`: todos 403 (anon: 401). Leer `cotizaciones_dolar`, `eventos_pago`, `ajustes_de_cobro` con `select=*` o
  las columnas internas: 403; lo ajeno de `suscripciones`, `cobros`, `codigos_de_pago`, `pagos_suscripcion`: `[]`.
- **RPC**: `puede_cotizar(uid ajeno)` → false (no filtra quién paga); `metricas_suscripciones` y `cancelaciones_tras_aceptar` → `[]`
  para no-admin; con anon, 401 en todas salvo `precio_ars` y `cotizacion_vigente` (públicas a propósito).
- **Acciones del admin** (`e2e3.cjs`, S8): `cargarExtracto`, `confirmarTransferencia`, `rechazarTransferencia`,
  `confirmarCotizacion`, `borrarResena`, llamadas a mano con el id de la acción: un pintor con sesión recibe "Esta acción es sólo
  para la administración."; sin sesión, "Tenés que iniciar sesión." (el control con el admin llega a la lógica).
- **Fin del lanzamiento** (`fin-lanzamiento.sql`, en rollback): con `lanzamiento_hasta` en el pasado, el pintor inscripto pierde el
  acceso y una cuenta que se vuelve pintor después no recibe inscripción. Crear cuentas no regala días.
- **`/api/cotizacion/actualizar`** sin token o con token malo (4 variantes, 20 en ráfaga): 401; GET: 405; 0 filas nuevas.
- **Parser de importes** (`montos.mjs`): "(7.547,00)", "-7.547,00", "7.547,00-", "7.547,00 CR", "1e4", "NaN", "٧٧٠٠" → no
  suman; "7,700" se lee 7,7 (por debajo → "para revisar"), "77.00" → 77, "7.547" → 7547. Ninguna ambigüedad lee de más.
  Códigos (`codigos.mjs`): "APP-0037", "PP-12345678", "PP-0037PP-0038" no cuentan.
- Un pago parcial (< 97 %) nunca se confirma solo. Un código que no es de nadie (`PP-9999999`, `PP-0000`) y una línea sin código:
  "2 con un código que no es de nadie, 1 sin código", 0 filas nuevas en el libro y 0 avisos (`e2e7.cjs`). El mismo archivo dos veces
  no duplica (lo cuida `extracto-transferencias`; acá sólo H2 lo esquiva con otro formato).

## No es abuso, pero le cuesta plata al pintor honesto (y al dueño, soporte) — medido

- **Latin-1**: el mismo extracto guardado en Latin-1 con "Débito;Crédito" dice "0 créditos leídos" sin explicar por qué
  (`archivo.text()` decodifica UTF-8, `admin/actions.ts:118`); sin tildes en el encabezado lee bien. Muchos bancos exportan
  Windows-1252. **Probar con un extracto real antes de depender de esto.** (`e2e5.cjs`, L1)
- Dos transferencias iguales el mismo día, sin columna de saldo: "1 confirmadas, 1 ya cargadas" → paga dos meses, recibe uno.
  Una transferencia de 3 meses ($23.100) da un mes (`e2e6.cjs`).
- "PP–37" con raya larga (autocorrector del teléfono) no se reconoce → "sin código". `PP-` con espacio después del guion tampoco.
- Si el pintor transfirió sin avisar, la línea se juzga con el dólar del día en que el dueño carga el extracto, no el de la
  transferencia (`transferencia.ts:252-258`): una carga tardía con el dólar más alto la manda a "para revisar".

## Qué es urgente

- **Antes de configurar la cuenta de transferencia o fijar la fecha de corte**: H1 (prueba de 2 minutos con el banco + la
  validación de columnas), H2, H3 y H4; H5 con la migración que toque algo más. Con tres pintores y un dueño que mira cada
  línea del banco, el riesgo real es bajo, pero el sistema está hecho para que *no* haya que mirar cada línea.
- **Puede esperar a tener tráfico**: H6 (decisión de producto), H7, y las notas de arriba.
- **Si no se arregla nada**: control manual mensual: cargar el extracto una sola vez, no usar "Llegó" en lo que va a venir en el
  extracto, y comparar "Ingreso del mes" con lo acreditado en el banco.

## Datos de prueba (todos en la base local)

- Cuentas: unos 23 pintores/clientes `zzagent-e1…e6/rest/r2/rf-<timestamp>@pinturapro.demo` creados con la clave de servicio (sin
  mails) y **borrados en cada `finally`** (verificado: 0 usuarios, 0 cobros, 0 pedidos y 0 trabajos ZZAGENT al terminar).
- Cotizaciones del dólar "ZZAGENT abuso-marketplace": ids 60, 255 y 264, todas `descartada`. (Otro agente movía el dólar de la
  base local al mismo tiempo, ids 58-66 y 254-264: mis dos primeras pasadas de S2/S3 salieron torcidas por eso y las repetí; los
  números de arriba son de las pasadas limpias.)
- **Filas del libro que no se pueden borrar** (todas con `pintor_id` null desde que se borraron las cuentas: no dan acceso a nadie,
  pero cuentan en "Ingreso del mes" de la base local): `8ed09e16-36f4-4f91-bd5e-6ee7561c5105`, `7ef1e6fd-9117-4401-87c4-969c6127af8a`,
  `53746142-f9c5-4ba1-90aa-513f34e21cd7`, `7e2d8278-f2bf-4e59-8556-2a19fa996625`, `0c6988a4-efc1-4422-bdc9-fca065152763`,
  `9cbf7e21-924f-43e6-b535-55b8aed09f68`, `9fb50a20-e4ba-4d21-8cfa-c6fb2d78e561`, `be9d311b-2880-4ed3-8ffa-e0500b6e388b`,
  `6e9f9e42-126f-4b1c-9473-4930f793a216`, `144a1b9a-0f6b-47f5-b94d-fed4bbb6d067`, `e42c66f9-918b-44b4-bcc0-805e1ad63b1c`
  (`53746142…` y `7e2d8278…`, ambos `manual:`, los asigno por la hora: el libro no dice quién los creó). Se van con `levantar.sh`.

## Cómo reproducir

Scripts en `tools/auditoria/.salida/abuso-marketplace/` (fuera de git). Siempre:
`set -a; . tools/auditoria/.salida/base-local/web.env; set +a; timeout 240 node tools/auditoria/.salida/abuso-marketplace/<script>`.
`parser.mjs`, `montos.mjs`, `codigos.mjs` (el lector, sin base) · `rest.cjs`, `rest2.cjs` (REST como pintor) · `e2e1…e2e7.cjs`
(navegador: H1a, S5, S7, S10 · H2/H3 · S8 y la carrera · H1c y la cola · H2 en otro formato, H1b, Latin-1 · lo del pintor
honesto · códigos desconocidos) · `rafaga.cjs` (la carrera) · `fin-lanzamiento.sql` (en rollback). Si corre otro agente que mueve el dólar, los scripts
que arman un aviso necesitan una cotización vigente (`asegurarDolar` la crea si falta y la descarta al terminar).

## Límites de esta medición

Servidor de desarrollo y base local: la cantidad de avisos duplicados de la carrera (1-4) es de desarrollo. El formato del CSV del
banco del dueño es una incógnita: H1a y H1c dependen de ella, H1b no. No probé Mercado Pago (no existe todavía). La llamada a
`cargarExtracto` con un multipart armado a mano no la pude validar (el control con el admin respondió "Elegí el archivo"); lo que
prueba el rechazo del pintor es que el chequeo de admin ocurre antes de leer el archivo. No volví a medir el tope de
30 cotizaciones por hora (cubierto por `tope-por-hora`).
