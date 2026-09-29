# abuso-marketplace — robot (ronda 2026-09-28-escala)

Contra `:3000` (desarrollo). No se crearon cuentas ni se disparó ningún mail real (verificado:
`RESEND_API_KEY` no está configurada en `apps/web/.env.local`, así que `/contacto` no manda
correo aunque guarde el lead; para alta y `/recuperar` no se probó en vivo, se leyó el código).

## 1. Altas en masa — `/crear-cuenta`
**¿Se puede?** Deducido. `crear-cuenta/page.tsx` llama `supabase.auth.signUp` directo desde el
browser con la anon key; no hay `captchaToken`, ni hCaptcha/Turnstile en ningún lado del repo
(`grep -ri captcha` no encuentra integración real), ni `middleware.ts` agrega ningún tope. La
única barrera es lo que Supabase Auth traiga por defecto para el proyecto, invisible desde el
código. **Costo:** un POST por cuenta, gratis, scripteable sin browser. **Perjudicado:** el
proyecto de Supabase (cuota de auth, reputación de envío) y cualquier defensa que dependa de
"una persona, una cuenta" (reseñas, cotizaciones). **Rastro:** ninguno más que los logs de
Supabase. **Defensa barata:** activar el captcha de Supabase Auth (Turnstile, gratis) y pasar
el token en el `signUp`; es config + una prop, no una migración. **Severidad: IMPORTANTE**, no
bloqueante hoy (poco tráfico), pero antes de una campaña sí.

## 2. `/recuperar` contra un tercero
**¿Se puede?** Deducido. Mismo patrón: `resetPasswordForEmail` sale directo del browser. El
único cerrojo en el código es un `useRef` en el CLIENTE (`enviando.current`) que sólo frena
clics dobles en la MISMA carga de página — recargar, o pegarle al endpoint de Supabase
directo, lo saltea sin esfuerzo. No hay tope por IP ni por email en la app. Enviar el mail
depende sólo del límite propio de Supabase Auth, no configurado desde este repo. **Costo:**
gratis. **Perjudicado:** el dueño del email ajeno, bombardeado de enlaces de recuperación que
no pidió. **Rastro:** ninguno visible para el admin del sitio. **Defensa barata:** mismo
captcha que en el alta, más un tope server-side liviano (igual al de `/contacto`, ver abajo).
**Severidad: IMPORTANTE.**

## 3. `/contacto` en ráfaga — MEDIDO en vivo
7 envíos reales (navegador propio, sin recargar la ip): los primeros 5 entraron
("Mensaje enviado"), el 6º y 7º devolvieron "Recibimos varios mensajes desde acá. Probá de
nuevo en un rato." — el tope de 5/hora (`actions.ts:27`) funciona tal cual está escrito. El
campo trampa (`website`) también se probó por código: si se completa, la acción devuelve
`{ok:true}` SIN guardar nada y SIN gastar cupo de la ráfaga (`esBot` corre antes que
`rateLimited`) — bien pensado. **Ojo:** el contador vive en memoria del proceso, clave
`x-forwarded-for` o, si no hay proxy delante (como en este `:3000` directo), cae en la
constante `"desconocido"` — un solo balde compartido por TODO el tráfico sin proxy. En Cloud
Run el load balancer sí pone `x-forwarded-for`, pero vale confirmarlo con el agente
`nube-google`. **Costo/perjudicado/rastro:** ninguno nuevo, funciona. **Severidad: MENOR**
(nota para verificar en producción, no un hallazgo nuevo).

## 4. Raspar el directorio con la clave anon — MEDIDO
`profiles`: sin sesión sólo trae `type in (painter, company)` (4 filas hoy) con las columnas
otorgadas por 0006 (nombre, avatar, bio, ubicación, rating, specialties, pros/cons); `lat`,
`lng`, `phone`, `is_admin` devuelven 401 por columna, confirmado uno por uno. `projects`: igual,
sin lat/lng. `jobs` y `leads` devuelven `[]` a la anon key (RLS los vacía). Todo esto ya estaba
cerrado en rondas previas (0013/0020/0023) y sigue cerrado: **no hay regresión.**

**Hallazgo nuevo:** la función pública `pedidos_abiertos()` (RPC, la usa `/trabajos`) SÍ se
puede llamar sin sesión y sin ningún tope propio — a diferencia de `/contacto` y
`/api/segment`, que tienen su contador. Un solo POST a `rpc/pedidos_abiertos` devolvió el
pedido abierto completo: título, **descripción con detalles del domicilio** ("hay humedad en
una pared del patio"), ubicación, presupuesto y el `owner_id` del cliente. El comentario de
0001 ya lo marca como "decisión de producto, no de seguridad" — de acuerdo en el principio
(el tablero es público a propósito), pero el ROBOT no tiene ningún techo: puede pedirlo miles
de veces por minuto sin que nada se entere, a diferencia de leads/segment. **Perjudicado:**
el cliente, cuya descripción del trabajo (a veces con detalles internos de la casa) se cosecha
en bloque. **Defensa barata:** el mismo contador en memoria de `actions.ts`, aplicado a esta
RPC desde la Server Component que la llama (no se puede limitar la RPC en sí sin tocar SQL).
**Severidad: IMPORTANTE** para dimensionar, no urgente con 1 pedido en la base.

## 5. Cuota del simulador — `/api/segment`
Sin cambios desde la ronda anterior (código idéntico a lo que ya está en "Lo que aprendieron").
Confirmado en vivo, sin costo: un POST sin sesión devuelve `401` antes de tocar Replicate. No
se hicieron llamadas autenticadas para no quemar cupo pago real. Sigue abierto lo ya sabido:
cuota de 12/hora en memoria y **por instancia** (Cloud Run con N instancias = N × 12 reales).

## 6. Recorrer ids — MEDIDO, no se puede
Todas las tablas (`profiles`, `projects`, `jobs`, `reviews`) usan `uuid` con
`gen_random_uuid()`, no enteros secuenciales. Los slugs de obra (`casa-barracas`) salen del
título, no son un índice. No hay superficie para recorrer ids. **Sin hallazgo.**

## Datos ZZAGENT creados
5 filas en `leads` (kind=`contact`, `source_path=/contacto`): nombre `ZZAGENT robot 1` a
`ZZAGENT robot 5`, email `zzagent.robot1@pinturapro.demo` … `zzagent.robot5@pinturapro.demo`.
Ningún mail salió (sin `RESEND_API_KEY`). Nada más: ninguna cuenta, job ni reseña.
