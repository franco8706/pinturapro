# Pintura Pro — Plataforma Web de Pintura Profesional

## Visión General

Este es un monorepo Turborepo con una aplicación Next.js 15 (App Router) para una plataforma de pintura profesional de obra.

> **Pintura Pro es un MARKETPLACE PURO** (decisión explícita del dueño, 27/9/2026): conecta a
> quien tiene algo para pintar con pintores independientes. **No pinta, no tiene equipo propio,
> no tiene taller y no da garantía sobre los trabajos.** El trabajo se contrata y se paga entre
> cliente y pintor; la plataforma cobra un 10% de comisión al pintor. El rol "empresa" del alta
> es una empresa de pintura que ofrece servicios DENTRO del marketplace, como un pintor más.
> Todo texto que diga "pintamos", "nuestro equipo", "garantía" o "taller" es de la época en que
> el sitio era la vidriera de una empresa: se reescribe. Ya pasó con la portada y /nosotros.

Las tres fases de abajo describen el orden en que se CONSTRUYÓ, no el negocio: la "Fase 1 (Empresa)" es historia.

- **Fase 1 (vidriera, histórica)**: portfolio, simulador de color, cotización online.
- **Fase 2 (Pro Partners)**: Directorio de pintores con perfiles, reseñas y mapa.
- **Fase 3 (Marketplace)**: Clientes publican trabajos, pintores cotizan, comisión.

## Estado del Proyecto (actualizar al avanzar)

- **Repo:** https://github.com/franco8706/pinturapro (privado) · rama `main`, **sincronizada**. Para pushear hace falta un PAT del usuario; los que se pegan en el chat los revoca el secret scanning de GitHub, así que suelen fallar al segundo uso (ver [[pinturapro-git-push]]).
- **Build:** `tsc --noEmit` y `next build` pasan limpio (45 rutas). **Next.js 15.5.25** (se subió desde 15.5.22 para parchar dos RCE críticos, uno en el optimizador de imágenes).
- **⚠️ ANTES DE PUBLICAR — leer `docs/despliegue-google-cloud.md`**, empezando por su sección 0 (las guías viejas de Vercel y AWS están en `docs/historico/`). Lo que no se arregla desde el código: **el 100% de los datos visibles son demo** (3 pintores inventados, 20 reseñas fabricadas, fotos de stock de Unsplash como obra propia), (el equipo ficticio de `/nosotros` se sacó el 27/9 al confirmarse el marketplace puro), y `profiles.verified` no lo escribe ninguna parte del código (sólo por SQL). Además: sacar Supabase del plan free (se pausa a los 7 días sin uso y ya pasó una vez), poner spend limit en Replicate, y montar un uptime check sobre `/api/health` — hoy no hay monitoreo de ningún tipo.
- **Auditoría (19 sept 2026, agentes con navegador propio):** se corrigieron tres cosas medidas en Chrome, no deducidas:
  · **Seguridad — cualquier cuenta podía hacerse pasar por pintor.** Una cuenta `client` entraba a /trabajos, veía "Cotizar este trabajo" en el pedido de otra clienta y la cotización se creaba. Ni la página, ni la acción `cotizar`, ni la policy `jobs_insert_painter_quote` miraban el rol (el nombre de la policy dice "painter" y por eso pasó inadvertido). Migración **0016** agrega `es_pintor()` y lo exige en la policy; las obras de portfolio también quedan para pintores (`projects_insert_own`/`update_own`/`delete_own` reemplazan a `projects_modify_own`). Verificado por RLS con `set request.jwt.claims`: cliente cotiza ✗, cliente publica pedido ✓, pintor cotiza ✓, pintor publica obra ✓.
  · **Simulador — la varita agarraba media pared.** Con luz de ventana tomaba el 54% de la pared (medido contra máscara de referencia); ahora 83%, con la precisión intacta (98%). Comparaba cada píxel contra el color del CLIC; ahora avanza vecino a vecino sobre la luma suavizada (`Ys`) con correa global. Pared oscura 77%→85%; pared plana igual pero sin fuga al techo.
  · **Simulador — una foto de 30 MP dejaba sin salida:** el rechazo ponía estado `error`, que no dibuja el selector de archivos; sólo se salía recargando. Ahora vuelve a `empty` y el aviso se ve en la pantalla de subida.
  · Además: tres clics seguidos en /contacto creaban TRES consultas (`disabled={pending}` no alcanza; va un `useRef`). Los demás formularios se probaron igual y no duplican.
  · **Un solo texto largo rompía páginas públicas para todos:** un pedido con título de 10.000 caracteres dejaba /trabajos en 254.443 px de ancho. Tres capas: checks de largo en la base (migración **0017**), topes en las acciones con mensaje traducido (23514 en `errores-db.ts`), y `overflow-wrap: anywhere` en `globals.css`.
  · **Simulador, motor de color en OKLab:** la textura que sobrevivía al pintar dependía del color (0,48 con Marfil, 0,79 con Negro Mate; debería ser 0,6 siempre). Ahora 0,63 con todos (dispersión 0,009). Y el difuminado del borde pasó a ser sólo hacia adentro: la pintura se pasaba 2 px sobre molduras (16,8% de la moldura manchada → 2,5%).
  · **Cerrojo sincrónico contra el doble envío** en contacto, perfil, nueva obra, cotizar y reseña (`useRef`; `disabled={loading}` no alcanza).
