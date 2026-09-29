# Auditoría RLS/funciones — ronda 2026-09-28-escala (agente seguridad-rls)

Foco: las 16 funciones de `COBERTURA.md` sin ninguna prueba/agente, más policies finales de
`jobs`, `reviews`, `projects`, `profiles`, `leads`. Verificación en vivo contra `/rest/v1/rpc/*`
con la clave anon y con una sesión demo (`marina.acosta@pinturapro.demo`, cliente). No se
escribió nada: el único intento de escritura (`leads` con anon) fue rechazado por permisos antes
de insertar ninguna fila, y no se tocó ningún perfil ni el trabajo sagrado de cliente4/pintor2.

## Resumen — no encontré hallazgos nuevos explotables

Las 16 funciones "sin prueba" se dividen en dos grupos y los dos están bien, **verificado leyendo
el código y en vivo**:

**A. Funciones-trigger, no invocables por RPC de ningún modo:** `enforce_job_rules`,
`on_job_accepted`, `on_job_cancelled`, `on_review_change`, `una_sola_adjudicacion`,
`freeze_profile_trust_fields`, `handle_new_user`, `set_updated_at`. Todas devuelven el
pseudo-tipo `trigger`, que Postgres no permite invocar fuera de un trigger. Confirmado: las 8
devuelven `404 PGRST202` ("no matches were found in the schema cache") contra
`/rest/v1/rpc/<función>`, con y sin sesión — no es un error de permisos, PostgREST ni siquiera
las expone como invocables. El `revoke`/`grant` de la REGLAS §3 no aplica porque no hay superficie
que cerrar. Todas las que son `security definer` (`enforce_job_rules`, `on_job_accepted`,
`on_job_cancelled`, `una_sola_adjudicacion`, `freeze_profile_trust_fields`, `handle_new_user`)
tienen `set search_path = public`. `set_updated_at` no es `security definer` y no toca datos
sensibles (sólo `new.updated_at = now()`), así que no necesita search_path fijo.

**B. Funciones RPC de verdad, con revoke/grant correctos, confirmado en vivo:**

| Función | Migración (última) | security definer + search_path | Grant final | Verificado |
|---|---|---|---|---|
| `mi_telefono()` | 0011 | sí | sólo `authenticated` | anon → 401 `42501`; marina (cliente) → devuelve su propio teléfono, nada de otro perfil |
| `contacto_del_trabajo(uuid)` | 0011 | sí | sólo `authenticated` | anon → 401; marina con `job_id` ajeno → `[]` (no filtra, no revienta) |
| `metricas_plataforma()` | 0012 | sí, lee `is_admin` adentro (bypassa el grant por columna a propósito, es el propio dueño de la función) | sólo `authenticated` | anon → 401; marina (no admin) → `[]`, cero filas, no cero-con-datos |
| `volumen_mensual()` | 0012 | sí | sólo `authenticated` | anon → 401 (no probé con marina, mismo `where exists` que metricas) |
| `actividad_reciente(int)` | 0012 | sí | sólo `authenticated` | anon → 401 |
| `pintores_geolocalizados()` | 0020 (redondea a 2 decimales) | sí | `anon, authenticated` (a propósito: mapa público) | anon → 200, devuelve sólo `type='painter'`, coordenadas con 2 decimales (`-34.59`, no `-34.5889`) — confirma que 0020 sigue aplicada, sin regresión |
| `pedidos_abiertos(int)` | 0014 | `security invoker` (a propósito, respeta RLS) | `anon, authenticated` | anon → 200, un solo pedido publicado, mismos campos que expone `projects` por columna |
| `recalc_profile_rating(uuid)` | 0023 (revocada también a `authenticated`) | sí | nadie salvo el trigger interno | anon → 401; marina (authenticated) → 401 también — confirma que 0023 cerró el hueco que quedaba tras 0018 |
| `es_admin()` | 0023 | sí | sólo `authenticated` | marina → `false` (no filtra información, sólo confirma su propio estado) |
| `es_pintor()` | 0016 | sí | sólo `authenticated` | marina (cliente) → `false` |
| `es_service_role()` | 0006 | no (no toca tablas, sólo lee el claim JWT propio) | **sin revoke, PUBLIC/anon la pueden llamar** | anon → 200, `false` |

## Hallazgo menor — verificado en código y en vivo

**`es_service_role()` es la única función nueva sin `revoke execute ... from public, anon`**
(`supabase/migrations/0006_security.sql:23-30`). Rompe la convención que las REGLAS piden para
"cada función nueva". En la práctica no filtra nada: no consulta ninguna tabla, sólo lee
`request.jwt.claims->>'role'` de la sesión de quien llama, y ese claim lo firma Supabase Auth —
nadie puede falsificar `role: service_role` con la clave anon. Confirmado en vivo:
`POST /rest/v1/rpc/es_service_role` con la clave anon devuelve `200 false`. Severidad MENOR:
es una desviación de la convención, no una fuga. Recomendación: agregar el revoke de todos modos,
para que no sea la excepción que alguien copie como plantilla el día que se agregue una función
similar que sí toque una tabla.

Cómo confirmarlo sin sesión:
```
curl -X POST "$URL/rest/v1/rpc/es_service_role" -H "apikey: $ANON" -d '{}'
```

