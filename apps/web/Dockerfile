# ═══════════════════════════════════════════════════════════════════════════
# Imagen de la web de Pintura Pro, para Google Cloud Run.
# ═══════════════════════════════════════════════════════════════════════════
# Se construye DESDE LA RAÍZ del monorepo, no desde apps/web: la web usa paquetes del
# workspace (packages/color, packages/dominio) que viven afuera de esta carpeta.
#
#   docker build -f apps/web/Dockerfile \
#     --build-arg NEXT_PUBLIC_SUPABASE_URL=... \
#     --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
#     --build-arg NEXT_PUBLIC_SITE_URL=https://el-dominio \
#     -t pinturapro-web .
#
# Las variables NEXT_PUBLIC_* se HORNEAN en el código del navegador al compilar: cambiarlas
# es recompilar la imagen, no alcanza con redesplegar. Las secretas (SUPABASE_SERVICE_ROLE_KEY,
# RESEND_API_KEY, REPLICATE_API_TOKEN…) NO van acá: se cargan en Cloud Run desde Secret
# Manager, en tiempo de ejecución. Una clave en una capa de la imagen queda para siempre en
# el historial de la imagen, aunque después se borre.
#
# Probada de punta a punta el 28/9/2026: compila, arranca, y el vigilante 24/7 da verde
# contra el contenedor (ver docs/despliegue-google-cloud.md).

# ── 1. Dependencias: sólo los manifiestos, para que Docker cachee la instalación ──
FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/color/package.json packages/color/
COPY packages/dominio/package.json packages/dominio/
COPY packages/ui/package.json packages/ui/
# `--filter` deja afuera la app móvil (Expo): cientos de MB que la web no usa.
RUN pnpm install --frozen-lockfile --filter @pinturapro/web...

# ── 2. Compilación ──
FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /repo
COPY --from=deps /repo ./
COPY apps/web apps/web
COPY packages packages
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_DATOS_DEMO=true
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_DATOS_DEMO=$NEXT_PUBLIC_DATOS_DEMO \
    NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @pinturapro/web build

# ── 3. Lo que corre: el servidor autónomo, sin el resto del monorepo ──
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=8080
# Un usuario sin privilegios: si alguien lograra ejecutar algo adentro, no es root.
RUN addgroup -S web && adduser -S web -G web
# En un monorepo, `standalone` reproduce la estructura de carpetas: el servidor queda en
# apps/web/server.js. Los archivos estáticos y /public no los copia solo: van a mano.
COPY --from=builder --chown=web:web /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=web:web /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=web:web /repo/apps/web/public ./apps/web/public
USER web
# Cloud Run manda el puerto en $PORT (8080 por defecto); server.js lo lee solo.
EXPOSE 8080
CMD ["node", "apps/web/server.js"]