- **Auditoría (25-26 sept 2026, ronda profunda):** medido y corregido, cada cosa con su prueba:
  · **El simulador no se podía usar sin mouse.** El lienzo es un canvas: no se enfocaba, no tenía nombre y no escuchaba ninguna tecla. Ahora Tab entra, las flechas mueven una mira visible (Shift = paso fino), Enter hace lo mismo que un clic (es el mismo código: `aplicarEn`/`pintarEn` en coordenadas 0..1) y lo que pasa se anuncia en una zona `aria-live`. Prueba `simulador-teclado`.
  · **Las Server Actions se rompían con un cuerpo que no esperaban.** `[null]` a la acción de dar de baja devolvía 500 (`Cannot read properties of null`); el mismo cuerpo rompía las tres acciones de `/contacto`. Se escriben como funciones y son endpoints: llega lo que el que llama quiera. Guardas `esTexto`/`textoRecibido`/`esFormulario` en las 15 acciones. Prueba `acciones-hostiles`, que se queda con el id de cada acción que se dispara y le tira 7 cuerpos imposibles.
  · **La foto reemplazada quedaba pública para siempre**: cambiar la portada de una obra subía la nueva y dejaba la anterior viva en el Storage. Idem foto de perfil. **Ojo al medirlo:** la caché de Supabase devuelve 200 sobre una foto YA BORRADA hasta una hora; hay que preguntar con un parámetro al final. Prueba `foto-reemplazada`.
  · **El archivo de "mis datos" no traía las fotos**, que es lo más personal que guarda el sitio y lo único que vive fuera de la base.
  · **"Publicar trabajo" quedaba cortado en el celular** (fila de 495 px en pantalla de 390, sin scroll ni forma de alcanzarlo). Lo peor: `auditar()` no lo veía porque comparaba contra `window.innerWidth`, que **crece con el contenido desbordado**. Prueba `desborde-celular`.
  · Migraciones **0018** (aritmética de la comisión restaurada, `recalc_profile_rating` revocada), **0019** (`jobs.client_id` y `reviews.author_id` a `set null`: darse de baja ya no borra el registro del otro) y **0020** (coordenadas del pintor redondeadas a ~1,1 km, como promete /privacidad, y `projects` con grant por columna).
