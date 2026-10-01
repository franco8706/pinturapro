# Recorrido web — sub-agente pintor — ronda 2026-09-28-escala

Cuenta: `pintor` (martin.rojas@pinturapro.demo). Leí REGLAS.md, BITACORA.md y las sondas viejas
en `/workspaces/codespaces-blank/.auditoria/kit/pintor/`. Escritorio (1440px); no repetí en
celular por presupuesto, salvo lo ya cubierto por rondas previas.

## BLOQUEANTE
Ninguno medido en este recorrido.

## IMPORTANTE

**1. Una cotización mía terminó en un pedido demo que no es ZZAGENT (medido, sin causa raíz confirmada).**
Al cotizar "ZZAGENT prueba accesibilidad foco-envio" (probé el envío en tres corridas de script
separadas, porque la primera quedó colgada en "Enviando…"), terminé con el pedido correcto
cotizado ($550.000) **y además** apareció una cotización por el mismo monto exacto ($550.000)
en "Pintura completa de PH en Barracas" (cliente Carolina Ruiz, dueña real de ese pedido demo,
NO es ZZAGENT) — que en la primera lectura de /trabajos, antes de tocar nada, mostraba
"Cotizar este trabajo" (sin cotizar). El código de `page.tsx` pasa `projectId={r.id}` con
`key={r.id}` por tarjeta, sin bug visible de key compartida; no pude confirmar si fue una
página de /trabajos servida con datos viejos (el "ya cotizado" no se reflejó de inmediato en
dos de mis tres intentos) o algo del lado del formulario. Intenté deshacerlo con "Retirar
cotización" desde `/dashboard` y la acción fue bloqueada por el sistema de permisos del
entorno ("External System Writes"); no insistí por otra vía. **Queda pendiente: alguien con
permisos debe entrar como `pintor` a `/dashboard` y retirar la cotización de "Pintura completa
de PH en Barracas" ($550.000).** Severidad importante porque toca plata y la atribución
pedido↔pintor, aunque no bloqueó nada.

**2. El pintor nunca vuelve a ver su comisión después de cotizar (confirmado con navegador,
coincide con lo que reportó `dinero-y-comisiones`).** En `/dashboard`, tras cotizar, la fila del
pedido muestra `COTIZADO / $ 550.000 / Retirar cotización` — sin ninguna mención de comisión.
Repasé las 9 filas COMPLETADO y las 2 ACEPTADO del panel: ninguna dice cuánto se le va a
descontar. Busqué la palabra "comisi" en todo el texto de `/dashboard` y no aparece ni una vez.
El único momento en que el pintor ve el 10% es el aviso efímero DENTRO del formulario, antes de
enviar. Le faltaría, como mínimo, la comisión de CADA trabajo junto al monto en el panel (ya se
calcula y se guarda; sólo falta mostrarla), sobre todo en los trabajos "Completado", que es
cuando la deuda se vuelve real.

## MENOR

- **La bio no se muestra en `/pintores`** (el listado sólo trae nombre, rating, zona, reseñas y
  especialidades — no bio), así que "verificar que el ZZAGENT de la bio aparezca en /pintores"
  no aplicaba: es imposible por diseño, no por caché rota. Sí probé la propagación con el campo
  `location` (que SÍ se renderiza ahí): editar y guardar el perfil actualizó `/pintor/<id>` en
  ~2,3 s y `/pintores` en ~3,8 s — **sin rastro del caché de 60 s** que se avisó para esta
  ronda; funciona bien.
- El primer intento de "Enviar cotización" quedó pisado en "Enviando…" sin confirmar ni fallar
  visiblemente dentro de ~2 s de espera manual; pudo ser compilación de dev-mode (REGLAS §5), no
  lo puedo asegurar como bug real.

## Funciona bien

- Editar perfil (bio, zona): guarda, avisa, y persiste. Restauré ambos campos a los valores
  originales exactos, verificado con lectura posterior del formulario.
- Crear obra de portfolio con foto real: aparece al instante en `/obras` y en el perfil público
  (segundos, no minutos), sin errores de consola ni requests fallidos.
- Borrar una obra pide doble confirmación en el propio botón ("Borrar" → "¿Confirmar?"), sin
  diálogo nativo bloqueante; tras confirmar, `/obras/<slug>` da 404 y desaparece de los listados
  al instante.
- El formulario de cotizar muestra en vivo "Vas a cotizar $550.000. La comisión del 10% son
  $55.000." (visible y también en una región `aria-live` para lectores de pantalla, con espera
  de 700 ms para no leer cada tecla) — claro y correcto.

## Medido vs. deducido

Todo lo de arriba es **medido** con el navegador del kit. No deduje nada del código salvo para
confirmar que `page.tsx` pasa `key`/`projectId` correctos por tarjeta (lectura de
`apps/web/app/(marketplace)/trabajos/page.tsx:76,115` y `quote-form.tsx`), que no explica la
anomalía del punto 1.

## Datos ZZAGENT creados

- Bio y `location` de `pintor` (martín.rojas): modificados temporalmente y **restaurados** a
  los valores originales exactos (`bio`: "Especialista en residencial, esmaltes y texturas.
  Acabados premium."; `location`: "Palermo, CABA").
- Obra de portfolio **"ZZAGENT Reforma cocina Núñez"** (slug `zzagent-reforma-cocina-nunez-duf9e`)
  — creada con foto real y **borrada** (confirmado 404 y ausente de listados).
- Cotización sobre el pedido **"ZZAGENT prueba accesibilidad foco-envio"** (cliente Sofía Luna):
  monto $550.000, nota "ZZAGENT cotización de prueba de auditoría del sub-agente pintor. Incluye
  materiales y mano de obra." — **queda activa** (status COTIZADO) para que el orquestador la
  vea al borrar el pedido ZZAGENT; el job quedará huérfano (`project_id` a null) pero se
  identifica por el prefijo ZZAGENT en la nota.
- **Cotización NO intencional y sin marca ZZAGENT** sobre "Pintura completa de PH en Barracas"
  (cliente Carolina Ruiz), $550.000 — **no pude retirarla** (bloqueo de permisos del entorno).
  Requiere limpieza manual: entrar como `pintor` a `/dashboard` y click en "Retirar cotización"
  en esa fila.
