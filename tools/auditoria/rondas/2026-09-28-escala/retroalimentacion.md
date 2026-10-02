# Retroalimentación — cierre de la ronda `2026-09-28-escala`

Leí `cierre.md` entero primero (manda sobre los reportes) y después los 25 reportes de la ronda.
Actualicé "Lo que aprendieron las rondas anteriores" en 20 archivos de `.claude/agents/` (18 con
reporte propio o compartido + `listo-para-publicar` y `regresiones`, que no corrieron completos
esta ronda). No toqué `BITACORA.md`, código del producto ni las pruebas. No corrí `pnpm
verificar` ni levanté servidores.

## Qué cambié en cada agente (una línea c/u)

- **escala-y-volumen**: la caché pública que propuso (papel web) se aplicó y midió (9× más
  rápida); agregué la trampa de medir volumen sintético dos veces (hint bits) y los tres errores
  de `volumen.sql` que el orquestador tuvo que corregir.
- **abuso-marketplace**: el tope por hora y la regex de contacto se aplicaron parcialmente
  (sólo la nota de cotización, no la bio); anoté que `pedidos_abiertos()` sigue sin tope propio y
  que la migración 0026 está escrita pero NO aplicada — hay que confirmarlo la próxima ronda.
- **buscadores**: corregí su propio hallazgo falso ("nombre completo de clientes sin sesión", no
  medido) y anoté que lo lanzaron como `general-purpose` y editó 17 archivos por su cuenta.
- **arquitectura-modular**: su corte de `queries.ts` se aplicó tal cual; su plan de `workspace:*`
  para el móvil resultó romper `npm install` (lo midió `app-movil`) — hay que usar `file:...`.
- **seguridad-rls**: confirmó las 16 funciones sin prueba (8 trigger, 8 RPC con grant correcto) y
  un hallazgo menor (`es_service_role()` sin revoke) — nombrarlas explícitamente subió la
  cobertura de 13 funciones 🔴 a 3.
- **integridad-datos**: Storage, no la base, es el cuello de escala real; anoté que dos perfiles
  demo de la ronda anterior seguían sucios al re-escanear dos veces.
- **riesgo-legal**: el hallazgo más grave de la ronda (badge "Verificado" en producción) y el pie
  de los mails con texto viejo de "empresa de pintura".
- **contenido-confianza**: "pintores verificados" volvió en la app móvil y en una `news` vieja de
  la base — la lección es mirar también la base de contenido, no sólo las páginas.
- **dinero-y-comisiones**: no hay forma de cobrar la comisión hoy (sin estado "pagado", sin vista
  por pintor); confirmó que `getNumerosReales` es la única consulta sin `.limit()`.
- **dependencias**: la causa real del build fallido fue `next/font/google` (no una generalidad de
  red); `next/og` vendorizado es un punto ciego de `pnpm audit`.
- **app-movil**: midió con una instalación real que `workspace:*` rompe y que Metro ya detecta el
  monorepo solo — el plan de `arquitectura-modular` se corrigió con su evidencia.
- **nube-google**: Google Fonts es el único punto de falla del build; AVIF cuesta 10-18× más CPU
  que WebP; costo de Cloud Run con/sin caché cuantificado.
- **recorrido-web**: el autor de una reseña se muestra siempre como "Cliente" pese a la promesa
  del formulario (regresión de la caché nueva); UX de pestañas y reload sin avisar.
- **accesibilidad**: foco perdido al terminar /publicar y /registro; el fix de contraste de
  painter-card no llegó al perfil individual (mismo patrón, archivo distinto).
- **formularios-hostiles**: "Superficie" acepta `Infinity`; ni publicar ni cotizar tenían tope de
  cantidad (se agregó esta ronda).
- **rendimiento**: trampa de medir con navegador nuevo por página (caché de fuentes); la caché de
  60s ya se cobró su ganancia (9×).
- **simulador-color**: perfiló el primer clic función por función (75% en cerrar huecos + flood
  fill); explicó la falsa "regresión" de la moldura (versión de Chrome, no código); confirmó el
  resultado del Web Worker.
- **sesiones-y-acceso**: cuantificó el costo en Auth de una visita con sesión y por qué no se
  puede sacar el middleware de las páginas públicas sin riesgo.
- **listo-para-publicar**: anoté que no corrió (cortado dos veces por el límite de uso), sin
  inventar hallazgos.
- **regresiones**: anoté que esta ronda la corrió el orquestador directamente, no el agente.
- Corregí además una ruta vieja en las instrucciones de **simulador-color** (`apps/web/lib/
  magic-wand.ts`/`oklab.ts` ya no existen: es `packages/color/src/`).

## Trampas nuevas en REGLAS.md