- **Ronda completa (27-28 sept 2026, los 16 agentes + 4 sub-agentes):** marketplace puro aplicado a todo el sitio (/nosotros, portada, título, pie; `/cotizar` → 308 a `/publicar`); migraciones **0021-0023** aplicadas (índices, `leads` sin inserción directa, `es_admin()`); `sharp` 0.35.4 (RCE); contraseña con sesión abierta pide la actual; imágenes desmedidas rechazadas por encabezado; texto al 200 % sin romper el menú; la barra ya no baja el cliente de Supabase (portada 202 → 138 KB de JS); **la web corre en Google Cloud Run** (`apps/web/Dockerfile`, `output: standalone`, imagen probada de punta a punta — guía en `docs/despliegue-google-cloud.md`). Detalle en la BITÁCORA.
- **Ronda de escala (28/9-1/10/2026, pedido del dueño: "que el proyecto escale"):**
  · **Las páginas públicas ya no consultan la base en cada visita**: cliente sin cookies (`lib/supabase/publico.ts`) + caché de DATOS de 60 s con etiquetas (`lib/cache-publico.ts`); cada acción que cambia algo público llama a `olvidar(...)`. Portada 1.505 → 166 ms con 10 visitas a la vez. Las páginas son `force-dynamic` A PROPÓSITO: estáticas pedirían la base al compilar. Lo que depende de quién mira (el nombre del autor de una reseña, sólo para quien tiene cuenta) lo completa `conNombresDeAutores`, fuera de la caché.
  · **Compartir un enlace**: `lib/tarjeta.ts` arma openGraph + twitter para todas las páginas (Next REEMPLAZA entero el openGraph del layout si la página define el suyo) y `/og.png`. Obras y perfiles demo con `noindex`; `/trabajos` visible sin cuenta pero `noindex` y fuera del sitemap.
  · **Tipografías en el repo** (`apps/web/app/fonts/`, `next/font/local`), acotadas a los pesos que se usan: 111 → 79,6 KB por página, y el build ya no depende de Google.
  · **La app móvil importa `@pinturapro/dominio`** (`"file:../../packages/dominio"`, NO `workspace:*`, que rompe `npm install`): sin copias de las reglas.
  · **Migraciones 0024 (escala), 0025 (textos de la base) y 0026 (topes por hora, piso de la cotización y pedido adjudicado no editable, en la base) ESCRITAS, REVISADAS POR `seguridad-rls` Y PROBADAS EN ROLLBACK, SIN APLICAR NI COMMITEAR**: el clasificador de permisos frenó las dos cosas; las autoriza el dueño. **Orden obligatorio 0024 → 0025 → 0026** (ensayo: `tools/auditoria/escala/probar-orden.sql`). La web ya funciona antes y después (`getNumerosReales` usa `resumen_publico()` si existe). Al aplicarlas falta la paginación de `/trabajos`. Cómo aplicarlas: BITÁCORA, "Tareas del dueño".
  · **2/10 (segunda parte):** la varita del simulador corre en un Web Worker (primer clic 577-623 → 319-339 ms de pantalla congelada; `tools/auditoria/simulador/congelamiento.cjs`), "Deshacer" e "Intensidad" junto al color; reseñas con salida (el pintor las lee y las denuncia desde /dashboard, el admin las da de baja en /admin → Reseñas, acción protegida por `es_admin()`); piso de $1.000 y sin teléfono ni mail en la nota de una cotización; superficie y años validados en el servidor; 10 pedidos y 30 cotizaciones por hora; `lib/queries.ts` partido en `lib/queries/` (siete módulos).
  · Textos que prometían de más (corregidos): "Verificado", "pintores de tu zona", "te avisamos" con los mails apagados, "activar tu perfil", el pie de los mails. Formularios de pasos que dicen qué falta. Un pintor sin reseñas dice "Nuevo", no "★ 0.0". El pintor ve su comisión en el panel.
  · Reportes de cada agente y el cierre del orquestador: `tools/auditoria/rondas/2026-09-28-escala/`.
- **Ronda del simulador (3-5/10/2026, pedido del dueño: "foco absoluto en el simulador, que no haya errores al aplicar los colores"):** primera vez medido con **18 fotos reales** (`tools/auditoria/simulador/fotos-reales.py`; antes sólo 3 sintéticas) y con dos agentes nuevos, `simulador-fidelidad` y `simulador-uso-real`. Cada arreglo con su prueba, vista fallar contra el código anterior. Detalle: `tools/auditoria/rondas/2026-10-03-simulador/` y la BITÁCORA.
  · **El color de la pared no era el elegido**: la Intensidad arrancaba en 90 % y el 10 % lo ponía la pared vieja (Blanco Puro sobre pared roja ΔE 7,4), y el croma de los claros se perdía. Ahora 100 % y croma C/L constante: ΔE 0,26-0,61 (`simulador-color-fiel`). El recorte de gama corría el tono de los oscuros (43,5° → 2,7°).
  · **Varita**: sin el tope de radio que cortaba la pared en un arco (recall 82 → 94 %); freno relativo al grano de la pared (el techo de un cuarto blanco 100 → 0 %); el marco de la foto ya no es un pasillo sin bordes. Para lo que la varita no puede (ladrillo, piedra, el techo de r07/r13): **⬠ Contorno**.
  · **Estados rotos**: color viejo si se elegía otro mientras la varita calculaba; Deshacer que se llevaba la pared anterior; la IA que pintaba una foto con las regiones de otra; pincel con huecos. Todos con prueba (`simulador-acciones`, `simulador-carreras`).
  · **Nuevo**: varias paredes con su color (`＋ Dejar <color> y pintar otra pared`, cada una con su Intensidad, Deshacer las incluye), Contorno (pintar y quitar, también sobre paredes fijas), ver la foto original, guardar la imagen, tira de colores e Intensidad pegadas a la foto en el celular, borde que se desmezcla (sin contorno del color viejo ni línea gris).
  · **El motor vive en `packages/color`** (`pintura.ts`, `borde.ts`, `poligono.ts`, `magic-wand.ts`, `oklab.ts`) y se prueba sin navegador: **`pnpm pruebas-color`** (36 pruebas). Velocidad (celular gama media): cambiar de color 241 → ~100 ms, el borde 5× más rápido, la carga de la foto 3×.
