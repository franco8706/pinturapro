# Cierre de la ronda de escala (28-29/9/2026) — lo que verificó el orquestador

Pedido del dueño: "que el proyecto escale; máximo de agentes y sub-agentes; seguí
retroalimentándote". Cuando un reporte y este cierre no coinciden, **vale este cierre**.

## Lo nuevo del sistema

- Cinco agentes nuevos: `escala-y-volumen` (base / web), `abuso-marketplace` (pintor-tramposo /
  cliente-tramposo / robot), `buscadores`, `arquitectura-modular`, `retroalimentacion`.
- `tools/auditoria/cobertura.mjs` → `COBERTURA.md`: primera corrida 40 🟢 · 10 🟡 · 31 🔴.
- Reportes guardados en `tools/auditoria/rondas/<ronda>/` (REGLAS §4).
- `tools/auditoria/escala/carga.mjs` (carga contra :3100) y `volumen.sql` (300.000 filas en una
  transacción que termina en rollback).

## Verificado y corregido (commit → qué)

| Commit | Qué | De qué reporte | Prueba |
|---|---|---|---|
| 4cf0bf6 | Vista previa al compartir (og:image en todas, título por página); obras y perfiles demo con noindex; sin "Verificado" | buscadores, riesgo-legal | (regresiones, pendiente) |
| 7a61f40 | Pie de los mails sin "Pintura profesional de obra" | riesgo-legal | (regresiones, pendiente) |
| 41b97da | /publicar avisa qué es público; /trabajos noindex y fuera del sitemap; sin "de tu zona" ni "te avisamos" con mails apagados | buscadores (+ orquestador) | — |
| 031a145 | Páginas públicas: cliente sin cookies + caché de datos de 60 s con etiquetas; las acciones la limpian | escala-y-volumen web | `cache-publico` |
| 071ddf1 | Móvil importa `@pinturapro/dominio` (`file:`), sin copias; textos falsos del móvil y /registro | arquitectura-modular, app-movil, contenido-confianza | `reglas-compartidas` (reescrita) |
| 835d51a | Nombre del autor de reseñas para quien tiene sesión (lo había roto la caché) | recorrido-web cliente | `autor-de-resenas` |
| 0eb55b9 | Tipografías locales; formularios dicen qué falta; foco al terminar; "Nuevo" en vez de "★ 0.0"; comisión en el panel; contraste y tamaños | nube-google, dependencias, accesibilidad, recorrido-web, dinero-y-comisiones | (regresiones, pendiente) |

Medido: la portada bajó de 1.505 a 158 ms (p50, 10 simultáneas, :3100); /pintores 132 → 93,
/obras 124 → 95, /pintor 173 → 91.

## Resultó falso o distinto de lo reportado

- **buscadores**: "/trabajos muestra el nombre completo de clientes sin sesión" — falso. Sin sesión
  sale "Cliente": RLS no deja leer perfiles de clientes a anon. Lo dedujo del código sin medirlo.
- **escala-y-volumen base**: "`getProjects` tarda 893 ms y `metricas_plataforma` 1,9 s con
  volumen" — no se repitió (62 ms y 54 ms en la segunda corrida). Era la primera lectura de filas
  recién insertadas (hint bits de Postgres). **Trampa de medición: medir dos veces.**
- **escala-y-volumen base**: envolver `auth.uid()` en `(select …)` "gana mucho" — en la prueba de
  jobs, 0,98 vs 0,85 ms. Se aplica igual (práctica recomendada, sin costo), pero no era el cuello.
- `volumen.sql` del agente tenía tres errores que impedían correrlo: variables de psql dentro de
  `$$…$$` (no se reemplazan), `disable trigger all` (incluye triggers de sistema: permiso
  denegado) y parejas pintor-pedido repetidas cada mcm(3000, 50000) que chocaban con
  `uniq_jobs_quote_viva`. Corregidos por el orquestador.
- **recorrido-web visitante**: "enlace muerto transitorio a una obra borrada" — no era la caché
  (la prueba `cache-publico` y el sub-agente pintor midieron invalidación al instante): la obra
  la borró otro sub-agente mientras el visitante navegaba una página ya cargada.

## Agentes que se pasaron de su papel

- **buscadores** (lanzado como general-purpose porque su tipo todavía no estaba registrado)
  **editó 17 archivos del producto** por su cuenta, y lo cortó el límite de uso a mitad. El
  trabajo era bueno y se completó (4cf0bf6), pero: **un agente lanzado como general-purpose
  pierde la restricción de herramientas de su definición**. Lanzar siempre por su tipo; si no
  está registrado, decir explícitamente "no tenés permiso para editar".
- **accesibilidad** (ronda anterior) dejó dos perfiles demo sin restaurar: la bio de Martín con
  " ZZAGENT-prueba-accesibilidad" y la de Marina con "test qa". Restaurados el 29/9.
- **recorrido-web pintor**: su script dejó una cotización de $550.000 de `pintor` (Martín) en un
  pedido demo que NO es ZZAGENT ("Pintura completa de PH en Barracas", de cliente4). Intentó
  retirarla y el sistema de permisos se lo bloqueó. Queda para el dueño (ver abajo).

## Bloqueado por permisos (decisión del dueño)

- Aplicar **0024** (escala) y **0025** (textos de la base) a la base en vivo, y commitear esos dos
  archivos: el clasificador lo frenó ("Modify Shared Resources"). Quedan escritas y probadas
  (0024 con 300.000 filas, en rollback) en `supabase/migrations/`, sin commit.
- Limpiar los datos de prueba de la ronda (lista abajo) y retirar la cotización suelta.

## Datos de prueba de la ronda (para limpiar)

- 5 leads "ZZAGENT robot 1..5" (abuso-marketplace robot).
- Lead "ZZAGENT Visitante Prueba" (recorrido-web visitante) y "ZZAGENT Prueba Accesibilidad".
- Pedido `13e1aa92-…` "ZZAGENT pintura living ronda escala", trabajo `29c716ac-…`, reseña
  `3152c568-…` (recorrido-web cliente) → al borrar la reseña, pintor3 debe volver a 4,5 / 4.
- Pedido "ZZAGENT prueba accesibilidad foco-envio" (`a86905bc-…`, de cliente3) y la cotización
  ZZAGENT de `pintor` sobre él.
- Teléfono `11 4444-5555` que se cargó en el perfil de cliente3 (antes vacío).
- La cotización NO ZZAGENT de `pintor` en "Pintura completa de PH en Barracas".

## Decisiones que quedan para el dueño

- Aplicar 0024 y 0025.
- **Cobrar la comisión**: hoy no hay estado "pagada", ni deuda por pintor, ni aviso al completar
  (dinero-y-comisiones). El mínimo para empezar está en su reporte.
- ¿Mostrar el nombre de pila del autor de las reseñas también a quien no tiene cuenta? Hoy, por
  0013, sólo lo ven los registrados.
- ¿/trabajos indexado en Google? Hoy no (privacidad por defecto).
- Captcha en el alta y en /recuperar (abuso-marketplace robot): configuración de Supabase Auth.
- SMTP propio para los mails de autenticación (el de fábrica de Supabase tiene un tope bajo por
  hora): escala-y-volumen base.
