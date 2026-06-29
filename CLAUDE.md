# Pintura Pro — Plataforma Web de Pintura Profesional

## Visión General

Este es un monorepo Turborepo con una aplicación Next.js 15 (App Router) para una plataforma de pintura profesional de obra. El proyecto tiene 3 fases:

- **Fase 1 (Empresa)**: Sitio showcase con portfolio, simulador de color, cotización online.
- **Fase 2 (Pro Partners)**: Directorio de pintores verificados con perfiles, reseñas y mapa.
- **Fase 3 (Marketplace)**: Clientes publican trabajos, pintores cotizan, pagos con comisión.

## Estado del Proyecto (actualizar al avanzar)

- **Repo:** https://github.com/franco8706/pinturapro (privado) · rama `main`. Último push committeado: setup inicial + docs. Los cambios de "marcas + /colores + simulador SAM + filtro interior/exterior" están en el working tree, **falta commitear/pushear** (requiere PAT, ver [[pinturapro-git-push]]).
- **Build:** `tsc --noEmit` y `next build` pasan limpio (20 rutas).
- **Fase 1 (marketing):** ✅ home, obras, obras/[slug], simulador, **colores** (nuevo), cotizar, nosotros, contacto.
- **Fase 2 (pro):** ✅ pintores, pintor/[id], registro, mapa, dashboard. Con datos mock.
- **Fase 3 (marketplace):** ✅ publicar, trabajos, cotizaciones, checkout, **panel** (analítico), admin. Con datos mock.
- **Componentes `features/`:** 14 + `brand-color-swatch` + `photo-simulator` (SAM).
- **Marcas y colores:** `lib/brands.ts` con paleta **curada** de Alba, Sherwin Williams, Sinteplast, Plavicon (los sitios no exponen sus cartas). Página `/colores` + sección de marcas en la home. Scraper scaffold en `scripts/scrape-brands.mjs`. Ver [[pinturapro-brands]].
- **Simulador con IA (arquitectura cliente-servidor):** subir foto → clic en la pared → el cliente envía foto + punto a **`POST /api/segment`** → el backend (`meta/sam-2`) segmenta TODA la foto en regiones y las devuelve como data URLs → el **cliente elige la región que contiene el punto del clic** (precisión por pared) → aplica **color transfer HSL** (newL = targetL + origL − avgL, con protección de extremos) + **feathering** + pincel manual. La IA en el cliente (SlimSAM/Transformers.js) se **retiró** por baja precisión/lag. Detalles en [[pinturapro-simulador-sam]].
  - **Backend SAM**: `/api/segment` soporta **Replicate** (`REPLICATE_API_TOKEN` + `REPLICATE_VERSION` de `meta/sam-2`, `REPLICATE_POINTS_PER_SIDE=32`) o **proxy propio** (`SAM_BACKEND_URL`). Sin ninguno → 503 y solo anda el pincel. Ver `apps/web/.env.example`.
  - **Velocidad:** cold start ~15-60s la 1ª vez. Para ~2s siempre, crear un **Deployment** en Replicate (`min_instances=1`) y setear `REPLICATE_DEPLOYMENT=owner/name` (prioridad sobre VERSION). Decisión del usuario: pagar por rapidez (deployment aún no creado).