- **Sistema de auditoría (reutilizable desde cualquier sesión, sin re-explicar nada):** **23 agentes** (los del simulador: `simulador-color`, `simulador-fidelidad`, `simulador-uso-real`) en `.claude/agents/` — los cinco nuevos del 28/9 son `escala-y-volumen` (2 sub-agentes: base, web), `abuso-marketplace` (3: pintor-tramposo, cliente-tramposo, robot), `buscadores`, `arquitectura-modular` y `retroalimentacion` (cierra cada ronda: actualiza lo que aprendió cada agente). Los otros: `recorrido-web` (que se lanza como 4 sub-agentes: visitante, cliente, pintor, navegación), `formularios-hostiles`, `simulador-color`, `seguridad-rls`, `sesiones-y-acceso`, `regresiones`, `accesibilidad`, `rendimiento`, `app-movil`, `listo-para-publicar`, `nube-google`, `contenido-confianza`, `riesgo-legal`, `dinero-y-comisiones`, `dependencias` e `integridad-datos`. Cada uno lleva "Lo que aprendieron las rondas anteriores": arranca desde donde terminó su última ronda. **Para que se vean por nombre desde una sesión abierta en la raíz del Codespace hace falta el enlace de `tools/auditoria/instalar-agentes.sh`** (Claude Code busca agentes subiendo desde la carpeta de la sesión, nunca bajando).
  · **El kit** vive en `tools/auditoria/` (dentro del repo: antes estaba en `/tmp` y el Codespace se lo llevó puesto dos veces): `navegador.cjs` (Chrome propio por agente, `auditar()`, `ingresar`/`salir`, espera de hidratación), `REGLAS.md` (lo que no se hace nunca + las trampas de medición que ya costaron tiempo), `generar.py` y `mascara.py`.
  · **`tools/auditoria/BITACORA.md` es la memoria**: qué se rompió, cómo se veía y qué prueba lo cuida. Lo que figura como corregido no se reporta de nuevo; lo descartado no se vuelve a levantar sin evidencia nueva.
  · **Reportes que sobreviven**: cada agente guarda el suyo en `tools/auditoria/rondas/<ronda>/` (REGLAS §4) y el orquestador escribe `cierre.md` (lo que verificó; manda sobre los reportes). `node tools/auditoria/cobertura.mjs` genera `COBERTURA.md`: qué pantalla, acción, tabla o función no nombra nadie (13 al cierre de la ronda de escala, desde 31).
  · **`pnpm verificar` corre 36 pruebas de regresión** (`tools/auditoria/regresiones/`) contra el servidor de desarrollo. Una prueba por cosa que ya se rompió una vez. **Regla del sistema: un arreglo sin prueba se vuelve a romper** — pasó con el botón cortado del panel del cliente, que ya se había corregido en `/dashboard` y volvió.
  · **El vigilante 24/7 corre en Google Cloud** (Cloud Run Job cada 30 min + uptime check cada minuto + alertas por log), no en GitHub Actions: `tools/auditoria/vigilancia/` y `docs/vigilancia-google-cloud.md`.
