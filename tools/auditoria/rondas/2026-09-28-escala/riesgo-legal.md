# Riesgo legal — ronda 2026-09-28-escala

Agente: `riesgo-legal`. No soy abogado: separo lo **medido** (código/API/pantalla) de lo que
queda como **duda para el abogado**. No toqué la base ni creé datos ZZAGENT (no hizo falta:
todo se verificó por lectura de código, `curl` de sólo lectura a la API pública con la clave
anon, y una visita de sólo lectura al navegador con el kit).

Leí `REGLAS.md`, `BITACORA.md` (Abierto y Tareas del dueño) y `docs/datos-personales.md` antes
de reportar, para no repetir lo ya anotado. No repito "faltan datos legales del responsable"
ni "derecho de arrepentimiento genérico": ya están en `BITACORA.md → Abierto`.

---

## BLOQUEANTE

### 1. La etiqueta "Verificado" se muestra hoy, en una pantalla real, sin ningún proceso detrás

**Dónde:** `/pintor/[id]`, `apps/web/app/(pro)/pintor/[id]/page.tsx:102-105`:

```tsx
<LevelBadge level={painter.level} />
{painter.level === "Master" && (
  <span className="font-mono text-mono-sm text-concrete uppercase tracking-widest">Verificado</span>
)}
```

`painter.level` sale de `levelFromRating(rating, verified)` (`apps/web/lib/queries.ts:64-66`):
`if (rating >= 4.8 && verified) return "Master"`. La columna `profiles.verified` **no la
escribe ningún código de la aplicación** — está congelada por `freeze_profile_trust_fields`
(0008) para cualquier UPDATE propio, y sólo se puede poner a mano por SQL (confirmado leyendo
0001, 0006, 0008; el propio código lo dice en tres comentarios distintos:
`apps/web/lib/site.ts:13`, `apps/web/app/(pro)/pintores/page.tsx:9-13`,
`docs/datos-personales.md:80-86`).

**Lo comprobé en vivo**, con la clave anon pública (sin sesión):

```
curl "$SUPABASE_URL/rest/v1/profiles?select=id,full_name,verified,rating&type=eq.painter&verified=eq.true"
→ [{"full_name":"Martín Rojas","verified":true,"rating":4.9}, {"full_name":"Lucía Fernández","verified":true,"rating":4.7}]
```

Y abriendo `/pintor/2452396f-df2f-4c15-8078-b4e1dd6a1407` con el navegador del kit, el HTML
servido trae literalmente:

```html
<span class="...">Master</span><span class="...">Verificado</span>
```

**Qué dice el código que pasa de verdad:** cualquier perfil con `verified=true` puesto a mano
por SQL (sin ningún criterio, proceso ni fecha registrados en ningún lado) y `rating >= 4.8`
muestra "Verificado" al público, sin tooltip ni explicación de qué se verificó (¿identidad?
¿matrícula? ¿antecedentes? ¿seguro?). `/pintores` y `/nosotros` sí se corrigieron para no
prometer "verificación" como política general (comentarios en el propio código lo explican),
pero el badge individual sigue vivo y nadie lo está mirando.

**Quién podría reclamar y por qué:** un cliente que contrata a "Martín Rojas — Verificado"
confiando en que Pintura Pro comprobó algo (identidad, antecedentes, matrícula) y después tiene
un problema con él, tiene un caso de publicidad engañosa bajo el art. 8 y 19 de la Ley 24.240
("las precisiones formuladas en la publicidad... obligan al oferente"): la empresa prometió
información que no tiene y no puede sostener. La AAIP no es el organismo acá — es Defensa del
Consumidor. **Esto es medido, no una sospecha**: el badge está en producción ahora mismo, sobre
un pintor real de la demo con reseñas reales.

**El arreglo más barato:** sacar el `{painter.level === "Master" && <span>Verificado</span>}`
del componente (dos líneas) hasta que exista un proceso real de verificación con su propio
texto explicando qué se verificó. El nivel "Master/Gold/Silver" en sí (basado sólo en
`rating`, que sale de reseñas reales) no tiene este problema — es sólo la palabra "Verificado"
la que promete algo que no existe.

---

## IMPORTANTE

### 2. El pie de los emails transaccionales quedó con la identidad vieja de "empresa de pintura"

**Dónde:** `apps/web/lib/email.ts:135`, dentro de `emailLayout()`, la plantilla que usan los
tres avisos reales (`cotizar`, `aceptarCotizacion`, `cancelarTrabajo` en
`apps/web/app/(marketplace)/actions.ts:146-156, 267-278, 320-330`):

```tsx
<p style="...">Pintura Pro · Pintura profesional de obra</p>
```