## Policies de `jobs`, `reviews`, `projects`, `profiles`, `leads` — última versión

Revisé cada policy activa (la que sobrevive después de todos los `drop policy if exists` en
orden de migración) contra lo que promete su nombre. **Ninguna quedó más abierta que su nombre**,
a diferencia del caso histórico de `jobs_insert_painter_quote` (ya corregido en 0016/0018).

- `jobs_insert_painter_quote` (0018, `supabase/migrations/0018_comision_y_permisos.sql:30-64`):
  exige `painter_id = auth.uid()` **y `public.es_pintor()`**, cliente≠pintor, aritmética de
  comisión 10% con tolerancia de $1, pedido `service`/`published`/del mismo dueño, y sin
  adjudicación previa. Coincide con el nombre. Verificado leyendo el código; no reproduje el
  ataque histórico para no crear datos.
- `jobs_update_client` / `jobs_update_painter` (0006): cada una sólo permite tocar la fila donde
  sos `client_id`/`painter_id`, y el trigger `enforce_job_rules` (0009, última versión) congela
  el dinero fuera de `quoted` y valida la máquina de estados por rol dentro de la policy. No hay
  policy de DELETE en `jobs` — a propósito (comentado en 0006: evita que se borre el rastro).
- `reviews_insert_author` (0006, `0006_security.sql:41-52`): exige `author_id = auth.uid()` **y**
  que exista un `job` propio, con ese `target_id`, en `status='completed'` — cierra el bypass
  histórico donde el atacante se fabricaba un job falso (la policy `jobs_insert_client` que lo
  permitía fue eliminada en la misma migración). No hay UPDATE/DELETE en `reviews`, a propósito.
- `projects_select_pub_own_o_adjudicado` (0014): pública si `published`, o si sos el dueño, o si
  sos el pintor con un `job` sobre ese proyecto (aunque ya no esté publicado). No filtra por
  columnas sensibles porque `projects` no tiene grant de tabla completo desde 0020 (sólo la
  lista de columnas sin `lat`/`lng`, confirmado en vivo: `select=lat,lng` → 401).
- `projects_insert_own` / `_update_own` (0016): `owner_id = auth.uid()` y, si `type <> 'service'`
  (o sea portfolio), exige `es_pintor()`. `projects_delete_own` no mira el rol a propósito
  (comentado: si una cuenta cambia de tipo, tiene que poder seguir borrando lo suyo) — es una
  decisión de producto, no una fuga (sigue exigiendo `owner_id = auth.uid()`).
- `profiles_select_publicos_o_con_sesion` (0020): pública sólo para `type in ('painter','company')`,
  o cualquier fila si hay sesión. El nombre coincide exactamente con el comportamiento.
  `profiles_insert_own`/`_update_own` (0001) exigen `auth.uid() = id`; los campos de confianza
  (`verified`, `rating`, `rating_count`, `is_admin`, y `type`/`onboarded` tras el primer
  onboarding) se revierten en `freeze_profile_trust_fields` (0008,
  `0008_admin.sql:26-53`) — confirmé que `is_admin` SÍ está en la lista de columnas congeladas
  (`new.is_admin := old.is_admin;`, línea 43), no es un hueco. No probé el UPDATE en vivo para no
  escribir sobre una cuenta demo; queda como **verificado por lectura de código**, con la consulta
  para confirmarlo si hace falta:
  ```sql
  begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','<uuid-marina>','role','authenticated')::text, true);
  update profiles set is_admin = true where id = '<uuid-marina>';
  select is_admin from profiles where id = '<uuid-marina>'; -- debería seguir false
  rollback;
  ```
- `leads_insert_any` fue **eliminada** en 0022 y el INSERT revocado de `anon, authenticated`
  (`0022_consultas_solo_por_el_formulario.sql:21-22`) — confirmado en vivo: `POST /rest/v1/leads`
  con la clave anon → `401 permission denied for table leads`, sin crear fila. `leads_select_admin`
  / `leads_update_admin` (0023) usan `public.es_admin()` en vez de leer `is_admin` directo, y la
  columna está revocada (`revoke select (is_admin) ... 0023`) — confirmado en vivo:
  `profiles?select=id,is_admin` con anon → 401. Sin regresión.

## Qué NO alcancé a probar en vivo (por las restricciones de la tarea: sólo lectura)

- El PATCH de `is_admin`/`verified`/`rating` sobre un perfil propio (arriba, queda como
  verificado por código).
- `contacto_del_trabajo` con un `job_id` real donde marina fuera parte (no tengo uno propio;
  usar el trabajo sagrado de cliente4/pintor2 estaba prohibido por REGLAS).
- `volumen_mensual()`/`actividad_reciente()` con la sesión de marina (probé sólo `metricas_plataforma()`
  con ella; las otras dos comparten exactamente el mismo `where exists(...is_admin)`, así que la
  inferencia es de bajo riesgo pero no es medición directa — **sospecha, no verificado**).

## Archivos leídos (para referencia, no se modificó ninguno)

`supabase/migrations/0001, 0002, 0003, 0006, 0007, 0008, 0009, 0010, 0011, 0012, 0013, 0014,
0015, 0016, 0018, 0019, 0020, 0021, 0022, 0023`.