- **Arquitectura — el proyecto deja de ser un bloque único** (decisión del dueño): ver `docs/arquitectura.md`. Hechos: **`packages/color`** (varita mágica + OKLab) y **`packages/dominio`** (montos y comisión, topes de largo, mensajes de error, permisos por rol, y `entrada.ts` con las guardas de lo que llega por la red), los dos consumidos por `apps/web` como dependencia del workspace y probables sin levantar nada (`node packages/dominio/pruebas.ts`). Desde el 29/9 el móvil también importa `packages/dominio`. Queda `packages/datos` (queries y mutaciones de Supabase), hoy duplicado entre web y móvil; el paso previo ya está: `lib/queries.ts` (1.577 líneas) es desde el 1/10 `lib/queries/` (`base`, `pintores`, `obras`, `resenas`, `pedidos`, `contenido`, `metricas-admin` + `index.ts` que re-exporta; nadie que lo importa cambió).
- **Auditoría (sept 2026):** 5 agentes en paralelo sobre deploy, seguridad/RLS, simulador, app móvil y recorrido de usuario. Sin hallazgos críticos ni altos de RLS: las funciones `security definer` de 0011/0012 aguantaron todos los ataques. Se corrigieron: los RCE de Next, la **fuga de coordenadas de clientes** (0013), la afirmación falsa del simulador sobre no subir la foto, "pintores verificados" (que no existía), las afirmaciones sobre las marcas, y la desincronización de la app móvil con los triggers de 0009.
- **Legales:** `/privacidad` y `/terminos` publicadas y linkeadas desde el footer. Hacen falta para la Ley 25.326 y porque **Facebook no aprueba la app OAuth sin URL de política de privacidad**. Tienen TODOs del dueño: razón social y revisión por un abogado.
- **Fase 1 (marketing):** ✅ home, obras, obras/[slug], simulador, **colores**, nosotros, contacto. **`/cotizar` ya no existe** (27/9): era el pedido de presupuesto a la empresa y en un marketplace puro no hay empresa que cotice; redirige (308) a `/publicar`, la puerta de entrada real.
- **Fase 2 (pro):** ✅ pintores, pintor/[id], registro, mapa, dashboard. Sobre datos reales de Supabase (los mocks quedan sólo como respaldo si la base no responde).
- **Fase 3 (marketplace):** ✅ publicar, trabajos, cotizaciones, **panel** (analítico, con métricas REALES vía 0012), admin. Sobre datos reales de Supabase. El checkout falso se retiró (`docs/pendientes/`).
- **Componentes `features/`:** 14 + `brand-color-swatch` + `photo-simulator` (+ `varita.worker.ts`).
- **Marcas y colores:** `lib/brands.ts` tiene una paleta **DE MUESTRA** agrupada por marca: los colores, nombres y códigos se crearon para el desarrollo, **no los proveyó ninguna marca** (confirmado por el dueño). Mientras `PALETA_DEMO = true` la interfaz no muestra códigos ni líneas de producto, y avisa que son colores de ejemplo — los códigos inventados van pegados a líneas reales (Albalatex, Albamur) y alguien podría pedirlos en la pinturería. Para cargar las cartas reales hace falta conseguirlas con autorización de cada marca y pasar la bandera a false.
- **Simulador (`/simulador`, `components/features/photo-simulator.tsx`):** subir foto → tocar la pared → la **varita** (`packages/color/src/magic-wand.ts`, en un Web Worker: `varita.worker.ts`) marca la superficie → el motor (`packages/color/src/pintura.ts`, `componer`) aplica el tono y el croma del color elegido con la luz de la foto (OKLab, C/L constante, CONTRASTE 0,6), con el borde desmezclado (`borde.ts`). Herramientas: Sensibilidad, ⬠ Contorno (`poligono.ts`), 🖌 Pincel / ⌫ Borrar, varias paredes, Deshacer (un nivel, selección + paredes fijas), ver original, guardar imagen. **La foto no sale del navegador**, salvo en el modo **🤖 IA**, opcional, que la manda a `/api/segment` (Replicate `meta/sam-2`; con sesión; 12 por hora) y elige la región del toque entre las que devuelve.
  - **Backend IA**: `REPLICATE_API_TOKEN` + `REPLICATE_VERSION` (o `REPLICATE_DEPLOYMENT` para no arrancar en frío) o `SAM_BACKEND_URL`. Sin ninguno, la IA avisa que no está disponible y la Varita y el Contorno siguen andando. El pedido se puede cancelar y se corta a los 70 s con aviso.
