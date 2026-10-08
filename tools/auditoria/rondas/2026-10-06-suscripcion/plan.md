# Plan: suscripción mensual de US$5 para los pintores, cobrada en pesos por Mercado Pago, QR y transferencia

## Contexto

**Pedido del dueño (6/10/2026):**
- "Un plan claro de cómo se van a hacer los cobros, para no perder plata y no ser engañado ni por el cliente ni por el pintor".
- "No quiero quedar supeditado a un solo medio de pago".
- "Vamos con Mercado Pago, transferencia y QR; todos cobran 5 dólares; hay que monitorear el dólar a la hora de cobrar; la página va a vivir en Google Cloud con Supabase".

**Lo que se encontró en el código:**
- El 10 % se calcula y se guarda en cada trabajo (`jobs.commission_amount`), pero **no se cobra**.
- Hay unos 15 huecos para declarar menos o arreglar por fuera.
- En servicios para el hogar, cobrar comisión por trabajo siempre pierde plata, porque cliente y pintor se conocen en persona.

**Decisiones del dueño:**
- **Suscripción mensual del pintor de US$5, cobrada en pesos con la cotización del día del cobro.** Con el oficial del Banco Nación ($1.540 para la venta el 5/10) hoy son $7.700.
- Medios de pago: **Mercado Pago (débito automático), QR y transferencia**. La capa de pagos queda preparada para sumar otros más adelante sin tocar el resto.
- Más adelante, varios planes: cuanto más paga, más beneficios.
- **El cliente no le paga nada a la plataforma**: publica gratis y le paga el trabajo directo al pintor, por el medio que acuerden. La plataforma nunca toca esa plata (marketplace puro).

**Resultado buscado:**
- El ingreso no depende del monto de ningún trabajo, ni pierde valor con la inflación.
- No hay que perseguir a nadie: **la base de datos no deja cotizar al que no pagó**.
- Si Mercado Pago falla, la transferencia sigue funcionando y el pintor no pierde días.

## El precio en dólares: cómo se sigue la cotización

**No hace falta un agente de inteligencia artificial: alcanza con una tarea programada.** Corre en Google Cloud, guarda en Supabase y la vigila el vigilante 24/7 que ya existe.

- **Qué dólar:** el **oficial del Banco Nación, para la venta**, que es el que entiende cualquiera. Se lee de `dolarapi.com/v1/dolares/oficial` y se controla con la API oficial del BCRA (`api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones/USD`). Las dos responden hoy ($1.540 y $1.520).
- **Cada cuánto:** Cloud Scheduler llama 3 veces por día hábil (10:30, 13:00 y 16:00) a `/api/cotizacion/actualizar`, con un token propio. Cada lectura se guarda en `cotizaciones_dolar` (fecha, fuente, compra, venta, hora).
- **Lo que no puede pasar, porque se toca plata:**
  - Si las dos fuentes difieren más de 5 %, se guarda pero **no se usa**, y sale una alerta.
  - Si un valor salta más de 10 % respecto del anterior, queda **"a confirmar"** hasta que lo aceptes en /admin. Mientras tanto se sigue usando el último bueno.
  - Si no se puede leer el dólar, se sigue cobrando con **el último valor válido**. A las 48 horas sin actualizar, el vigilante avisa.
  - **Nunca se frena un cobro por la cotización.**
- **El monto en pesos** = US$5 × cotización vigente, **redondeado hacia arriba a la centena** ($7.700). Cada cobro guarda la cotización y la fuente que usó, para la factura y por si alguien reclama.
- **En pantalla** el pintor ve "US$5 por mes (hoy $7.700)". En los términos: "se cobra en pesos al dólar oficial vendedor del Banco Nación del día en que se genera el cobro".
- Además del vigilante, el agente `dinero-y-comisiones` revisa en cada ronda que lo cobrado coincida con la cotización guardada.

## Los tres medios de pago

