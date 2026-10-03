# seguridad-rls: revisión de 0024, 0025 y 0026 antes de aplicarlas

Método: lectura de código. No se corrió SQL. Todo lo de abajo es VERIFICADO LEYENDO salvo lo marcado "sospecha".
Versión vigente de cada policy tomada de 0001, 0004, 0006, 0013, 0014, 0016, 0018, 0023.

## Veredicto

| Migración | Veredicto |
|---|---|
| 0024 | Se puede aplicar tal cual. Las 14 policies conservan todas sus condiciones. Dos menores, sin bloqueo. |
| 0025 | Se puede aplicar tal cual. |
| 0026 | Se puede aplicar, pero los dos topes y el piso de $1.000 se esquivan con la clave pública (IMPORTANTE, abajo). Conviene corregir antes de darla por cerrada. |
| Orden | 0024, 0025, 0026 es válido. 0026 DEBE ir después de 0024 (ver 7). |

## 1. 0024: comparación policy por policy (sin pérdidas)

- jobs_select_participant, jobs_update_client, jobs_update_painter: idénticas a 0001/0006, solo envuelven `auth.uid()`.
- **jobs_insert_painter_quote** (0024:92-113) contra 0018:30-70: están las 14 condiciones (painter_id, es_pintor, client_id<>uid, status quoted, project_id not null, amount >0 y <=1e9, commission_amount not null, rate = 0.100, aritmética con tolerancia 1, pr.type service, owner_id=client_id, published, not exists adjudicado). La aritmética de comisión NO se perdió. `es_pintor()` sigue presente.
- **profiles_select_publicos_o_con_sesion** (0024:120) contra 0013:59: igual (`type in (painter, company) or uid is not null`).
- profiles_insert_own, profiles_update_own (sin with check, igual que 0001), projects_delete_own, projects_insert_own, projects_select_pub_own_o_adjudicado, reviews_insert_author (idéntica a 0006:42): iguales.
- leads_select_admin y leads_update_admin: `alter policy ... using` conserva el `to authenticated` de 0023 (alter no toca los roles). Igual.
- Nota: `alter policy projects_update_own` en 0024:126 reescribe el `using`; ver orden (punto 7).

Cómo confirmarlo en vivo (solo lectura): `select polname, pg_get_expr(polqual,polrelid), pg_get_expr(polwithcheck,polrelid) from pg_policy` antes y después, y comparar.

## 2. resumen_publico() (0024:19-33)

Verificado: `security definer`, `set search_path = public`, `stable`, revoke a public y grant a anon/authenticated. Devuelve 4 agregados: obras publicadas, trabajos completados, reseñas, promedio. Ninguna fila ni id de persona.
- MENOR (sospecha): `count(*)` sobre `jobs` y `reviews` sin caché en la base. Con 200.000 trabajos cualquiera con la anon key puede llamarlo en ráfaga (la caché de 60 s es de la web, no del RPC). Mitigación: índice parcial en `jobs(status)` where completed, o aceptar el costo.
- Inferencia: diferenciando dos llamadas se puede saber que alguien completó un trabajo o dejó una reseña, no quién. Las reseñas ya son públicas. Aceptable.

## 3. pedidos_abiertos(integer, timestamptz) (0024:39-64)

Verificado: la 0014 la definía `security invoker` con comentario explícito; la nueva no escribe `security invoker` pero es el valor por defecto, así que sigue respetando RLS. Se borra la firma vieja y se hace revoke from public + grant a anon/authenticated sobre la firma nueva: mismos grants que antes. `antes_de` solo filtra por `created_at <`; no abre nada (devuelve las mismas columnas y filas que ya veía el select directo). `limite` queda entre 1 y 100. La web llama `rpc("pedidos_abiertos", {limite: 50})` (apps/web/lib/queries/pedidos.ts:194) y api/health con `{limite: 1}`: ambas resuelven con el default de `antes_de`; no se rompen aunque se aplique antes de cambiar la web. La app móvil no la usa.

## 4. Revoke de es_service_role() (0024:150)

Verificado: todos los que la llaman son `security definer` y corren como su dueño, que conserva EXECUTE: enforce_job_rules (0009), freeze_profile_trust_fields (0006/0008), el trigger de 0006:170, y los dos triggers de 0026. Ninguna policy la nombra. Ningún código de apps, packages o tools la invoca por RPC. No se rompe nada con "permission denied". `auth.uid()` dentro de un definer sigue leyendo el JWT (es un GUC, no depende del rol).
Comprobación en vivo (solo lectura, sesión simulada): `set local role authenticated; select public.es_service_role();` debe dar `permission denied`; un `update` a un job propio debe seguir andando.