- **Filtro interior/exterior:** en `/simulador` el toggle filtra colores por `usage`.
- **Supabase (backbone, EN INTEGRACIÓN):** SDK (`@supabase/ssr`), clientes browser/server en `lib/supabase/` (+ tipos), middleware de sesión (protegido si no hay env), esquema en `supabase/migrations/0001_init.sql` (profiles/projects/jobs/reviews + RLS + alta auto de profile). **Auth listo:** `/ingresar`, `/crear-cuenta` (rol cliente/pintor/empresa), `app/auth/callback` y `app/auth/signout`, estado en el navbar (`AuthNav`). Todo protegido: sin keys la app anda igual. **LIVE:** proyecto creado (`ojdtixmysrfywgvowqie`), keys en `.env.local`, migración corrida y BD **sembrada** con datos demo (`scripts/seed_supabase.py`: 1 empresa, 3 pintores, 2 clientes, 3 obras, 1 job, 1 reseña; login demo `*@pinturapro.demo` / `Demo1234!`). RLS verificada (anon ve pintores/obras, no ve jobs). **Páginas en datos reales:** `/pintores`, `/obras`, `/obras/[slug]` y `/pintor/[id]` leen de Supabase vía `lib/queries/` (`getPainters`, `getProjects`, `getProjectBySlug`, `getPainterById`, `getProjectsByOwner`, `getReviewsForPainter`), con **fallback a mocks** si falla. Cards renderizan imagen real (o iniciales). `/pintores` es Server Component + `pintores-client` (filtros). **Normalización (migración 0002 aplicada):** `profiles.rating`/`rating_count` ahora son **caché mantenido por trigger desde `reviews`** (fuente de verdad); `profiles.specialties text[]`; `projects.category`(enum)+`accent_color` persistidos. Seed v2 (`scripts/seed_supabase.py`) genera 20 reseñas → ratings calculados (Martín 4.9/9, Lucía 4.7/7, Diego 4.5/4). **Dashboard del pintor (`/dashboard`) wireado:** Server Component con gate de auth (sin sesión → redirect `/ingresar?next=/dashboard`); muestra métricas reales (trabajos completados/activos, obras, reseñas), rating, lista de trabajos (cliente+obra+monto via `getJobsForPainter`) y su portfolio. Login respeta `?next=`. **Crear obras (write) listo:** `/dashboard/nueva-obra` (form) + Server Action `createObra` en `app/(pro)/dashboard/actions.ts` que inserta con `owner_id=auth.uid()` (RLS verificada: 201 propia, 403 ajena), revalida `/obras` y `/dashboard`. **Storage (fotos) listo:** bucket público `projects`; la foto se redimensiona en el cliente (`resizeImage`, ~1600px) y el Server Action la sube con **service-role** (`lib/supabase/admin.ts`, bypassa RLS tras validar sesión) → guarda la URL pública como `cover_url`. Sin políticas de Storage por SQL. `next.config` con `serverActions.bodySizeLimit: 6mb`. **Editar/borrar obras listo:** `/dashboard/editar/[slug]` (reusa `NuevaObraForm` con prop `initial`, query `getOwnedProjectBySlug`) + actions `updateObra`/`deleteObra` (filtran por `owner_id`; `deleteObra` limpia la foto del Storage best-effort). Cards del panel con acciones Editar/Borrar (`portfolio-actions.tsx`, confirmación inline). RLS UPDATE/DELETE verificada (propio 1 fila, ajeno 0 filas). **Login social + paneles por rol listos:** botones Google/Microsoft(azure)/Facebook (`components/features/social-auth.tsx`) en `/ingresar` y `/crear-cuenta`; OAuth vuelve a `/auth/callback?next=/mi-panel`. **Dispatcher `/mi-panel`** rutea por rol: sin rol → `/bienvenida` (elige cliente/pintor/empresa, `app/bienvenida/role-picker.tsx`), cliente → **`/cliente`** (panel de cliente: solicitudes, pintores contratados), pintor/empresa → **`/dashboard`** (panel profesional, ahora generalizado: empresa muestra "Panel de empresa"). Migración **0003** agrega `profiles.onboarded` (true si el alta trajo rol, false si OAuth) y recrea `handle_new_user`; `isOnboarded()` falla seguro (si la columna no existe devuelve true → no bloquea). Navbar con sesión muestra "Mi panel"+"Salir". Queries nuevas: `getOwnProfile`, `isOnboarded`, `getJobsForClient`. **Vos:** correr `0003_onboarding.sql` + habilitar proveedores en Supabase (ver `docs/auth-oauth.md`). **Perfil real del pintor listo:** `/dashboard/perfil` (form `perfil-form.tsx`) + acción `updateProfile` (nombre/bio/zona/especialidades/avatar); avatar al bucket público **`avatars`** (mismo patrón service-role, recorte cuadrado 512px en cliente). Helper `uploadImage(bucket,...)` generaliza la subida. **Marketplace listo (datos reales):** cliente publica pedido (`/publicar` → `publicarTrabajo`, project type=`service`); pintor ve pedidos y cotiza (`/trabajos` server + `quote-form.tsx` → `cotizar`, job status=`quoted` con `note`); cliente compara y acepta (`/cotizaciones` server + `accept-button.tsx` → `aceptarCotizacion`, job→`accepted`). Acciones en `app/(marketplace)/actions.ts`; queries `getOpenServiceRequests`/`getQuotesForClient`. Migración **0004** agrega `jobs.note` + RLS `jobs_insert_painter_quote` (painter_id=auth.uid(), status='quoted', sobre un service del client_id). **Migraciones 0003 + 0004 APLICADAS** (vía Management API) y **OAuth Google+Microsoft+Facebook LIVE** (los tres habilitados; Azure tenant `common`; MS/FB en dev = solo admin/testers). **Reseñas post-trabajo listas:** el pintor marca su trabajo aceptado como completado (`complete-button.tsx` → `marcarCompletado`, accepted→completed) y el cliente deja reseña (estrellas+comentario, `cliente/review-form.tsx` → `dejarResena`, insert en `reviews`); el trigger recalcula el rating del pintor (verificado: 9→10 reviews, duplicado bloqueado 409, RLS sin DELETE en reviews/jobs a propósito). `getJobsForClient` ahora trae `painterId`+`reviewed`. **Onboarding→perfil:** al elegir pintor/empresa en `/bienvenida` se va a `/dashboard/perfil` a completar; cliente va directo a su panel. **Emails (Resend) gated:** `lib/email.ts` (`notifyUser`/`emailLayout`) avisa al cliente cuando recibe cotización y al pintor cuando se la aceptan; **inactivo sin `RESEND_API_KEY`** (no rompe). Vars en `.env.example` (`RESEND_API_KEY`/`RESEND_FROM`/`NEXT_PUBLIC_SITE_URL`). **Pendiente:** pagos (Stripe Connect), publicar app FB a producción, verificación de editor MS. Ver `docs/supabase-setup.md`/`docs/auth-oauth.md`. Terceros en `docs/terceros.md`.
- **Pendiente real:** backend SAM (Replicate puente → Wizart, ver `docs/wizart-outreach.md`), reemplazar mocks de `lib/data.ts` y colores curados por datos reales (`// INTEGRACIÓN:`), assets en `public/images`, integraciones (ver Roadmap).
- `hero-fluid` está implementado con **canvas 2D** (no React Three Fiber) por performance y reduced-motion; la versión WebGL queda como opción futura.
- **App móvil (`apps/mobile/`, Expo + React Native + TypeScript):** mismo Supabase que la web (anon key, RLS). Stack: expo-router, supabase-js + AsyncStorage (sesión persistente), theme de constantes que replica los tokens (sin NativeWind, StyleSheet). Hecho: tabs **Pintores/Trabajos/Aprender/Cuenta**; lista+detalle de pintores; **marketplace completo** (cliente publica trabajo `app/publicar.tsx`, pintor cotiza `app/cotizar/[id].tsx`, cliente acepta/deja reseña `app/resena/[jobId].tsx`, pintor marca completado); **Cuenta = panel por rol** (cliente: cotizaciones recibidas+aceptar; pintor: sus trabajos+completar+editar perfil `app/perfil.tsx`); **Aprender** = contenido dinámico (guías/videos/cursos/asesoramiento/FAQs/novedades) `app/(tabs)/aprender.tsx`; login email/contraseña. Lecturas en `lib/queries.ts`, escrituras en `lib/mutations.ts` (RLS, espejo de la web; sin emails porque requieren service-role). Componentes de formulario (Field/Note/StarPicker) en `components/ui.tsx`. **EAS** configurado en `apps/mobile/eas.json` (la anon key va como `eas secret`, no se commitea). Correr: `cd apps/mobile && npm install && npx expo install --fix && npx expo start` (Expo Go). No se puede previsualizar ni tipar (no hay tipos RN instalados) desde el Codespace. Pendiente: OAuth con deep links, push, subir fotos al portfolio (expo-image-picker), fuentes de marca. Decisión de infraestructura: Google Cloud (`docs/despliegue-google-cloud.md`); plan móvil en `docs/mobile-plan.md`.