- **Filtro interior/exterior:** en `/cotizar` los ambientes dependen del tipo (exterior oculta baño/dormitorio/pasillo y viceversa); en `/simulador` el toggle filtra colores por `usage`.
- **Supabase (backbone, EN INTEGRACIÓN):** SDK (`@supabase/ssr`), clientes browser/server en `lib/supabase/` (+ tipos), middleware de sesión (protegido si no hay env), esquema en `supabase/migrations/0001_init.sql` (profiles/projects/jobs/reviews + RLS + alta auto de profile). **Auth listo:** `/ingresar`, `/crear-cuenta` (rol cliente/pintor/empresa), `app/auth/callback` y `app/auth/signout`, estado en el navbar (`AuthNav`). Todo protegido: sin keys la app anda igual. **LIVE:** proyecto creado (`ojdtixmysrfywgvowqie`), keys en `.env.local`, migración corrida y BD **sembrada** con datos demo (`scripts/seed_supabase.py`: 1 empresa, 3 pintores, 2 clientes, 3 obras, 1 job, 1 reseña; login demo `*@pinturapro.demo` / `Demo1234!`). RLS verificada (anon ve pintores/obras, no ve jobs). **Páginas en datos reales:** `/pintores`, `/obras`, `/obras/[slug]` y `/pintor/[id]` leen de Supabase vía `lib/queries.ts` (`getPainters`, `getProjects`, `getProjectBySlug`, `getPainterById`, `getProjectsByOwner`, `getReviewsForPainter`), con **fallback a mocks** si falla. Cards renderizan imagen real (o iniciales). `/pintores` es Server Component + `pintores-client` (filtros). **Normalización (migración 0002 aplicada):** `profiles.rating`/`rating_count` ahora son **caché mantenido por trigger desde `reviews`** (fuente de verdad); `profiles.specialties text[]`; `projects.category`(enum)+`accent_color` persistidos. Seed v2 (`scripts/seed_supabase.py`) genera 20 reseñas → ratings calculados (Martín 4.9/9, Lucía 4.7/7, Diego 4.5/4). **Dashboard del pintor (`/dashboard`) wireado:** Server Component con gate de auth (sin sesión → redirect `/ingresar?next=/dashboard`); muestra métricas reales (trabajos completados/activos, obras, reseñas), rating, lista de trabajos (cliente+obra+monto via `getJobsForPainter`) y su portfolio. Login respeta `?next=`. **Crear obras (write) listo:** `/dashboard/nueva-obra` (form) + Server Action `createObra` en `app/(pro)/dashboard/actions.ts` que inserta con `owner_id=auth.uid()` (RLS verificada: 201 propia, 403 ajena), revalida `/obras` y `/dashboard`. **Storage (fotos) listo:** bucket público `projects`; la foto se redimensiona en el cliente (`resizeImage`, ~1600px) y el Server Action la sube con **service-role** (`lib/supabase/admin.ts`, bypassa RLS tras validar sesión) → guarda la URL pública como `cover_url`. Sin políticas de Storage por SQL. `next.config` con `serverActions.bodySizeLimit: 6mb`. **Editar/borrar obras listo:** `/dashboard/editar/[slug]` (reusa `NuevaObraForm` con prop `initial`, query `getOwnedProjectBySlug`) + actions `updateObra`/`deleteObra` (filtran por `owner_id`; `deleteObra` limpia la foto del Storage best-effort). Cards del panel con acciones Editar/Borrar (`portfolio-actions.tsx`, confirmación inline). RLS UPDATE/DELETE verificada (propio 1 fila, ajeno 0 filas). **Login social + paneles por rol listos:** botones Google/Microsoft(azure)/Facebook (`components/features/social-auth.tsx`) en `/ingresar` y `/crear-cuenta`; OAuth vuelve a `/auth/callback?next=/mi-panel`. **Dispatcher `/mi-panel`** rutea por rol: sin rol → `/bienvenida` (elige cliente/pintor/empresa, `app/bienvenida/role-picker.tsx`), cliente → **`/cliente`** (panel de cliente: solicitudes, pintores contratados), pintor/empresa → **`/dashboard`** (panel profesional, ahora generalizado: empresa muestra "Panel de empresa"). Migración **0003** agrega `profiles.onboarded` (true si el alta trajo rol, false si OAuth) y recrea `handle_new_user`; `isOnboarded()` falla seguro (si la columna no existe devuelve true → no bloquea). Navbar con sesión muestra "Mi panel"+"Salir". Queries nuevas: `getOwnProfile`, `isOnboarded`, `getJobsForClient`. **Vos:** correr `0003_onboarding.sql` + habilitar proveedores en Supabase (ver `docs/auth-oauth.md`). **Perfil real del pintor listo:** `/dashboard/perfil` (form `perfil-form.tsx`) + acción `updateProfile` (nombre/bio/zona/especialidades/avatar); avatar al bucket público **`avatars`** (mismo patrón service-role, recorte cuadrado 512px en cliente). Helper `uploadImage(bucket,...)` generaliza la subida. **Marketplace listo (datos reales):** cliente publica pedido (`/publicar` → `publicarTrabajo`, project type=`service`); pintor ve pedidos y cotiza (`/trabajos` server + `quote-form.tsx` → `cotizar`, job status=`quoted` con `note`); cliente compara y acepta (`/cotizaciones` server + `accept-button.tsx` → `aceptarCotizacion`, job→`accepted`). Acciones en `app/(marketplace)/actions.ts`; queries `getOpenServiceRequests`/`getQuotesForClient`. Migración **0004** agrega `jobs.note` + RLS `jobs_insert_painter_quote` (painter_id=auth.uid(), status='quoted', sobre un service del client_id). **Migraciones 0003 + 0004 APLICADAS** (vía Management API) y **OAuth Google+Microsoft+Facebook LIVE** (los tres habilitados; Azure tenant `common`; MS/FB en dev = solo admin/testers). **Reseñas post-trabajo listas:** el pintor marca su trabajo aceptado como completado (`complete-button.tsx` → `marcarCompletado`, accepted→completed) y el cliente deja reseña (estrellas+comentario, `cliente/review-form.tsx` → `dejarResena`, insert en `reviews`); el trigger recalcula el rating del pintor (verificado: 9→10 reviews, duplicado bloqueado 409, RLS sin DELETE en reviews/jobs a propósito). `getJobsForClient` ahora trae `painterId`+`reviewed`. **Onboarding→perfil:** al elegir pintor/empresa en `/bienvenida` se va a `/dashboard/perfil` a completar; cliente va directo a su panel. **Emails (Resend) gated:** `lib/email.ts` (`notifyUser`/`emailLayout`) avisa al cliente cuando recibe cotización y al pintor cuando se la aceptan; **inactivo sin `RESEND_API_KEY`** (no rompe). Vars en `.env.example` (`RESEND_API_KEY`/`RESEND_FROM`/`NEXT_PUBLIC_SITE_URL`). **Pendiente:** pagos (Stripe Connect), publicar app FB a producción, verificación de editor MS. Ver `docs/supabase-setup.md`/`docs/auth-oauth.md`. Terceros en `docs/terceros.md`.
- **Pendiente real:** backend SAM (Replicate puente → Wizart, ver `docs/wizart-outreach.md`), reemplazar mocks de `lib/data.ts` y colores curados por datos reales (`// INTEGRACIÓN:`), assets en `public/images`, integraciones (ver Roadmap).
- `hero-fluid` está implementado con **canvas 2D** (no React Three Fiber) por performance y reduced-motion; la versión WebGL queda como opción futura.
- **App móvil (`apps/mobile/`, Expo + React Native + TypeScript):** mismo Supabase que la web (anon key, RLS). Stack: expo-router, supabase-js + AsyncStorage (sesión persistente), theme de constantes que replica los tokens (sin NativeWind, StyleSheet). Hecho: tabs **Pintores/Trabajos/Aprender/Cuenta**; lista+detalle de pintores; **marketplace completo** (cliente publica trabajo `app/publicar.tsx`, pintor cotiza `app/cotizar/[id].tsx`, cliente acepta/deja reseña `app/resena/[jobId].tsx`, pintor marca completado); **Cuenta = panel por rol** (cliente: cotizaciones recibidas+aceptar; pintor: sus trabajos+completar+editar perfil `app/perfil.tsx`); **Aprender** = contenido dinámico (guías/videos/cursos/asesoramiento/FAQs/novedades) `app/(tabs)/aprender.tsx`; login email/contraseña. Lecturas en `lib/queries.ts`, escrituras en `lib/mutations.ts` (RLS, espejo de la web; sin emails porque requieren service-role). Componentes de formulario (Field/Note/StarPicker) en `components/ui.tsx`. **EAS** configurado en `apps/mobile/eas.json` (la anon key va como `eas secret`, no se commitea). Correr: `cd apps/mobile && npm install && npx expo install --fix && npx expo start` (Expo Go). No se puede previsualizar ni tipar (no hay tipos RN instalados) desde el Codespace. Pendiente: OAuth con deep links, push, subir fotos al portfolio (expo-image-picker), fuentes de marca. Decisión de infra/contenedores en `docs/infraestructura.md`; plan móvil en `docs/mobile-plan.md`.

