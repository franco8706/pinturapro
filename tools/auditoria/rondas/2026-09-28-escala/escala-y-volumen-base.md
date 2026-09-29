# Reporte — escala-y-volumen (papel base), ronda 2026-09-28-escala

## 1. A qué escala se rompe

| Qué | 100× | 1.000× |
|---|---|---|
| `getNumerosReales`: `reviews.select("rating")` sin `.limit()` (`queries.ts:1498`) | **se rompe**: PostgREST corta a 1.000 filas (tope de fábrica); promedio/contador de la home, sobre subconjunto arbitrario | **Confirmado por código** |
| `getPedidosYaCotizados`, `jobs` sin `.limit()` (`:816-834`) | pintor activo supera 1.000 trabajos; `/trabajos` reofrece "Cotizar" sobre algo ya cotizado | **Confirmado, volumen.sql** |
| `getPedidosDelCliente`/jobs, `.in(project_id)` sin `.limit()` (`:1265-1268`) | cliente popular junta miles de cotizaciones ajenas; panel muestra "Cerrado" en un pedido ya adjudicado | **Confirmado, volumen.sql** |
| Storage (1 foto/obra, ~200-400KB) | 700 obras ≈ 150-280MB | 7.000 obras ≈ 1,4-2,8GB, **supera el 1GB free** (proyectado) |
| `recalc_profile_rating` | pintor c/300 reseñas: reagrega 300 por alta | c/3.000: O(n) por alta, O(n²) en serie. **Medido, Bloque 7a** |
| `on_job_accepted` (cascada) | 100 vivas: cancela 99 en la misma tx | 500 vivas: cancela 499, 2 triggers c/u. **Medido, Bloque 7b** |
| Policies sin `(select auth.uid())` | notable sin filtro | 200.000+ jobs: RLS fila por fila. **Medido, Bloque 10** |
| `count:"exact"` en `/api/health` (4 tablas, cada 1 min) | 4 recorridos/min | ídem, más caro (deducido) |
| Índices que faltan (`reviews` target+fecha; testimonios home) | `Sort` explícito | scan/sort en cada visita a `/pintor/[id]` y `/`. **Medido, Bloque 8** |

## 2. Los tres cambios que más ganan

1. **Sacar los 3 `.select()` sin `.limit()`** de arriba. El de la home, como `metricas_plataforma()` (función SQL server-side); los otros dos, acotando por ids ya paginados + `.limit()`. Costo: migración chica + ~10 líneas en `queries.ts`.
2. **Envolver `auth.uid()`/`es_pintor()`/`es_admin()` en `(select …)`** en las 14 policies del punto 3. Costo: migración de RLS, sin tocar la app.
3. **Dos índices**: `reviews(target_id, created_at desc)` y `reviews(created_at desc) where comment is not null and rating>=4` (testimonios, corre en cada visita a `/`). Costo: migración con `create index concurrently`.

## 3. Policies fila por fila (`auth_rls_initplan`)

| Policy | Migración | Envolver |
|---|---|---|
| `profiles_select_publicos_o_con_sesion` | 0013 | `auth.uid()` |
| `profiles_insert_own` / `update_own` | 0001 | `auth.uid()` |
| `projects_select_pub_own_o_adjudicado` | 0014 | 2× `auth.uid()` (uno en `exists`) |
| `projects_insert_own` / `update_own` / `delete_own` | 0016 | `auth.uid()` + `es_pintor()` |
| `jobs_select_participant` | 0001 | 2× `auth.uid()` |
| `jobs_update_client` / `jobs_update_painter` | 0006 | `auth.uid()` (using+check) |
| `jobs_insert_painter_quote` | 0018 | 3× `auth.uid()` + `es_pintor()` |
| `reviews_insert_author` | 0006 | 2× `auth.uid()` |
| `leads_select_admin` / `leads_update_admin` | 0023 | `es_admin()` |

Todas: `X` → `(select X)`. `es_pintor()`/`es_admin()` ya leen `auth.uid()` adentro (`security definer`), pero sin `select` en la policy Postgres las reinvoca por fila igual.

## 4. Índices, triggers y cuotas (resumen)

Cubiertos: `idx_profiles_pintores_por_rating` (0021), `idx_projects_*`, `idx_jobs_client/painter/project/status`, `uniq_jobs_quote_viva`. Faltan los del 2.3 + apoyo para `volumen_mensual()` (12 subconsultas por `date_trunc(updated_at)` sin índice, en cada `/panel`). Triggers baratos: `enforce_job_rules`, `una_sola_adjudicacion`; caros con volumen, los de la tabla 1. `count:"exact"`: 2 en `getNumerosReales` (no afectado por el tope de 1.000, `head:true` no baja filas) + 4 en `/api/health` (sin filtro, cada minuto). **SMTP**: cero coincidencias en el repo; Auth usa el mailer de fábrica (pocos/hora); `RESEND_API_KEY` es sólo para avisos de negocio — con 50 altas/hora, casi nadie recibe confirmación ni recuperación (tarea de panel, BITÁCORA). **Storage**: 1 foto/obra y 1/avatar (1600/512px); supera el 1GB free antes de 1.000×.

## 5. Estado de `tools/auditoria/escala/volumen.sql`

**Escrito y completo**, no ejecutado (sin contraseña). `begin;`…`rollback;`, sin `commit`. Genera ~300.000 filas (3.000 pintores, 4.000 clientes, ~9.000 obras, ~50.500 pedidos —uno "estrella" con 500 cotizaciones vivas—, ~203.500 trabajos, ~103.000 reseñas —3.000 sobre un "pintor estrella"—) soltando `profiles_id_fkey` (DDL transaccional, se repone sola) con ids determinísticos; si el rol no puede, Plan B documentado adentro: recicla los 3 pintores reales existentes (sirve para tamaño de tabla, no para `/pintores` con 3.000 pintores reales).

**Agregado esta vuelta**: revisé las ~30 consultas de `queries.ts` contra `.limit()`. Además de `getNumerosReales`, encontré **`getPedidosYaCotizados`** y **`getPedidosDelCliente`/jobs** sin límite. Sumé un bloque a cada una (Bloque 9): corre la consulta real contra el pintor/cliente "estrella" + `count(*)` de cuántas filas traería. El corte de 1.000 lo aplica PostgREST, no Postgres — el `explain`/`count` de acá no lo muestra recortado, pero confirma que las tres piden, sin límite, un volumen que en la API real cae del lado malo del corte de fábrica.

**Qué mirar**: Bloque 7, `Trigger …: time=` de `recalc_profile_rating` y la cascada de `on_job_accepted`. Bloque 8, `Seq Scan`/`Sort` en `getRecentReviews` y `getReviewsForPainter`. Bloque 9, los `RAISE NOTICE` con el conteo de las dos consultas nuevas. Bloque 10, antes/después de envolver `auth.uid()`.