| Medio | Cómo paga el pintor | Cómo sigue el dólar |
|---|---|---|
| **Mercado Pago, débito automático** | Se suscribe una vez (tarjeta, débito, dinero en cuenta) y MP cobra solo todos los meses. | MP debita un monto fijo en pesos. Por eso, **2 días antes de cada débito** la tarea diaria le actualiza el monto a esa suscripción en MP con la cotización del día. A confirmar en el sandbox (S1): que MP deje cambiar el monto todos los meses. Si no lo deja, el débito se reemplaza por un **link de pago mensual de MP** que llega por mail con el monto del día. |
| **QR del mes** | Ve en "Mi plan" un QR con el monto del día y lo escanea con la app que use: Mercado Pago, MODO, la del banco o Ualá. El QR es interoperable. | El monto se calcula al generarlo y vale **3 días**; después se genera otro. El pago se acredita solo. Por detrás usa Mercado Pago. |
| **Transferencia** | Transfiere a tu alias o CBU **el monto del día y su código** (`PP-1234`) en el concepto. | Se acepta si coincide el código y el monto es **al menos el 97 %** del calculado ese día. La página la confirma cuando cargás el extracto del banco en CSV, o a mano. **No depende de ninguna empresa.** |

**Una regla para todos:**
- Cada pago aprobado suma un mes de acceso, desde el día en que vencía o desde hoy si ya había vencido.
- Pagar antes nunca hace perder días.
- El pintor puede cambiar de medio cuando quiera.

## Cómo se va a cobrar (el circuito)

1. El pintor se registra y arma su perfil gratis.
2. **Para cotizar necesita acceso.** Hasta la fecha de fin del lanzamiento todos lo tienen gratis. Una cuenta nueva no suma días: el lanzamiento termina el mismo día para todos.
3. En **"Mi plan"** elige débito automático, QR o transferencia. Ningún dato de tarjeta pasa por el sitio.
4. Mercado Pago avisa cada pago. La página **no le cree al aviso**:
   - le pregunta a MP con la clave propia;
   - anota el pago en un libro que nadie puede borrar ni editar, con la cotización usada;
   - recalcula hasta cuándo puede cotizar el pintor.
5. Las transferencias quedan "a confirmar" hasta que cargues el extracto o las confirmes a mano.
6. **Siete días antes del vencimiento**, a quien paga por QR o transferencia le llega el aviso con el QR y el monto del día.
7. **Si un débito falla**, MP lo reintenta y hay **10 días de gracia**. Después ya no puede enviar cotizaciones nuevas; lo enviado y los trabajos en curso siguen. **Lo frena la base de datos**, así que no se esquiva desde la app ni desde la API.
8. **Baja con un botón** visible: sigue cotizando hasta el fin de lo pagado. Si borra la cuenta, primero se cancela el débito.
9. **Cada día** la página repasa los pagos contra Mercado Pago, por si se perdió un aviso.
10. **En /admin y /panel:** activos, en gracia, bajas, ingreso del mes por medio de pago, transferencias a confirmar, la cotización vigente con su historial, y un interruptor por medio de pago.
11. Cada cobro se factura en pesos, como diga el contador.

**Lo que se arregla igual, por confianza:**
- **H1:** una cotización enviada no se edita; hay que retirarla y mandar otra.
- **H5:** queda registro de quién canceló después de ver el teléfono.
- **H8:** no se puede borrar un pedido adjudicado.
- **H10:** no se puede borrar a la otra parte de un trabajo.
- **H11:** la baja de cuenta cancela el débito.

## Lo que tenés que hacer vos (no es código)

- **Contador:**
  - inscripción para facturar;
  - factura en pesos por cada cobro;
  - si los US$5 llevan IVA aparte o ya lo incluyen;
  - qué cotización usar en la factura.
  - El precio que se muestra es el final. MP descuenta su comisión de lo que te llega.
- **Cuenta bancaria del negocio** con alias, y saber exportar el extracto en CSV.
- **Mercado Pago:**
  - cuenta de vendedor del negocio, con la identidad validada;
  - una aplicación con Suscripciones y QR;
  - usuarios de prueba y el secreto de los avisos.
  - Ninguna clave va al chat: van en `.env.local` y en Secret Manager.
- **Abogado**, antes de cobrar de verdad:
  - el precio en dólares cobrado en pesos;
  - los términos de la suscripción;
  - el botón de baja (Disposición 945/2025);
  - el arrepentimiento (Resolución 424/2020);
  - si el pintor cuenta como consumidor;
  - cuánto tiempo se guarda el libro.
