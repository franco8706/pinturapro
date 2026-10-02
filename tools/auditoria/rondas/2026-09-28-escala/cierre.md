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

Después del cierre parcial (1/10): 706f841 tipografías acotadas (111 → 79,6 KB) y fecha real en
los textos legales · 5ab3814 prueba `formularios-de-pasos` · 91e4ee5 "ya cotizaste" acotado a los
pedidos en pantalla · 9ec75e4 `/api/sesion` fuera del middleware (3 → 2 llamadas a Auth por
visita con sesión) · e6845e0 el vigilante mira /og.png, og:image y el noindex de /trabajos.
Suite completa: **27/27 en verde** (corrida por el orquestador el 1/10).

### Segunda parte (2/10): navegación, formularios hostiles, los dos tramposos y el simulador

| Commit | Qué | De qué reporte | Prueba |
|---|---|---|---|
| 7ea6acf | `lib/queries.ts` (1.577 líneas) partido en siete módulos por tema; nadie que lo importa cambió | arquitectura-modular | suite completa |
| 740ffda | Superficie y años validados en el servidor (se publicó "Infinity m²"); tope de 10 pedidos y 30 cotizaciones por hora; /ingresar no le pide la contraseña a quien ya entró; la barra se entera de otra pestaña; aviso al recargar la confirmación | formularios-hostiles, recorrido-web navegación | `tope-por-hora`, `formularios-de-pasos`, `dominio/pruebas.ts` |
| d780bef | Reseñas con salida: el pintor las lee y las denuncia, el dueño las da de baja desde /admin; piso de $1.000 en la cotización; sin teléfono ni mail en la nota | abuso-marketplace (los dos tramposos) | `moderacion-resenas`, `dominio/pruebas.ts` |
| d170d05 | La varita corre en un Web Worker: tarea larga del primer clic 577-623 → 319-339 ms | simulador-color, rendimiento | `tools/auditoria/simulador/congelamiento.cjs` (fuera de la suite) + las tres pruebas de calidad |
| 0d928d4 | Simulador: Deshacer, e Intensidad junto al color elegido (de 7-14 Shift+Tab a 2 Tab) | accesibilidad, simulador-color | `simulador-deshacer` |

Escrita y probada en rollback, **sin aplicar**: migración **0026** (los topes por hora, el piso de
la cotización y "un pedido adjudicado no se edita", en la base). Se suma a 0024 y 0025.

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

- **rendimiento**: "el Cache-Control sigue en private porque el layout sigue leyendo cookies" —
  no: las páginas son `force-dynamic` a propósito (para no pedir la base al compilar) y lo que se
  guarda en caché son los datos. Su medición sí es correcta y coincide con la del orquestador:
  la portada 1.505 → 166 ms (p50, 10 simultáneas); JS de la portada 138,1 KB, sin regresión.
- **rendimiento** encontró una trampa propia: bajo la emulación de celular, `img.naturalWidth`
  de una imagen `fill` + `object-cover` devuelve el ancho PINTADO (390), no el del archivo
  (1200). Para medir "imagen de más" hay que mirar el archivo real o el `w=` de `/_next/image`.

## Números de la ronda (producción :3100, celular, 4G flojo, CPU ×4)

| | Ronda anterior | Esta ronda |
|---|---|---|
| Portada, p50 con 10 visitas simultáneas | 1.505 ms | 158-166 ms |
| /pintores · /obras · /pintor (ídem) | 132 · 124 · 173 ms | 93-96 · 90-95 · 85-91 ms |
| JS de la portada | 138 KB | 138,1 KB |
| Tipografías por página | ~100 KB (de Google) | 109,5 KB (locales) → 79,5 KB tras acotar pesos |
| FCP / LCP de la portada | — | 912 / 912 ms |
| LCP de /obras | — | 2.272 ms (la foto de portada compite con fuentes y JS) |
| Primer clic de la varita | 400-724 ms | 571-599 ms (sin cambios: nadie tocó el simulador) |
| Pruebas de regresión | 24 | 26 + las que deje `regresiones` |
| Cobertura (🟢 · 🟡 · 🔴) | — | 40 · 10 · 31 al empezar |