## Roadmap e Integraciones (visión confirmada por el usuario)

Stack objetivo (marketplace puro; ver la nota del principio). Lo que **falta** necesita cuentas/claves del usuario:

- **Fase 1 (actual):** sitio + portfolio + simulador + cotización. Integraciones pendientes: **Supabase** (auth/db/storage), **Sanity** (CMS), **Cloudinary** (imágenes), **Resend** (emails). Backend SAM para el simulador.
- **Fase 2 (Pro Partners):** pintores verificados, perfiles, reseñas, **Mapbox** (mapa real, hoy es esquemático), **FastAPI ai-service** (SAM + matching) en Docker (Railway/Render).
- **Fase 3 (Marketplace):** **Stripe Connect** (sub-cuentas por pintor, comisión 8–12%), dashboard analítico.
- **Modelo de datos (Supabase, diseñar multi-tenant desde día 1):** `profiles(type: company|painter|client, verified, rating)`, `projects(owner_id, type: portfolio|service, location, budget)`, `jobs(client_id, painter_id, status, amount, commission)`, `reviews(job_id, rating, photos[])`.
- **Deploy:** **Google Cloud** (decisión del dueño): la web en Cloud Run y el vigilante 24/7 como Cloud Run Job. La guía es `docs/despliegue-google-cloud.md`.
- Nota: `three`/`@react-three/fiber`/`gsap` **ya no están instalados** (verificado por el agente `dependencias` el 27/9: ni en `package.json` ni en el lockfile). WebGL/ScrollTrigger quedan como mejoras posibles de Fase 1/2: si se retoman, hay que instalarlos. `packages/ui` existe pero **nadie lo consume** (ningún `package.json` lo declara). `shadcn/ui` figura en la visión pero el proyecto usa su **propio design system** con tokens.

## Stack Tecnológico

- Next.js 15 (App Router) + TypeScript, Tailwind CSS con un design system propio (tokens abajo;
  no se usa shadcn/ui).
- Supabase: base Postgres con RLS, autenticación y almacenamiento de fotos.
- Expo / React Native para la app móvil.
- Lenis (scroll suave). El hero es canvas 2D: React Three Fiber y GSAP **no están instalados**.
- pnpm workspaces + Turborepo. Publicación en Google Cloud Run (`apps/web/Dockerfile`).

## Estructura del Monorepo