Agregué sólo lo que faltaba (verifiqué la sección antes de tocarla):
1. Un porcentaje medido en píxeles puede moverse entre versiones de Chrome sin cambio de código
   (la moldura 2,5%→4,5% del simulador).
2. Un enlace que desaparece a mitad de tu navegación puede ser otro agente borrando su propio
   dato ZZAGENT en paralelo, no un bug de caché (3bis).
3. Tres lecciones de proceso del orquestador: los agentes en segundo plano mueren si se cierra la
   sesión, la suite conviene correrla con el log fuera de `/tmp`, y conviene commitear apenas un
   cambio compile, antes de verificar.

## Cobertura

Al empezar la ronda: **40 🟢 · 10 🟡 · 31 🔴**. Antes de esta actualización (con las pruebas y
agentes nuevos que ya había agregado la ronda, sin tocar "lo que aprendieron"): **42 🟢 · 15 🟡 ·
28 🔴**. Después de nombrar explícitamente lo que cada agente ya había medido en sus reportes:
**42 🟢 · 30 🟡 · 13 🔴** (`node tools/auditoria/cobertura.mjs`).

Lo que sigue en 🔴, genuino (no forzado):
- **9 de las 15 acciones de servidor no las nombra ninguna prueba ni agente**: `dejarResena`,
  `marcarCompletado`, `cancelarTrabajo`, `createObra`, `updateObra`, `borrarResena`,
  `guardarTelefono`, `postularmeComoPintor`, `enviarConsulta`. Entre ellas está todo el final del
  ciclo de vida de un trabajo (completar, reseñar, cancelar) — hoy sólo `cotizar` tiene una
  prueba de regresión propia.
- **3 funciones de las migraciones 0024-0026** (`resumen_publico`, `limites_de_cotizacion`,
  `tope_de_pedidos`): están escritas y probadas en rollback pero nadie las revisó con el
  criterio de `seguridad-rls` (revoke/grant, security definer) porque todavía no están aplicadas.
- `/cuenta-eliminada` (pantalla de confirmación tras borrar la cuenta): nadie la abre nunca.

## Qué propondría para la próxima ronda (cada uno con su hueco medido)

1. **Una prueba de regresión del ciclo de vida completo de un trabajo** (cotizar → aceptar →
   completar → reseñar → cancelar), para `regresiones`. Justificación: 9 de 15 acciones de
   servidor —incluida `marcarCompletado`, que `dinero-y-comisiones` marcó como el momento exacto
   en que la deuda de comisión se vuelve real y hoy no avisa a nadie— no tienen ninguna prueba
   que las nombre.
2. **Que `seguridad-rls` revise las migraciones 0024-0026 ANTES de que el dueño las apruebe**, no
   después. Justificación: son las únicas 3 funciones de toda la base que ningún agente de
   seguridad miró todavía (🔴 en COBERTURA), precisamente porque nacieron esta ronda.
3. **No falta un agente nuevo.** Los huecos medidos (acciones de servidor, migraciones nuevas)
   los puede cerrar el reparto de trabajo de los agentes que ya existen; no vi en ningún reporte
   un hallazgo que necesitara un papel que hoy no exista.

## Números de la ronda (comparables)

| Métrica | Ronda anterior | Esta ronda |
|---|---|---|
| JS de la portada | 202 KB | 138,1 KB (sin cambios esta ronda) |
| Portada, p50 con 10 visitas simultáneas | 1.505 ms | 158-166 ms |
| `/pintores` · `/obras` · `/pintor` (ídem) | 132 · 124 · 173 ms | 93-96 · 90-95 · 85-91 ms |
| LCP portada / `/obras` | — (no medido) | 912 ms / 2.272 ms |
| Primer clic de la varita (tarea larga) | 577-623 ms | **319-339 ms** (Web Worker) |
| Varita: recall / precisión | 83% / 98% | 82,2% / 99,3% (dentro del margen de ruido) |
| Pruebas de regresión | 24, todas en verde | **30**, todas en verde |
| Cobertura (🟢 · 🟡 · 🔴) | — | 40·10·31 (inicio) → 42·30·13 (cierre) |

## Archivos tocados

- `tools/auditoria/REGLAS.md` (3 agregados, sección ya revisada antes de tocarla).
- `.claude/agents/{escala-y-volumen,abuso-marketplace,buscadores,arquitectura-modular,
  seguridad-rls,integridad-datos,riesgo-legal,contenido-confianza,dinero-y-comisiones,
  dependencias,app-movil,nube-google,recorrido-web,accesibilidad,formularios-hostiles,
  rendimiento,simulador-color,sesiones-y-acceso,listo-para-publicar,regresiones}.md`.
- `tools/auditoria/COBERTURA.md` (regenerado).
- Este archivo.