## Roadmap e Integraciones (visión confirmada por el usuario)

Stack objetivo (híbrido empresa → marketplace). Lo que **falta** necesita cuentas/claves del usuario:

- **Fase 1 (actual):** sitio + portfolio + simulador + cotización. Integraciones pendientes: **Supabase** (auth/db/storage), **Sanity** (CMS), **Cloudinary** (imágenes), **Resend** (emails). Backend SAM para el simulador.
- **Fase 2 (Pro Partners):** pintores verificados, perfiles, reseñas, **Mapbox** (mapa real, hoy es esquemático), **FastAPI ai-service** (SAM + matching) en Docker (Railway/Render).
- **Fase 3 (Marketplace):** **Stripe Connect** (sub-cuentas por pintor, comisión 8–12%), dashboard analítico.
- **Modelo de datos (Supabase, diseñar multi-tenant desde día 1):** `profiles(type: company|painter|client, verified, rating)`, `projects(owner_id, type: portfolio|service, location, budget)`, `jobs(client_id, painter_id, status, amount, commission)`, `reviews(job_id, rating, photos[])`.
- **Deploy:** Vercel (web) + servicio Python en Railway/Render (solo cuando entre el ai-service).
- Nota: `three`/`@react-three/fiber`/`gsap` están instalados pero **sin usar** todavía (WebGL/ScrollTrigger son mejoras de Fase 1/2). `shadcn/ui` figura en la visión pero el proyecto usa su **propio design system** con tokens.