- **Autorizar:**
  - aplicar las migraciones 0024 → 0025 → 0026 → 0027 **antes** de publicar la web nueva;
  - un Cloud Run de prueba para recibir los avisos de MP;
  - un PAT para subir los commits.
- **Sacar Supabase del plan gratis** antes del cobro real.

## Etapas (cada una se puede publicar sola)

| Etapa | Qué incluye | Autorización del dueño |
|---|---|---|
| **1. Sin comisión, base nueva y huecos** | Migración 0027; reglas en `dominio`; textos de web y móvil sin el 10 %; aviso del lanzamiento; "Mi plan" en "Muy pronto"; H1, H5, H8, H10 y H11 (sin la parte de MP); vigilante y pruebas. Todos los pintores quedan en el lanzamiento. | Aplicar 0024-0027 antes de la web; push |
| **2. Cotización del dólar** | `cotizaciones_dolar`, la tarea `/api/cotizacion/actualizar` con sus controles, el precio "US$5 (hoy $…)" en "Mi plan" y en el aviso del lanzamiento, la cotización en /admin y en `/api/health`, y la alerta del vigilante. No cobra nada todavía. | Cloud Scheduler en el proyecto de Google Cloud |
| **3. Mercado Pago (débito y QR) + transferencia, en modo prueba** | `lib/pagos/`; aviso de pagos; conciliación diaria; actualización del monto del débito; QR de 3 días; transferencia con código; cola de transferencias y carga del extracto en /admin; baja de cuenta con cancelación del débito; mails. En producción, sin claves, cada medio dice "Muy pronto". | Cuenta y aplicación de MP; cuenta bancaria; Cloud Run de prueba |
| **4. Admin y /panel** | Pestaña "Suscripciones", ingreso por medio, interruptor por medio, gráfico. | — |
| **5. Cobro real** | Claves de producción en Secret Manager; Scheduler diario; Resend; `/baja`; términos publicados 30 días antes del corte, con aviso a los pintores; un pago real chico por cada medio desde otra cuenta, y su devolución. | Todo lo de "Lo que tenés que hacer vos" |
| **6. Fecha de corte** | La base empieza a exigir la suscripción sola. Hay una palanca de emergencia (`exigir_suscripcion`). | — |
| **Más adelante** | Otros medios de pago (la capa ya lo permite), más planes con beneficios, facturación automática. | — |

Sobre los planes caros: si un perfil aparece primero porque paga, tiene que decir "Destacado". Nada que se lea como "Verificado": ya se sacó una vez por engañoso.

## Diseño técnico (resumen ejecutable)

### Base: `supabase/migrations/0027_suscripcion_mensual.sql` (después de 0026)

**Tablas**

| Tabla | Para qué |
|---|---|
| `ajustes_de_cobro` | Una sola fila: `lanzamiento_hasta`, `exigir_suscripcion`, `medios_activos text[]`, `fuente_dolar`, `salto_maximo` (0,10) y `diferencia_maxima_fuentes` (0,05). |
| `planes` | `precio_usd numeric(8,2)` (5,00), `beneficios`, `precio_proximo_*`. Se lanza con `'pintor'`. |
| `cotizaciones_dolar` | `fecha`, `fuente`, `compra`, `venta`, `leida_en`, `estado` (vigente, a confirmar o descartada) y `confirmada_por`. |
| `suscripciones` | `proveedor` (mercadopago, transferencia, lanzamiento o manual), `modalidad` (debito o pago_mensual), estado, **`acceso_hasta`**, `vigente_hasta`, `proveedor_ref` (`unique (proveedor, proveedor_ref)`), `monto_ars_actual`, `proximo_cobro`, `modo`, `cancelada_por`, `codigo_transferencia`. |
| `cobros` | Lo que se le pide al pintor (QR, link o transferencia del mes): `monto_usd`, **`monto_ars`, `cotizacion_id`**, código, estado, vence (3 días) y `proveedor_ref`. Es el `external_reference` del QR. |
| `pagos_suscripcion` | Libro sólo de agregar: tipo (cobro, rechazo, devolución o contracargo), `monto_ars`, `cotizacion_id`, `unique (proveedor, tipo, proveedor_evento_id)`. Un trigger impide borrar y modificar. La transferencia confirmada lleva quién la confirmó y la línea del extracto. |
| `eventos_pago` | La bandeja de avisos: no procesar dos veces y dejar auditoría. |