El mapa de carpetas está en `README.md` (la raíz del proyecto). Lo que más se toca:

```
apps/web/
  app/                      páginas (App Router). Los grupos (marketing), (pro), (marketplace)
                            y (auth) NO agregan segmento de URL: ver Convenciones, punto 6
  components/features/      componentes (navbar, simulador, formularios de pasos, reseñas…)
  lib/queries/              lecturas de la base, un archivo por tema, re-exportadas por index.ts
  lib/supabase/             clientes: con cookies (server.ts), sin cookies para lo público
                            (publico.ts), con la clave de servicio (admin.ts), del navegador
  lib/cache-publico.ts      la caché de 60 s de los datos públicos y sus etiquetas
apps/mobile/                app Expo; las reglas las importa de packages/dominio
packages/dominio/           reglas del negocio compartidas (con sus pruebas: pruebas.ts)
packages/color/             varita mágica y mezcla de color del simulador
supabase/migrations/        el esquema y la seguridad, en orden
tools/auditoria/            pruebas de regresión, vigilante 24/7, BITÁCORA, REGLAS, rondas
docs/                       guías vigentes; lo superado, en docs/historico/
```

## Design Tokens (Tailwind)

### Colores
- `--plaster`: #EDEBE6 (fondo base)
- `--ink`: #141414 (texto principal)
- `--concrete`: #6B6B6B (texto secundario)
- `--mist`: #F5F4F0 (superficies elevadas)
- `--bone`: #FFFFFF (puros)
- `--accent-dynamic`: variable por proyecto

### Tipografía
- **Display**: Space Grotesk, 700, tracking -0.02em
- **Body**: Inter, 400-500
- **Mono**: JetBrains Mono, 400, tracking 0.05em

### Movimiento
- `ease-expo-out`: cubic-bezier(0.16, 1, 0.3, 1)
- `ease-expo-in`: cubic-bezier(0.7, 0, 0.84, 0)

## Convenciones de Código

1. **Mobile-first**: todos los estilos parten de mobile y escalan hacia arriba.
2. **Accesibilidad**: focus-visible estilizado, contraste WCAG AA, prefers-reduced-motion respetado.
3. **Componentes**: todos en `components/features/`, desacoplados y reutilizables.
4. **Integraciones**: marcar con `// INTEGRACIÓN:` cada punto que conecta con Supabase / Stripe / Sanity / IA.
5. **Copy**: en español rioplatense, tono sofisticado y seguro. Nada de lorem ipsum.
6. **Rutas / route groups**: los grupos `(marketing)`, `(pro)`, `(marketplace)` **no agregan segmento de URL**. Dos páginas con el mismo nombre en grupos distintos colisionan y rompen el build. Por eso el dashboard analítico del marketplace vive en **`/panel`** (no `/dashboard`, que es el del pintor). Las carpetas con paréntesis/corchetes deben ir **entre comillas** en scripts bash (`cat > "app/(marketing)/..."`).

## Comandos Disponibles

```bash
pnpm dev                              # servidor de desarrollo en :3000
pnpm verificar                        # las pruebas de regresión, contra :3000
node packages/dominio/pruebas.ts      # las reglas del negocio, sin levantar nada
bash tools/auditoria/produccion.sh    # compilación de producción en una copia aparte, en :3100
node tools/auditoria/cobertura.mjs    # qué no mira ninguna prueba ni agente → COBERTURA.md
npx tsc --noEmit                      # chequeo de tipos (desde apps/web)
```

**No correr `pnpm build` ni `next build` en la carpeta del proyecto** mientras corre `pnpm dev`:
pisa el `.next` del servidor y deja todo dando error 500 (REGLAS §1). Para compilar, `produccion.sh`.

## Git / Push a GitHub

El `GITHUB_TOKEN` que inyecta Codespaces **no tiene permiso de escritura** sobre este repo (da 403) y su credential helper se cuela antes que otros. Para pushear hay que usar un **PAT** del usuario (`franco8706`), limpiando la lista de helpers y pasando el token en la URL, sin guardarlo en `.git/config`:

```bash
git add . && git commit -m "..."
git -c credential.helper= push https://franco8706:<PAT>@github.com/franco8706/pinturapro.git main
```

El remote `origin` debe quedar **sin token** (`https://github.com/franco8706/pinturapro.git`).

## Reglas Anti-Cliché

- NO usar fondo crema (#F4F1EA) + serif de alto contraste + terracota.
- NO usar fondo casi negro + único acento verde ácido o bermellón.
- NO usar layout tipo diario con líneas hairline y cero border-radius.
- La tipografía display (Space Grotesk) tiene carácter arquitectónico, no es decorativa.
- El movimiento sirve a la historia: hero fluido + color wipe, todo lo demás disciplinado.
