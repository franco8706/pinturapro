# abuso-marketplace · sub-agente cliente-tramposo — ronda 2026-09-28-escala

Cuenta: `cliente2` (javier.mendez). Cotizador: `pintor` (martin.rojas), sólo en pedidos
ZZAGENT. Medido en :3000 (desarrollo), con el kit de navegador y REST directo usando el token
de sesión de cliente2 (clave anon).

## 1. Pesca de datos de pintores — SE PUEDE, medido
Antes de aceptar (`/cotizaciones`) el cliente ve: nombre completo, nivel, ★, monto cotizado y
nota. NO ve teléfono ni mail (zona ya es pública en el perfil igual). Al aceptar,
`contacto_del_trabajo` entrega teléfono + WhatsApp al instante ("Martín Rojas: 11 4444-3333").
Después cancelé el trabajo (`cancelarTrabajo` lo permite en estado `accepted`) sin fricción: el
pedido reabre en el tablero y el `job` queda `cancelled`, sin costo ni demora.
**Costo**: cero. **Pierde**: el pintor (tiempo + teléfono regalado). **Rastro**: sólo en `jobs`
(status=cancelled); `/admin` no lista jobs ni cancelaciones, sólo `leads` y un directorio
agregado de pintores — un patrón de aceptar+cancelar repetido es invisible sin mirar la base.
**Defensa**: nada urgente con 3 pintores; con tráfico, un contador aceptados→cancelados por
cliente, visible en /admin.

## 2. Reseña sin trabajo — REBOTA, confirmado (no es novedad)
Por pantalla, el formulario sólo aparece si `job.status==='completed'`. Por REST directo
(`POST /rest/v1/reviews`, sobre el job cancelado) → **403** RLS. Sigue sólido.

## 3. Reseña como amenaza — se publica al instante, sin defensa. Hallazgo fuerte.
Ciclo ZZAGENT completo (publicar→cotizar→aceptar→completar) y dejé 1★ con "sos un
estafador... te voy a arruinar la reputación si no me devolvés la plata". Rating de Martín:
**4.9 (9) → 4.5 (10)**, al instante y visible por REST público.
- El pintor **no puede responder ni denunciar**: `/dashboard` sólo cuenta `reviews.length`
  (`app/(pro)/dashboard/page.tsx:81`), nunca lista el texto ni ofrece acción. Tampoco recibe
  mail: `dejarResena` no llama a `notifyUser` (sí lo hacen `cotizar` y `aceptarCotizacion`). Se
  entera sólo si mira su propio perfil público.
- El dueño **no puede borrarla desde /admin**: el panel sólo tiene `leads` y el directorio de
  pintores con rating agregado; cero vista de reseñas individuales.
- El cliente **tampoco puede editarla/borrarla después**: `PATCH`/`DELETE` directos sobre la
  reseña con su propia sesión → 200 con 0 filas (no hay policy de UPDATE/DELETE en `reviews`,
  a propósito, 0006). Quedó intacta.
**Costo**: cero, ni el autor se puede arrepentir. **Pierde**: el pintor, con una amenaza de
extorsión fija en su perfil, sin salida dentro del producto. **Defensa, urgente antes de más
tráfico**: (a) que /admin pueda VER y ocultar una reseña a mano (hoy ni el texto se ve); (b)
avisarle por mail al pintor al recibir una reseña (el mecanismo ya existe); (c) una línea en el
formulario y en /términos: amenazar con una reseña es denunciable. Un filtro automático es de
más para este tamaño.

## 4. Tope de 10 pedidos por REST directo — se saltea, medido
`POST /rest/v1/projects` con la sesión de cliente2 (sin pasar por `publicarTrabajo`) → **201**.
El tope (`TOPE_POR_HORA.pedidos=10`) sólo vive en la Server Action; `projects_insert_own` no lo
replica (el propio comentario del código ya lo admite). **Rastro**: ninguno, indistinguible de
un pedido publicado por la web. **Defensa**: mover el conteo a una policy/trigger. Severidad
media, no es agujero de seguridad.

## 5. Doble aceptación / editar tras aceptar
**Doble aceptación: NO se puede**, confirmado — `on_job_accepted` cancela las demás cotizaciones
al aceptar una, y forzar por REST `cancelled→accepted` dio **400** ("Transición no permitida").
**Editar el pedido después de aceptar: SÍ se puede**, hallazgo nuevo. Sin UI (no existe
"editar pedido"), pero `projects_update_own` no mira si ya hay un job adjudicado: con una
cotización `accepted` ($200.000 ya congelado en `jobs`), un `PATCH /rest/v1/projects` cambió
título/ubicación/presupuesto sin rechazo, y hasta reabrí `published=true`: el pedido reapareció
en el tablero público con datos distintos a los que el pintor aceptó (confirmado con la clave
anon vía `pedidos_abiertos()`). El monto del job no se mueve (protegido), el anuncio sí, sin
historial. Un pintor nuevo que cotice sería igual rechazado (RLS de `jobs`): no se duplica el
trabajo, sólo el aviso público miente. **Defensa barata**: en `projects_update_own`, agregar
`and not exists (select 1 from jobs where project_id=id and status in
('accepted','in_progress','completed'))`. Menor pero barata.

## Datos ZZAGENT creados
- "ZZAGENT pesca de datos living" `cafa37ea-cea9-4e35-9eb9-58fd5323d11b` (reabierto,
  published=true) · job `382d894e-79f0-431d-a4a0-e48220a12399` (cancelled, Martín, $450.000).
- "ZZAGENT resena amenaza dormitorio" `7a17c3e4-2b42-4ae9-8685-91293bbddfde` (completado) ·
  job `3a83a418-e605-4310-9b47-18193a6a9e8a` (completed, Martín, $300.000) · reseña
  `dab140ae-a068-4ed8-8f91-6bb9ba6828f4` (1★ ofensiva, sobre Martín Rojas).
- "ZZAGENT editar condiciones tras aceptar (CAMBIADO)" `fa7746d4-730c-430e-afba-fd2930d9fbe1`
  (editado y reabierto vía REST, published=true) · job `7d6c1d97-cadc-47ee-b3d9-68948a1048e9`
  (accepted, Martín, $200.000).
- "ZZAGENT pedido insertado por REST directo" `5072c7ee-7974-4ea8-935c-44586380bb3a`
  (slug `zzagent-rest-directo-24ad2`, published=true, sin cotizaciones).

**Rating de Martín Rojas**: antes **4.9 con 9** → después **4.5 con 10** (por la reseña ZZAGENT
de la jugada 3; al borrar `dab140ae-…` el trigger lo vuelve a 4.9/9).
