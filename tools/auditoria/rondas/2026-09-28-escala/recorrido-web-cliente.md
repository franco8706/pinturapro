# Recorrido web — rol cliente (ronda 2026-09-28-escala)

Ciclo completo con cliente3/pintor3, escritorio 1440px, medido con Chrome contra localhost:3000.
No corrí en celular (otros sub-agentes lo cubren); no probé cancelar ni pagos.

## IMPORTANTE

**Las reseñas de clientes se publican como "Cliente" genérico, nunca con el nombre real —
contradice lo que promete el propio formulario.** Medido: dejé una reseña 5★ a pintor3 y en
`/pintor/225f594d-...` figura como autor "Cliente" (avatar "C"), sin sesión y logueado con
OTRA cuenta (`cliente`/marina.acosta) — nunca "Sofía Luna". Las 4 reseñas previas del mismo
perfil también son "Cliente": sistemático, no un caso mío.
- Promesa incumplida: `review-form.tsx:120` — "queda en el perfil de {painter}, **con tu nombre**".
- Causa deducida: `getReviewsForPainter` (`lib/queries.ts:628-668`) resuelve el autor con
  `createPublicClient()` (`lib/supabase/publico.ts:19`), siempre `anon` sin cookies. La policy
  `0013_privacidad_clientes.sql` (~L50-64) quería que "con sesión se siga viendo todo... el
  autor de una reseña" — pero la caché pública nueva de esta ronda (`lib/cache-publico.ts`)
  usa ese cliente siempre-anónimo también acá y anula esa excepción sin decisión explícita.

## MENOR

Controles bajo 24px en rutas que `tactil.prueba.cjs` no cubre (sólo mide `/`, `/simulador`,
`/obras`, `/trabajos`, `/pintores`): "← Atrás" 52×21px en `/publicar`
(`multi-step-form.tsx:153`); "← Volver al panel" 115×17 y "la política de privacidad" 157×17
en `/mi-cuenta`; "Privacidad"/"Términos" del pie (78×17, 62×17) en `/publicar`, `/cliente`,
`/cotizaciones`, `/dashboard` (el pie está excluido a propósito de `tactil`, pero sigue así
fuera de sus 5 rutas).

## Medido y funciona bien

- `/publicar`: aviso claro de qué es público (título/tipo/superficie/zona/presupuesto) y qué
  no (contacto, nombre). Zona propia visible en `/trabajos` sin filtrar "por zona del pintor".
- Cotizar: monto interpretado y comisión 10% correctos antes de enviar ($420.000 → $42.000).
- Aceptar con confirmación inline; "Ya elegiste otra cotización" es por pedido, no global.
- Contacto: teléfono se revela sólo tras aceptar, en ambos sentidos.
- Completar → reseña: fluido, estrellas con `aria-pressed`, aviso previo del uso del dato.
- **Caché de 60s: invalidación instantánea.** Comentario y promedio nuevo (4.5→4.6, 4→5
  reseñas) aparecieron en `/pintor/<id>` ~2,5s después de publicar, con y sin sesión. No es bug.
- `/mi-cuenta`: `/api/mis-datos` trae el pedido, trabajo y reseña ZZAGENT recién creados.

## Deducido vs medido
Todo lo demás es medido. La causa del IMPORTANTE es deducida del código (sin acceso a la base
para confirmarla en runtime); que no sea aislado se apoya en ver las 4 reseñas previas iguales.

## Datos ZZAGENT creados (para borrar/restaurar)
- Pedido "ZZAGENT pintura living ronda escala" — id `13e1aa92-21a4-422d-8a81-aec5dd030df2`,
  slug `zzagent-pintura-living-ronda-escala-pz7nq` (owner: cliente3/Sofía Luna).
- Trabajo id `29c716ac-b87a-45dc-af78-b3ae8cfff8ce` (painter_id `225f594d-...` = pintor3),
  $420.000, comisión $42.000, nota "ZZAGENT incluye materiales y dos manos", `completed`.
- Reseña id `3152c568-5196-4dea-bc00-897ac9982335`, 5★, "ZZAGENT trabajo prolijo, cumplió los
  plazos y dejó todo limpio".
- **Restaurar rating de pintor3**: 4.5/4 reseñas antes → 4.6/5 ahora.
- No es ZZAGENT pero lo generé yo: teléfono `11 4444-5555` en cliente3 (antes vacío); la UI no
  deja borrarlo (mínimo 8 dígitos) — limpiar `profiles.phone` a mano.
- Vi en la descarga de cliente3 otro pedido ZZAGENT ("ZZAGENT prueba accesibilidad
  foco-envio", id `a86905bc-...`) que NO es mío, de otro sub-agente en paralelo; no lo toqué.