**Funciones**
- `cotizacion_vigente()`: la última cotización vigente.
- `precio_ars(plan)`: `ceil(precio_usd × venta / 100) × 100`.
- `puede_cotizar()` (security definer): es pintor y tiene una fila con `acceso_hasta > now()`, o la inscripción al lanzamiento antes del corte, o la palanca apagada. Una cuenta común sólo pregunta por sí misma.

**Policy y triggers de `jobs`**
- `jobs_insert_painter_quote` se reescribe **una sola vez**, con cada condición comentada por su migración: entra `puede_cotizar()` y sale la aritmética de la comisión (0024:101-103).
- `trg_exigir_suscripcion`: error P0001 legible, y comisión en null.
- `commission_rate` deja de ser `not null default 0.100`.
- `enforce_job_rules` sin comisión y con H1 y H10. El rastro de H5 y la policy de H8.

**Permisos:** `revoke all` primero; cada pintor lee lo suyo; la cotización vigente y los planes se leen públicamente; sólo la clave de servicio escribe; en el libro sólo se agrega. Las funciones de admin llevan `es_admin()`.

### Código: `apps/web/lib/pagos/` (`server-only`, `fetch` sin SDK)

- **`cotizacion.ts`**: lee las dos fuentes con un timeout de 8 s, aplica los controles y guarda. Las reglas puras (redondeo, salto, diferencia entre fuentes) van en `packages/dominio/src/suscripcion.ts`.
- **`pasarela.ts`**: el contrato común: `crearDebito`, `actualizarMontoDebito`, `crearCobroUnico` (QR o link), `cancelarDebito`, `verificarAviso`, `leerMovimientos` y `listo`.
- **`mercadopago.ts`**:
  - débito con `/preapproval` (`external_reference` = id de la fila) y cambio de monto con `PUT /preapproval/{id}`;
  - QR dinámico o link con `external_reference` = id del cobro;
  - firma `x-signature` (HMAC del manifiesto `id;request-id;ts`, comparado en tiempo constante).
- **`transferencia.ts`** y **`extracto.ts`**: leen el CSV del banco y emparejan por código `PP-xxxx` y monto (al menos 97 %). Lo que no empareja queda para confirmar a mano.
- **`sincronizar.ts`**: la única función que escribe estado.
  - Lee el recurso con la clave propia: si MP no lo conoce, se ignora.
  - Agrega los movimientos al libro.
  - Recalcula `acceso_hasta` con las reglas de `dominio`: un mes por pago aprobado, desde `max(hoy, acceso vigente)`; devoluciones y contracargos lo descuentan; 10 días de gracia sólo en el débito automático.
- **`conciliar.ts`**, una vez por día, para todo lo de MP:
  - **actualiza el monto de los débitos que cobran en los próximos 2 días**;
  - vence los cobros de más de 3 días;
  - cancela los débitos de cuentas borradas;
  - manda los avisos de los 7 días.

**Rutas**
- `app/api/pagos/[proveedor]/route.ts`: aviso de pago. Firma mala → 401; aviso repetido → 200 sin hacer nada; si MP falla de forma transitoria → 500, para que reintente.
- `app/api/pagos/conciliar/route.ts` y `app/api/cotizacion/actualizar/route.ts`: con `Bearer` y el token propio, desde Cloud Scheduler. No van en el vigilante, que sigue sin credenciales.
- Las tres se agregan a `SIN_VALIDAR` (`apps/web/middleware.ts:19`).
- **`/api/health`** suma `cotizacionLeidaHace`. El vigilante alerta si pasa de 48 h, o si hay una cotización "a confirmar".