- **sesiones-y-acceso**: propuso limitar el middleware a las rutas privadas para ahorrar las
  llamadas a Auth en las páginas públicas. Se aplicó sólo a `/api/sesion` y rutas técnicas: en
  las públicas, la portada y el perfil leen la sesión (autor de las reseñas) y sin el middleware
  un Server Component renovaría el permiso sin poder guardar la cookie — Supabase puede cerrar
  todas las sesiones al verlo reusado. Y el costo que midió (3 llamadas por visita) es sólo de
  quien TIENE sesión: un visitante anónimo no genera ninguna. Confirmó, eso sí, que ninguna
  lectura cacheada usa el cliente con cookies y que `getSession()` no decide nada de seguridad.

- **simulador-color**: "la moldura manchada casi se duplicó (2,5 % → 4,5 %) sin que cambiara el
  código". Medido igual por el orquestador antes y después del Web Worker: 4,5 %, idéntico
  bit a bit: el Web Worker no lo movió. **La causa del salto respecto del 2,5 % de referencia no
  está confirmada** (la hipótesis es la versión de Chrome del Codespace; nadie lo midió con la
  versión anterior). Referencia para comparar desde ahora: 4,5 %, con el filo en 0.
- **simulador-color** propuso tres atajos para el primer clic (pasada rápida y después la
  completa, reutilizar buffers, media resolución). Se eligió el Web Worker, que no cambia el
  resultado: los tres atajos tocaban la calidad o dejaban el cálculo en el hilo de la pantalla.
- **abuso-marketplace (pintor-tramposo)**: "una regex simple en `cotizar` y `updateProfile`".
  Se aplicó en la nota de la cotización (que se lee ANTES de aceptar). En la bio NO: un perfil
  público con el teléfono del pintor es una decisión de producto, no un abuso; queda para el dueño.
- **recorrido-web (pintor)** dejó una cotización suya en un pedido demo ajeno; el motivo se vio
  después: su script llenó el primer formulario de la página en vez del que quería.

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

## Lo que cambió en el sistema durante la ronda

- **Los agentes en segundo plano mueren cuando se cierra la sesión.** Pasó tres veces. Desde el
  2/10 se lanzan en primer plano, de a tres, y el orquestador espera.
- **La suite se corre en un proceso suelto** que escribe en `/workspaces/codespaces-blank/.auditoria/verificar.log`
  (fuera de /tmp, que se borra): si la sesión se corta, la corrida termina igual.
- **Commit antes de verificar** cuando el cambio ya compila: un corte no deja trabajo sin guardar.
- El orquestador hace solo lo que no necesita otra mirada (correr la suite, bitácora, reglas,
  limpiar datos): cada agente lanzado es cupo que puede cortar la ronda.

## Decisiones que quedan para el dueño

- Aplicar 0024 y 0025.
- **Cobrar la comisión**: hoy no hay estado "pagada", ni deuda por pintor, ni aviso al completar
  (dinero-y-comisiones). El mínimo para empezar está en su reporte.
- ¿Un pintor puede poner su teléfono en la bio de su perfil público? Hoy sí; en la nota de una
  cotización, no.
- ¿Mostrar el nombre de pila del autor de las reseñas también a quien no tiene cuenta? Hoy, por
  0013, sólo lo ven los registrados.
- ¿/trabajos indexado en Google? Hoy no (privacidad por defecto).
- Captcha en el alta y en /recuperar (abuso-marketplace robot): configuración de Supabase Auth.
- SMTP propio para los mails de autenticación (el de fábrica de Supabase tiene un tope bajo por
  hora): escala-y-volumen base.