**Qué dice el código que pasa de verdad:** "Pintura profesional de obra" es exactamente el
tipo de frase que otras rondas ya sacaron de la portada, `/nosotros`, el pie del sitio y la
meta-descripción por describir una empresa que pinta, cuando Pintura Pro es un marketplace
puro (decisión del dueño, 27/9). Quedó viva en el único lugar que nadie audita mirando
pantallas: el HTML que se manda por Resend. Todo pintor y todo cliente que reciba un aviso de
cotización, de trabajo aceptado o de cancelación la ve en el pie de cada correo.

**Quién podría reclamar y por qué:** un cliente que lee "Pintura profesional de obra" al pie
de un mail y después tiene un problema con la pintura, puede razonablemente entender que le
escribe a la empresa que pintó — exactamente la confusión que `/terminos` (`"El trabajo se
contrata entre vos y el pintor... Pintura Pro no es parte de ese acuerdo"`) trata de evitar.
Es el mismo riesgo que ya está documentado para la portada vieja, ahora en un canal que hoy
está inactivo (no hay `RESEND_API_KEY`, `EMAIL_READY=false`) pero que se activa solo el día
que se cargue la clave — sin que nadie revise el contenido de nuevo.

**El arreglo más barato:** cambiar la línea por algo como `Pintura Pro · Conectamos clientes con pintores independientes` (ya existe la frase correcta en `SITE_DESCRIPTION`, `apps/web/lib/site.ts:18`; reusarla evita que se desincronice otra vez).

---

## MENOR / DUDA PARA EL ABOGADO

### 3. Inscripción de la base ante la AAIP: no está mencionada en ningún lado público