## Stack Tecnológico

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- React Three Fiber + drei (WebGL/3D)
- GSAP + ScrollTrigger (scroll cinematográfico)
- Lenis (smooth scroll)
- Turborepo (monorepo)

## Estructura del Monorepo

```
.
├── apps/web/                    # Aplicación principal Next.js
│   ├── app/                     # App Router (páginas)
│   │   ├── page.tsx             # Home (Fase 1)
│   │   ├── (marketing)/         # Grupo de rutas marketing
│   │   │   ├── obras/
│   │   │   │   ├── page.tsx     # Portfolio
│   │   │   │   └── [slug]/
│   │   │   │       └── page.tsx # Proyecto individual
│   │   │   ├── simulador/
│   │   │   │   └── page.tsx     # Simulador de color
│   │   │   ├── cotizar/
│   │   │   │   └── page.tsx     # Cotización online
│   │   │   ├── nosotros/
│   │   │   │   └── page.tsx     # Nosotros
│   │   │   └── contacto/
│   │   │       └── page.tsx     # Contacto
│   │   ├── (pro)/               # Grupo de rutas Pro Partners
│   │   │   ├── pintores/
│   │   │   │   └── page.tsx     # Directorio
│   │   │   ├── pintor/[id]/
│   │   │   │   └── page.tsx     # Perfil público
│   │   │   ├── registro/
│   │   │   │   └── page.tsx     # Onboarding
│   │   │   ├── mapa/
│   │   │   │   └── page.tsx     # Mapa por zona
│   │   │   └── dashboard/
│   │   │       └── page.tsx     # Dashboard pintor
│   │   └── (marketplace)/       # Grupo de rutas Marketplace
│   │       ├── publicar/
│   │       │   └── page.tsx     # Publicar trabajo
│   │       ├── trabajos/
│   │       │   └── page.tsx     # Trabajos disponibles
│   │       ├── cotizaciones/
│   │       │   └── page.tsx     # Cotizaciones/ofertas
│   │       ├── checkout/
│   │       │   └── page.tsx     # Checkout/pago
│   │       ├── panel/          # ⚠️ era "dashboard": renombrado a /panel
│   │       │   └── page.tsx     # Dashboard analítico
│   │       └── admin/
│   │           └── page.tsx     # Panel admin
│   ├── components/
│   │   ├── features/            # Componentes de feature
│   │   │   ├── hero-fluid.tsx
│   │   │   ├── color-wipe.tsx
│   │   │   ├── magnetic-button.tsx
│   │   │   ├── navbar.tsx
│   │   │   ├── footer.tsx
│   │   │   ├── project-card.tsx
│   │   │   ├── painter-card.tsx
│   │   │   ├── before-after-slider.tsx
│   │   │   ├── color-swatch.tsx
│   │   │   ├── level-badge.tsx
│   │   │   ├── process-step.tsx
│   │   │   ├── multi-step-form.tsx
│   │   │   ├── review-system.tsx
│   │   │   └── states.tsx
│   │   └── providers/
│   │       └── lenis-provider.tsx
│   ├── hooks/
│   │   ├── use-lenis.ts
│   │   ├── use-mouse-position.ts
│   │   └── use-media-query.ts
│   ├── lib/
│   │   ├── utils.ts             # cn() (clsx + tailwind-merge)
│   │   ├── animations.ts        # tokens de easing/duración + helpers (stagger, reveal)
│   │   └── data.ts              # mocks + tipos: Project, Painter, Job, Review, QuoteRequest
│   ├── types/
│   │   └── index.ts
│   ├── public/
│   │   └── images/
│   ├── tailwind.config.ts
│   ├── postcss.config.js        # tailwind + autoprefixer (necesario para que Tailwind procese)
│   ├── next.config.js
│   ├── tsconfig.json
│   └── package.json
├── packages/ui/                 # Package compartido de UI (futuro)
│   ├── src/
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
├── turbo.json
├── package.json
└── pnpm-workspace.yaml
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
# Desarrollo
pnpm dev              # Inicia el dev server
pnpm build            # Build de producción
pnpm lint             # ESLint

# Turborepo
pnpm turbo run build  # Build de todo el monorepo
pnpm turbo run lint   # Lint de todo el monorepo

# Typecheck rápido (desde apps/web)
npx tsc --noEmit
```

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