## 5. 0026

**IMPORTANTE A. Los topes se esquivan poniendo `created_at` en el pasado** (0026:37 y 0026:67). Los triggers cuentan filas con `created_at > now() - 1h`. `created_at` es columna normal con INSERT y UPDATE abiertos a `authenticated` (el grant por columna de 0020 es solo de SELECT; ninguna policy ni trigger la fija). Quien inserta con `created_at = '2020-01-01'` nunca se cuenta a sí mismo. El tope de 10 pedidos y el de 30 cotizaciones valen para la web, no para un `curl`, que es justo lo que 0026 dice cerrar.
Prueba: como cliente, `insert into projects (owner_id,type,title,slug,published,created_at) values (<uid>,'service','x','x1',true,'2020-01-01')` repetido 11 veces: las 11 entran.
Arreglo: en ambos triggers `new.created_at := now();` antes del conteo (con service_role se respeta el valor), o `revoke insert/update (created_at)`. Recomiendo el primero, porque `created_at` en UPDATE también permite sacar filas de la ventana.

**IMPORTANTE B. El tope de pedidos también se esquiva borrando.** `projects_delete_own` deja borrar el propio pedido; el conteo mira filas existentes. Insertar 10, borrar, insertar 10 más: ilimitado. (Un pedido adjudicado se borra igual; el job queda con `project_id` null por 0009/set null.) Arreglo: contar con un contador aparte, o aceptar el tope como control blando.

**IMPORTANTE C. El piso de $1.000 se esquiva con UPDATE.** El trigger de `jobs` es `before insert` únicamente. `enforce_job_rules` (0009) deja al pintor corregir `amount` en estado `quoted` con solo `amount > 0` y comisión coherente. Cotiza $1.000 y luego `patch amount=1, commission_amount=0` (round(1*0.1)=0, tolerancia 1). Arreglo: poner el chequeo `amount < 1000` también en `enforce_job_rules` cuando cambia `amount`, o hacer el trigger `before insert or update of amount`.

**MENOR D. Pedido de portfolio convertido a service.** `with check` permite `type = 'service'`; un pintor con una obra que tiene trabajos terminados puede pasarla a service. No es ofrecida de nuevo (`pedidos_abiertos` filtra por trabajos adjudicados) y el `using` no deja la inversa. No es el camino buscado (service adjudicado a portfolio): ese SÍ queda bloqueado, porque `using` evalúa la fila vieja, que es service con trabajo aceptado.

**MENOR E. Condición de carrera** de los conteos: dos inserciones simultáneas pueden pasar el tope por 1 o 2. Aceptable.

Lo que sí está bien (verificado leyendo): los triggers son `security definer` con `set search_path`, con revoke a public/anon/authenticated (no invocables por RPC). `owner_id`/`painter_id` ajenos no sirven: la policy de insert ya exige `= auth.uid()`; el trigger corre antes del WITH CHECK y solo puede dar un error de mensaje. Anon no inserta por RLS. Los triggers de 0009 (on_job_accepted, on_job_cancelled) son definer, su dueño tiene bypassrls, no pasan por `projects_update_own`. La obra de portfolio queda editable por el dueño (rama `type <> 'service'`). Un service con trabajo accepted/in_progress/completed no se edita, ni se re-publica, ni cambia de `type`. El `with check` es el de 0024, sin pérdida. El probar-0026 cubre estos casos (3a, 3b, 3c) pero NO cubre `created_at` falso, borrar y reinsertar, ni el PATCH de monto: por eso los tres pasaron.
Observación (preexistente, no de 0026): `projects_delete_own` permite borrar un pedido adjudicado, que deja el job sin pedido.

## 6. 0025

Solo `update` por texto único (faqs.question, news.title, verificados con grep contra 0005: los 6 textos existen exactos). Sin cambio de esquema ni de permisos; si no hay coincidencia no hace nada. `news.published = false` coincide con `news_select_pub` (deja de verse). Nada raro.

## 7. Orden

- 0025 no depende de nada.
- 0026 usa `es_service_role()`; sirve antes o después del revoke de 0024 porque los triggers son definer.
- **0024 y 0026 modifican la MISMA policy** (`projects_update_own`). Si se aplica 0026 y después 0024 (o se vuelve a correr 0024), el `using` de 0024:127 pisa el de 0026 y se pierde en silencio la protección de pedidos adjudicados. Orden obligatorio 0024, 0025, 0026. Sugerencia: sacar `projects_update_own` de 0024 (es 0026 quien la define) o dejar un comentario.
- Después de aplicar: `select pg_get_expr(polqual, polrelid) from pg_policy where polname='projects_update_own'` debe mostrar el `not exists` sobre jobs.