Comprobado con `grep` en todo el sitio público (`/privacidad`, `/terminos`, footer): la
palabra "AAIP" sólo aparece en `/privacidad` como el organismo que **atiende denuncias**
(`apps/web/app/(marketing)/privacidad/page.tsx:~245`), nunca como "esta base está inscripta
bajo el N°...". `docs/datos-personales.md:151-157` ya lo tiene anotado como pendiente interno
("Inscribir la base... Confirmalo con el abogado: es el punto donde más seguido se equivoca
todo el mundo"), pero es un documento interno para el dueño, no algo que lea un usuario ni la
propia AAIP. No es un hallazgo nuevo de fondo — es la confirmación explícita que pedía esta
ronda — pero no estaba como ítem propio en `BITACORA.md → Abierto` (ahí sólo figura junto a
"faltan datos legales del responsable", que es un requisito distinto: identificar al
responsable no es lo mismo que inscribir la base).

**Quién la inscribe:** es un trámite que hace el responsable de la base (el titular de
Pintura Pro) ante la AAIP, no algo resoluble desde el código. Es gratuito y se hace con CUIT,
así que depende de que primero exista la razón social (el mismo pendiente ya anotado en
`BITACORA.md`).

**Para el abogado:** confirmar si además de inscribir la base conviene declarar en
`/privacidad` el número de inscripción una vez obtenido — es una práctica que da más
credibilidad y que algunos consumidores/abogados de la contraparte buscan primero.

### 4. Relación con los pintores: revisé señales de subordinación y no encontré ninguna en el código — vale la pena decirlo para que el abogado no tenga que buscarlo de nuevo

Repasé, contra el código (no sólo contra el texto):

- **Asignación de trabajo:** el cliente elige entre cotizaciones; ningún código le asigna un
  pedido a un pintor en particular (`puedeCotizar` en `packages/dominio/src/roles.ts:12-14`
  sólo filtra por `type`, no por rating ni antigüedad).
- **Precio:** el pintor escribe el monto libremente (`quote-form.tsx`); no hay piso, techo ni
  tabla de precios sugerida por la plataforma, sólo un límite superior de cordura de mil
  millones de pesos (`MONTO_MAXIMO`, para atajar errores de tipeo, no para fijar precio).
- **Exclusividad:** no encontré ninguna cláusula ni control de código que impida a un pintor
  trabajar con otras plataformas o de forma directa.
- **Horario/uniforme/herramientas provistas:** no hay nada en el código ni en los textos.
- **Sanción automática por rating bajo:** no existe. La única mención de "suspender" es en
  `/terminos` ("Podemos suspender una cuenta que incumpla estas reglas") y es por
  incumplimiento de conducta (reseñas falsas, fotos ajenas), no por desempeño — no hay código
  que desactive perfiles con rating bajo.
- **Textos:** `/nosotros`, `/terminos` y la meta-descripción usan consistentemente "pintores
  independientes" (ver `apps/web/lib/site.ts:18`, `apps/web/app/(marketing)/nosotros/page.tsx`),
  sin mezclar "nuestro equipo" ni "nuestros pintores".

**Conclusión (deducida, no certeza legal):** con el código de hoy, las señales típicas que la
Justicia laboral argentina miró en casos de plataformas (asignación algorítmica del trabajo,
fijación de precio, exclusividad de facto, sanción por métrica de desempeño) **no están
presentes**. Es una buena noticia para el diseño actual, pero la conclusión final es del
abogado — yo sólo puedo decir qué no encontré en el código.

### 5. Res. 424/2020 (botón de arrepentimiento / identificación del proveedor / botón de baja): aplicabilidad, punto por punto

- **Identificación del proveedor** (razón social, CUIT, domicilio, medios de contacto): **aplica
  con certeza** — Pintura Pro ofrece un servicio a distancia dirigido a consumidores en
  Argentina. Ya está anotado en `BITACORA.md → Abierto` como pendiente; no lo repito, sólo
  confirmo el marco normativo específico (además de la Ley 25.326/AAIP, es la Res. 424/2020 y
  el art. 4 de la Ley 24.240 los que lo exigen).
- **Botón de baja** (poder dar de baja un servicio contratado a distancia con la misma
  facilidad con la que se contrató): **aplica, y hoy se cumple.** Comprobado en el código:
  `/mi-cuenta` tiene una baja de cuenta self-service, sin intervención humana
  (`apps/web/app/mi-cuenta/borrar-cuenta.tsx`, acción `eliminarMiCuenta`), y `/privacidad` lo
  describe correctamente ("podés... eliminar tu cuenta, sin pedirle permiso a nadie y en el
  momento"). No es un hallazgo, es una confirmación de que esto ya funciona.
- **Botón de arrepentimiento** (los 10 días para desistir de una compra a distancia, con un
  botón visible en el mismo entorno de contratación): **duda para el abogado**, no una
  certeza — ya está anotada la pregunta de fondo en `BITACORA.md → Abierto` ("Derecho de
  arrepentimiento"). Lo que agrego: la Res. 424/2020 exige el botón a quien **vende** bienes o
  servicios a distancia. Pintura Pro no cobra ni vende el trabajo de pintura (lo dice
  `/terminos`, y es cierto: no hay pasarela de pago conectada) — el contrato de pintura es
  entre cliente y pintor. La duda concreta para el abogado es si la propia **intermediación**
  (una plataforma que hace posible, a distancia y sin contacto previo, que un consumidor
  contrate a un proveedor) alcanza para que el deber recaiga sobre Pintura Pro, sobre el
  pintor, sobre ninguno, o sobre los dos. No lo puedo resolver leyendo código.

### 6. Reseñas: hay canal de denuncia, pero es sólo un email, y el pintor no puede responder públicamente

**Medido:** `/terminos`, sección "Denunciar un contenido" (`apps/web/app/(marketing)/terminos/page.tsx:185-199`),
dice explícitamente a quién escribirle (`hola@pinturapro.ar`) y qué esperar ("revisamos cada
pedido y respondemos; si el contenido incumple estas reglas, lo damos de baja"). Es real y
está declarado — no es un hallazgo de "esto es falso".

**Lo que falta (no lo que está mal):** no hay ningún botón de "reportar" en la reseña misma
(`apps/web/components/features/review-system.tsx`, 101 líneas, es sólo de lectura: estrellas,
distribución, comentario) ni forma de que el pintor deje una respuesta pública a una reseña
que considera injusta. Hoy la única vía es el email del canal general. Es una mejora de
producto, no una falla legal: el canal existe y está documentado, sólo que vive un paso más
lejos de lo ideal. **Severidad: menor.**

### 7. Consentimiento pedido *antes* de dar el dato: bien en el alta de cuenta, ausente en los formularios de postulación y contacto

**Medido:** `/crear-cuenta` (`apps/web/app/(auth)/crear-cuenta/page.tsx:136-152`) exige tildar
"Soy mayor de 18 años y acepto los términos... y la política de privacidad" antes de poder
enviar el formulario, y el mismo bloqueo aplica a los botones de login social. Esto ya está
bien y es reciente (comentario del propio código lo explica).

**Lo que no tiene el mismo tratamiento:** `/registro` (postularse como pintor,
`apps/web/app/(pro)/registro/page.tsx`) y `/contacto`
(`apps/web/app/(marketing)/contacto/page.tsx`) piden nombre, email y teléfono (`/registro`
también zona y años de experiencia) y los mandan a la tabla `leads` y por email a la casilla de
la empresa (`notifyLeadsInbox`, `apps/web/lib/email.ts:78-87`), **sin ningún link a
`/privacidad` ni `/terminos`, ni casilla de consentimiento**, a diferencia de `/crear-cuenta`.
No hay reclamo formado por esto (es una postulación laboral o una consulta comercial, y podría
ampararse en la excepción de "necesidad para una relación precontractual" del art. 5 de la Ley
25.326), pero es una inconsistencia real dentro del mismo sitio: un dato que en un formulario
requiere un acto afirmativo de consentimiento, en otro se pide sin decir a dónde va. **Duda
para el abogado** si la excepción precontractual alcanza, o si conviene agregar el mismo link
(no hace falta la casilla, alcanzaría con una línea "Al enviar este formulario, tus datos se
tratan según nuestra política de privacidad" con el link).

### 8. Mails transaccionales: qué se manda, con qué base y si hay opt-out — medido, sin hallazgos

Repasé los tres emails reales del ciclo de vida de un trabajo (nueva cotización, cotización
aceptada, trabajo cancelado — `apps/web/app/(marketplace)/actions.ts`), más el aviso al pintor
por consulta/postulación (`(marketing)/actions.ts`). **Los cuatro son estrictamente
transaccionales**, disparados por una acción del propio usuario o de la contraparte de un
trabajo en curso: no encontré ningún envío promocional, boletín o "novedades" (`grep` de
"newsletter" y "promoción" en todo `apps/web` no devuelve nada). La base legal es la ejecución
del vínculo contractual/de uso del servicio (no necesita un opt-in de marketing aparte), y
`/privacidad` ya dice "no vendemos tus datos ni los cedemos con fines publicitarios" — cierto
por lo que vi. No hay opt-out visible para estos avisos (ej. "no quiero recibir el aviso de
cotización nueva"), pero al ser notificaciones operativas de una acción propia del usuario
(equivalentes a "te llegó un mensaje"), no exigen uno bajo el estándar habitual — **duda menor
para el abogado**, no un hallazgo.

---

## Funciona bien (verificado, no rellenar más)

- La comisión del 10% se muestra al pintor **antes** de cotizar, en pantalla y por voz
  (lector de pantalla), con el monto ya calculado (`quote-form.tsx:36-40`) — cumple lo que pide
  el punto 4 de esta ronda.
- `/terminos` distingue con precisión la comisión que se calcula (`commission_amount`, guardada
  en cada `job`) de la que se cobra (ninguna, todavía: no hay pasarela conectada), y lo dice en
  el propio texto ("todavía no se cobra... cuando empiece a cobrarse te lo vamos a avisar
  antes"). No hay ninguna promesa de garantía o retención de pago que el código no sostenga.
- El botón de baja de cuenta (`/mi-cuenta`) y la descarga de datos ya existen y son
  self-service, cumpliendo de hecho el estándar de "misma facilidad para darse de baja que
  para darse de alta" del art. 10 ter de la Ley 24.240.
- No encontré, en el código actual, ninguna de las señales clásicas de subordinación laboral
  encubierta (asignación algorítmica, fijación de precio, exclusividad, sanción automática por
  rating) — ver punto 4 arriba para el detalle.

---

## Resumen para el dueño (por si no lee todo lo de arriba)

1. **Sacar la palabra "Verificado" de `/pintor/[id]`** (dos líneas de código) hasta que exista
   un proceso real detrás. Es el hallazgo más urgente de esta ronda: está en producción, sobre
   un perfil real, ahora mismo.
2. **Corregir el pie de los emails** (`apps/web/lib/email.ts:135`): todavía dice "Pintura
   profesional de obra". Un cambio de una línea.
3. Cuando se resuelva la razón social/CUIT (ya pendiente en `BITACORA.md`), agendar también la
   inscripción de la base ante la AAIP — es un trámite separado, no automático.
4. Preguntarle al abogado sobre el botón de arrepentimiento de la Res. 424/2020 aplicado a un
   intermediario puro (no es lo mismo que ya preguntó sobre el derecho de arrepentimiento en
   general).
5. Opcional, barato: agregar un link a `/privacidad` en `/registro` y `/contacto`, igual que ya
   tiene `/crear-cuenta`.

## Qué no comprobé (limitaciones de esta ronda)

- No abrí sesión como pintor ni cliente reales para ver el flujo completo de principio a fin
  (no hizo falta: todo lo relevante se verificó por código + API pública de sólo lectura +
  una visita anónima al navegador).
- No consulté al abogado real; todo lo marcado "duda" queda así a propósito.
- No revisé la app móvil en profundidad (no se puede correr desde el Codespace, por regla del
  proyecto) más allá de confirmar por `grep` que no replica el badge "Verificado".
