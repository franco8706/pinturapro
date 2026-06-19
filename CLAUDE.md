# Pintura Pro — Plataforma Web de Pintura Profesional

## Visión General

Este es un monorepo Turborepo con una aplicación Next.js 15 (App Router) para una plataforma de pintura profesional de obra. El proyecto tiene 3 fases:

- **Fase 1 (Empresa)**: Sitio showcase con portfolio, simulador de color, cotización online.
- **Fase 2 (Pro Partners)**: Directorio de pintores verificados con perfiles, reseñas y mapa.
- **Fase 3 (Marketplace)**: Clientes publican trabajos, pintores cotizan, pagos con comisión.

## Estado del Proyecto (actualizar al avanzar)

- **Repo:** https://github.com/franco8706/pinturapro (privado) · rama `main`.
- **Build:** `tsc --noEmit` y `next build` pasan limpio (19 rutas).
- **Fase 1 (marketing):** ✅ completa — home, obras, obras/[slug], simulador, cotizar, nosotros, contacto.
- **Fase 2 (pro):** ✅ páginas creadas — pintores, pintor/[id], registro, mapa, dashboard. Con datos mock.
- **Fase 3 (marketplace):** ✅ páginas creadas — publicar, trabajos, cotizaciones, checkout, **panel** (analítico), admin. Con datos mock.
- **Componentes `features/`:** los 14 creados y en uso.
- **Pendiente real:** reemplazar mocks de `lib/data.ts` por datos reales (ver puntos `// INTEGRACIÓN:`), assets en `public/images`, e integraciones (Supabase / pagos / mapa).
- `hero-fluid` está implementado con **canvas 2D** (no React Three Fiber) por performance y reduced-motion; la versión WebGL queda como opción futura.

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