**Variables nuevas:** `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `CONCILIACION_TOKEN`, `COTIZACION_TOKEN`, `PAGOS_MODO` y `TRANSFERENCIA_ALIAS`/`CBU`/`TITULAR`. Van en `.env.example`, en Secret Manager y en `docs/despliegue-google-cloud.md`, junto con los dos trabajos de Scheduler.

### Pantallas
- **`/dashboard/plan`**:
  - "US$5 por mes (hoy $7.700, dólar oficial BNA del {fecha})";
  - estado en palabras;
  - **"Elegí cómo pagar"**:
    - débito automático;
    - "Pagar este mes con QR" (QR grande y su link, válido 3 días);
    - transferencia (alias, CBU, titular, monto del día y **su código**, más un botón "Ya transferí");
  - historial con el monto y la cotización de cada pago;
  - "Cancelar débito" a la vista.
- **`/dashboard`**: botón "Mi plan" y una línea con el estado. Sale "Comisión 10 %".
- **`/trabajos`**:
  - aviso del lanzamiento con el precio en dólares y en pesos;
  - sin acceso → "Necesitás una suscripción activa → Mi plan";
  - `cotizar` (`apps/web/app/(marketplace)/actions.ts:150-232`) pregunta `rpc('puede_cotizar')` y ya no manda comisión.
- **`/admin`**, pestaña "Suscripciones":
  - tabla por pintor;
  - transferencias a confirmar y "Cargar extracto";
  - **la cotización vigente, su historial y "Confirmar salto"**;
  - interruptor por medio;
  - cancelaciones después de aceptar (H5).
- **`/panel`**: activos, ingreso del mes en pesos y su equivalente en dólares, ingreso mensual recurrente, en gracia.
- **App móvil**: no vende ni enlaza el pago, por las reglas de las tiendas. Sólo muestra el estado y `MOTIVO_SIN_SUSCRIPCION`. Una prueba vigila que su código no contenga `mercadopago`, `init_point` ni `Suscribirme`.
- **Mails** (con `RESEND_API_KEY`): pago acreditado, transferencia confirmada, aviso 7 días antes con el monto del día, cobro rechazado, vencida, baja.

### Sacar la comisión
- **Código:**
  - `packages/dominio/src/montos.ts:133-138`: salen `COMISION` y `comisionDe`; entra `suscripcion.ts`.
  - `apps/web/lib/utils.ts:21-34`.
  - `apps/web/app/(marketplace)/trabajos/quote-form.tsx`: "El cliente te paga a vos el total: Pintura Pro no cobra comisión".
  - `lib/queries/pedidos.ts` y `lib/supabase/types.ts`.
  - Móvil: `app/cotizar/[id].tsx` y `lib/mutations.ts:138`.
- **Textos:**
  - `/terminos`: suscripción en dólares cobrada en pesos y con qué cotización, medios, renovación, lanzamiento, baja, arrepentimiento, 30 días de aviso de cambio de precio, qué pasa si no se paga; **no garantiza pedidos ni ingresos**.
  - `/privacidad`: MP y el CBU del que transfiere.
  - `/nosotros`, el alta y `api/mis-datos`.
  - README, CLAUDE.md, docs, BITÁCORA y los agentes que nombran la comisión.
  - `tools/auditoria/vigilancia/revisar.mjs:120` pasa de "comisión" a "suscripción".

### Lo que se reutiliza
- Funciones de la base: `es_pintor()`, `es_admin()`, `es_service_role()`, `set_updated_at()`.
- `lib/supabase/admin.ts`.
- `notifyUser`/`EMAIL_READY` (`lib/email.ts`).
- La caché pública con `olvidar` (`lib/cache-publico.ts`).
- `esFormulario`/`esTexto`.
- El patrón de dos clics de `CancelButton`.
- `packages/dominio/src/errores.ts`.
- El ensayo en rollback de `tools/auditoria/escala/probar-0026.sql`.
- La alerta por logs y el uptime check del vigilante.

## Verificación

**Pruebas nuevas en `pnpm verificar`**
- `base.cjs` suma `comoUsuario(email, pass)` con la clave anon. Hasta hoy ninguna prueba ejercitaba las reglas de la base como usuario común.
- `correr.cjs` da a los pintores de demo acceso `manual` de 3 horas mientras corren las pruebas.

| Prueba | Qué tiene que pasar |
|---|---|
| `suscripcion-requerida` | Un pintor sin acceso cotiza **por REST como él mismo** → 400 "suscripción", y no queda ninguna fila. Tampoco puede escribir en `suscripciones`, `cobros`, el libro ni `cotizaciones_dolar`. Por pantalla: sin formulario y con el aviso. Contraprueba: con acceso manual, la misma cotización da 201. |
| `cotizacion-dolar` | Con las fuentes simuladas: una lectura normal queda vigente y el precio sale redondeado a la centena. Un salto de 12 % queda "a confirmar" y se sigue usando la anterior. Las fuentes en desacuerdo no se usan. Las fuentes caídas mantienen la última. Sin token → 401. `/api/health` dice hace cuánto se leyó. |
| `pagos-avisos` | Sin firma o con firma mala → 401. El mismo aviso dos veces deja una sola fila. El libro no se edita ni se borra, ni con la clave de servicio. Conciliar sin token → 401. |
| `pagos-acceso` | Un pago por QR da un mes; dos pagos seguidos dan dos meses, sin perder días; pasar de débito a transferencia no corta el acceso; una devolución lo descuenta; una transferencia sin confirmar no da acceso. Cada pago guarda su cotización. |
| `extracto-transferencias` | Código y monto del día → confirmada. Monto al 98 % → confirmada. Monto al 90 % → para revisar. El mismo extracto dos veces no duplica. |
| `trabajos-por-api` (H1, H5, H8, H10) y `baja-con-suscripcion` (H11) | Como en el diseño anterior. |

**Pruebas que cambian:** `ciclo-de-trabajo`, `reglas-compartidas` (que la comisión no vuelva, y que el móvil no tenga pagos), `admin-panel-empresa` y `acciones-hostiles`.

**Base en rollback** (`tools/auditoria/escala/probar-0027.sql`):
- todos los casos de `puede_cotizar`;
- `precio_ars` con la cotización vigente;
- la policy final contiene `puede_cotizar` y no contiene `commission`;
- H1, H5, H8 y H10;
- el libro sólo agrega;
- un evento duplicado choca;
- `projects_update_own` conserva lo de 0026.

**Reglas puras** (`node packages/dominio/pruebas.ts`): redondeo, salto y diferencia entre fuentes, suma de meses, gracia sólo en débitos, devoluciones, contracargos, lanzamiento, y fechas cerca de la medianoche y del 31 de enero.

**Sandbox de MP, en el Cloud Run de prueba:**
- débito con APRO;
- rechazos OTHE y FUND;
- **cambio del monto de un débito**;
- QR del mes pagado con el comprador de prueba;
- cancelación;
- aviso repetido;
- conciliación de una fila desordenada.

La transferencia se prueba con un extracto de prueba.

**Agentes:**
- `seguridad-rls` sobre la 0027, antes de aplicarla.
- `regresiones` con `cobertura.mjs` después de cada etapa.
- Después de la etapa 3:
  - `abuso-marketplace`: cotizar sin pagar; falsificar una fila; reusar el código o el QR de otro pintor; transferir menos; comprobante falso; inundar los avisos;
  - `dinero-y-comisiones`: precio mostrado contra cobrado contra la cotización guardada contra MP.
- `riesgo-legal` antes del cobro real.
- `app-movil`, por las reglas de las tiendas.

**A confirmar en el sandbox antes del cobro real:**
- **S1:** que MP deje cambiar el monto de un débito todos los meses (si no, el débito pasa a ser un link mensual).
- Que `pending` devuelva `init_point`.
- Que `payer_email` tenga que ser el de la cuenta que paga.
- El parámetro con el que se vuelve a `back_url`.
- Cómo se escribe "cancelado".
- Que el QR dinámico se pueda pagar desde MODO y desde las apps de los bancos, y que su aviso traiga el `external_reference`.

## Decisiones con valor por defecto (cambiables al aprobar)
- **Precio:** US$5 por mes, final, en un solo plan ("Plan Pintor"). Se cobra en pesos al **dólar oficial vendedor del Banco Nación**, redondeado hacia arriba a la centena.
- **Cotización:** se lee 3 veces por día hábil. Un salto de más de 10 % se confirma a mano. Si falla, se usa la última válida.
- **Validez del monto:** 3 días para el QR. En la transferencia se acepta desde el 97 %.
- **Medios al lanzar:** débito de Mercado Pago, QR y transferencia.
- **Fin del lanzamiento gratis:** 60 días después de abrir el sitio al público, con aviso 30 días antes.
- **Gracia:** 10 días, sólo en el débito automático. Quien paga por QR o por transferencia recibe el aviso 7 días antes.
