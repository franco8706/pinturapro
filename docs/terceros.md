# Terceros y dependencias — Pintura Pro

Registro de **todos los servicios externos** (vendors) y librerías de los que depende el proyecto.
Mantener actualizado al sumar/quitar integraciones. Estados: **ACTIVO** (en uso) ·
**PLANEADO** (en el roadmap, no integrado) · **EVALUACIÓN** (probándose) · **PUENTE** (provisorio,
a reemplazar).

> Regla de oro: cada credencial va en `apps/web/.env.local` (gitignored). NUNCA se commitea un token.
> Ver `apps/web/.env.example` para la lista de variables.

---

## 1. Servicios externos (vendors)

### Infraestructura y desarrollo

| Servicio | Para qué | Estado | Precio | Datos que le enviamos | Credencial |
|---|---|---|---|---|---|
| **GitHub** | Repo `franco8706/pinturapro` (privado), control de versiones | ACTIVO | Free / Pro | Todo el código | PAT (no el GITHUB_TOKEN de Codespaces) |
| **GitHub Codespaces** | Entorno de desarrollo en la nube | ACTIVO | Free tier / por hora | Código + ejecución | Sesión GitHub |
| **Vercel** | Deploy del front Next.js | PLANEADO | Free / Pro (~US$20/mes) | Build + tráfico web | Cuenta Vercel |
| **Railway / Render** | Deploy del `ai-service` Python (SAM/matching) — Fase 2 | PLANEADO | Por uso (~US$5+/mes) | Imágenes a procesar | Cuenta |

### IA / Simulador de color

| Servicio | Para qué | Estado | Precio | Datos que le enviamos | Credencial |
|---|---|---|---|---|---|
| **Replicate** | Backend SAM del simulador (`meta/sam-2`) | **PUENTE** (a reemplazar) | ~US$ centavos/imagen | Foto del cliente (la pared) | `REPLICATE_API_TOKEN` |
| **Wizart AI** | Visualizador de pintura (interior + fachadas) — reemplazo objetivo | EVALUACIÓN (contacto comercial) | Enterprise/contrato | Foto del cliente | (pendiente, sandbox) |
| **Bria AI** | API de edición pro (máscara + gen_fill) — alternativa descartada | EVALUACIÓN (referencia) | US$0,08/img + 1000 gratis | Foto del cliente | `BRIA_API_TOKEN` |

> Ver `docs/simulador-apis.md` y `docs/wizart-outreach.md`. El simulador procesa **fotos subidas
> por el cliente** → revisar consentimiento/privacidad antes de producción.

### Datos, auth, contenido y pagos (roadmap)

| Servicio | Para qué | Estado | Precio | Datos que le enviamos | Credencial |
|---|---|---|---|---|---|
| **Supabase** | Base de datos (Postgres) + Auth + Storage | EN INTEGRACIÓN | Free / Pro (~US$25/mes) | Usuarios, proyectos, trabajos, reseñas, fotos | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Sanity** | CMS (contenido editorial: obras, blog) | PLANEADO | Free / por uso | Contenido del sitio | `NEXT_PUBLIC_SANITY_PROJECT_ID` |
| **Cloudinary** | Hosting/optimización de imágenes | PLANEADO | Free / por uso | Imágenes del portfolio/usuarios | (pendiente) |
| **Mercado Pago** (Suscripciones y QR) | Cobro de la suscripción del pintor (US$5/mes en pesos; débito automático o QR del mes). Decisión del dueño, 6/10/2026: sin comisión por trabajo | PLANEADO (etapa 3) | % por cobro, lo descuenta MP | Email del pintor y monto; la tarjeta la carga el pintor en MP | `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` |
| **Transferencia bancaria** (sin proveedor) | Tercer medio de la suscripción: el pintor transfiere con su código y se confirma con el extracto | PLANEADO (etapa 3) | — | Línea del extracto | `TRANSFERENCIA_ALIAS`/`CBU`/`TITULAR` |
| **dolarapi.com + API del BCRA** | Cotización del dólar oficial (Banco Nación vendedor) para pasar los US$5 a pesos, con la del BCRA como control | PLANEADO (etapa 2) | Gratis | Ninguno | — |
| ~~Stripe Connect~~ | No acepta empresas argentinas (en Latinoamérica sólo Brasil y México): queda para una empresa en el exterior | DESCARTADO por ahora | — | — | — |
| **Mapbox** | Mapa real de pintores por zona — Fase 2 | PLANEADO | Free tier / por uso | Ubicaciones (aprox.) | `NEXT_PUBLIC_MAPBOX_TOKEN` |
| **Resend** | Emails transaccionales (cotizaciones, avisos) | PLANEADO | Free / por uso | Emails de usuarios | `RESEND_API_KEY` |

### Solo para desarrollo / demos (no producción)

| Servicio | Para qué | Estado |
|---|---|---|
| **Unsplash** | Fotos de prueba para testear el simulador | DEV ONLY (no se sirve a usuarios) |

---

## 2. Librerías / frameworks clave (OSS, runtime)

No son "vendors" (no hay cuenta ni datos), pero el proyecto depende de ellos:

- **Next.js 15** + **React 18** — framework web (App Router).
- **Tailwind CSS** + PostCSS + Autoprefixer — estilos.
- **Turborepo** + **pnpm** — monorepo / gestor de paquetes.
- **TypeScript** + **Prettier** + ESLint (`next lint`) — tooling.
- **three** + **@react-three/fiber** + **@react-three/drei** — WebGL/3D (instalado, sin usar aún).
- **gsap** + **lenis** — animación y smooth scroll (instalado).
- **clsx** + **tailwind-merge** — utilidades de clases (`cn()`).

---

## 3. Resumen de riesgo / dependencia crítica

- **Crítico cuando entren:** Supabase (toda la data depende de él), Mercado Pago (el débito y el QR; la transferencia es el respaldo que no depende de nadie).
- **Reemplazable:** el backend del simulador (Replicate → Wizart) está aislado en `/api/segment`,
  se cambia sin tocar el resto.
- **Lock-in a vigilar:** Supabase (Postgres es portable, pero Auth/Storage atan), Mercado Pago (por eso la capa de pagos es un contrato con un adaptador por proveedor, y la transferencia no necesita ninguno).
- **Privacidad:** Replicate/Wizart/Bria/Cloudinary reciben **fotos de clientes**; Supabase guarda
  **datos personales**. Definir política de privacidad y retención antes de producción.
