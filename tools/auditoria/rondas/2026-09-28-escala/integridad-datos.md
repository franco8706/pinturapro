# Integridad de datos — ronda 2026-09-28-escala

Método: `@supabase/supabase-js` con la clave de servicio, sólo lectura, desde un script dentro
de `apps/web`, borrado al terminar. Sin SQL directo.

## Estado general: sano, confirma lo esperado

`count(*)`: profiles 10, projects 7, jobs 25, reviews 20, leads 0. Storage (`projects` y
`avatars`, listado recursivo): 0 archivos, sin huérfanos ni referencias rotas.

Ratings (`profiles.rating`/`rating_count` vs `avg`/`count` real de `reviews` por `target_id`):
Martín Rojas 4.9/9, Lucía Fernández 4.7/7, Diego Sosa 4.5/4 — caché y fuente coinciden en los 3.

Estados imposibles, todos en 0 filas (tras notar que `f8bf7968…` "Estudio Nordelta" y
`fe8fc176…` "Loft Palermo" son `type='portfolio'`, no pedidos: sus 16 jobs son historial de obra
de los pintores, `client_id` ≠ `owner_id` ahí es diseño, no bug):
- Pedidos (`type='service'`) publicados con job aceptado/en curso/completado: 0.
- Dos jobs activos sobre el mismo pedido: 0. `commission_amount` ≠ 10% de `amount`: 0.
- `job.client_id` ≠ dueño del pedido (sólo pedidos service): 0.
- Reseñas de jobs no completados, duplicadas por job, o `target_id` ≠ `painter_id` del job: 0.
- `profiles`/`auth.users` sin contraparte, en ambos sentidos: 0.

Huérfanos esperados y ya documentados: 4 jobs con `project_id` NULL (`8ea35b5a`, `ac4bbe6e`,
`ecd2786e`, `5024df88`), todos `completed`, pintor Diego Sosa — su historial de reseñas (4) sin
obra asociada. Interno, nadie lo ve roto.

TOPES (`packages/dominio/src/topes.ts`) vs `check` de 0017: idénticos en los 10 campos.
`JobStatus` (`apps/web/lib/supabase/types.ts`) vs enum `job_status`: idénticos, 7 valores.
Índices vs filtros de `queries.ts` (owner_id, client_id, painter_id, project_id, status, type):
completos, sin gaps nuevos desde 0021.

## Restos de auditoría — VIEJOS, no de esta ronda

Dos perfiles con `bio` pisada, `updated_at` del **27/9** (ronda anterior); nadie de hoy los
tocó todavía (re-escaneado dos veces, sin nuevos ZZAGENT):
- `profiles` `0f6d9bfa-4d30-46c6-89bb-53b642512eb7` (Marina Acosta): `bio`="test qa". Original:
  sin bio (el seed no le pone a los clientes).
- `profiles` `2452396f-df2f-4c15-8078-b4e1dd6a1407` (Martín Rojas): `bio` termina en
  `" ZZAGENT-prueba-accesibilidad"`. Original: "Especialista en residencial, esmaltes y
  texturas. Acabados premium."
No son filas para borrar (violan §3bis: perfil editado sin restaurar) — hay que restaurar el
campo, no eliminar.

## Foco de escala: proyección a 3.000 pintores / 50.000 pedidos / 100.000 reseñas

Bytes JSON crudos por fila hoy (sin overhead de Postgres): profiles 445, projects 644, jobs
423, reviews 332. Jobs no tiene meta explícita; se deriva de la proporción actual jobs/reviews
(25/20=1,25) → ~125.000 jobs proyectados.

| Tabla | Hoy | Proyectado | Peso |
|---|---|---|---|
| profiles | 10 | 3.000 pintores (~10.000 con clientes) | 1,3–4,5 MB |
| projects | 7 | 50.000 pedidos + ~3.000 obras | ~34 MB |
| jobs | 25 | ~125.000 (derivado) | ~53 MB |
| reviews | 20 | 100.000 | ~33 MB |

Total ≈ 125 MB crudos; con índices y overhead de fila (+30-50%) ≈ 160-190 MB. Contra 500 MB
gratis: holgado, un tercio. Contra 8 GB Pro: irrelevante. **La base no es el cuello de botella.**

Fotos: medí con Chromium real las funciones de producción `resizeImage` (portada, máx 1600px,
q=0,85) y `resizeSquare` (avatar, 512×512, q=0,85) sobre 4 fotos reales — no hay archivos en
Storage para muestrear. Promedio: portada de obra **~295 KB**, avatar **~52 KB**. Sólo las obras
(`type='portfolio'`) suben foto; los pedidos no. Con **una sola** portada por pintor (3.000) ya
son ~907 MB, y sumando un avatar cada uno, ~1,07 GB — **supera el 1 GB del plan gratis de
Storage con el escenario más conservador posible** (una obra, sin fotos extra en `images[]`).
Storage, no la base, es el riesgo real de esta proyección.
