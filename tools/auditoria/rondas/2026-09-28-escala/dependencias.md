# Auditoría de dependencias — ronda 2026-09-28-escala

## BLOQUEANTE
Ninguno.

## IMPORTANTE

**1. `next/font/google` descarga tipografías al compilar, no en el navegador.** `apps/web/app/layout.tsx:2-27` (Inter, Space Grotesk, JetBrains Mono). `next build`/`next dev` piden `fonts.googleapis.com`/`fonts.gstatic.com`. El Dockerfile (stage `builder`) arranca sin caché de `.next`: **cada build de imagen depende de que ese host responda en ese instante** — lo que falló el 28/9. Se evita con `next/font/local`, bajando los 3 archivos una vez a `apps/web/fonts/`.

**2. `next/og` (`ImageResponse`) es un punto ciego para `pnpm audit`.** No está en el lockfile: viene *vendored* dentro de `next` (`.../next/dist/compiled/@vercel/og@0.7.2`, con `satori`, `resvg.wasm` 1,4 MB, `yoga.wasm` 89 KB y fuente propia `noto-sans-v27-latin-regular.ttf`, usada porque `apps/web/app/og.png/route.tsx` no pasa `fonts`). `grep "@vercel/og" pnpm-lock.yaml` → vacío. No baja nada de red (`dynamic = "force-static"`; `curl localhost:3000/og.png` → 200, 38 KB) ni suma peso nuevo (viaja con `next` se use o no la ruta). Un CVE en `satori`/`resvg` sólo se parchea subiendo `next` entero, y ni `pnpm audit` ni `dependencias-seguras` lo ven.

## MENOR

**3. Telemetría activa fuera de Docker.** `next telemetry status` → Enabled; `~/.config/turborepo/telemetry.json` → `telemetry_enabled: true`. El Dockerfile ya pone `NEXT_TELEMETRY_DISABLED=1` (líneas 49 y 55), pero `pnpm dev`/`build`/`lint` locales siguen mandando datos, y Turborepo no tiene variable equivalente en ningún lado. Agregar `NEXT_TELEMETRY_DISABLED=1` y `TURBO_TELEMETRY_DISABLED=1` al entorno de desarrollo.

**4. `pnpm lint` puede intentar instalar ESLint solo.** `apps/web/package.json` no tiene `eslint` ni `eslint-config-next`, ni hay `eslint.config.*`. La primera corrida de `next lint` ofrece instalarlos desde npm; en CI no interactivo cuelga o falla.

**5. `sharp` baja binarios de libvips vía `optionalDependencies` de npm**, no por script propio: 0 scripts `pre/post/install` en las 890 carpetas de `node_modules/.pnpm` (`grep -rl '"postinstall"' .../package.json` → vacío), sin `requiresBuild` en el lockfile. Tráfico normal de instalación, sin acción.

## Vulnerabilidades (`pnpm audit --prod --audit-level=high`)
58 avisos (1 crítico, 44 altos, 12 moderados, 1 bajo), **todos** dentro de `apps/mobile > expo@52.0.49 > @expo/cli` (`tar`, `undici`, `js-yaml`, `fast-uri`, `image-size`, `browserslist`, `@xmldom/xmldom`): herramienta de compilación de Expo, ya sabido en BITÁCORA. `apps/web` limpio; `sharp` en 0.35.4 por el override.

## Desactualizado (`pnpm outdated -r`)
- `@supabase/supabase-js` 2.108.2→2.117.2 y `@supabase/ssr` 0.12.0→0.12.7: dentro del rango ya declarado (`^2.108.2`, `^0.12.0`) — un `pnpm install` sin tocar `package.json` ya los trae. Sin CVE hoy; conviene refrescar pronto (habla con auth/storage).
- `next` 15.5.25→16.3.7 y `react`/`react-dom` 18.3.1→19.3.0: saltos mayores atados entre sí (Next 16 sube el piso a React 19). Sin urgencia de seguridad; migración de esfuerzo alto, no probada.
- `tailwind-merge` 2→3, `tailwindcss` 3→4: sólo build-time de CSS.
- `apps/mobile` (expo 52→57, react-native 0.76→0.87): ya sabido, no probable desde el Codespace.

## Duplicados
`pnpm why -r react|next|@supabase/supabase-js` → una sola versión de cada uno (18.3.1 / 15.5.25 / 2.108.2).

## Sin uso / licencias
`three`, `@react-three/fiber`, `gsap` siguen sin instalar (ya sabido). Todas las dependencias de `apps/web/package.json` tienen import real. Sin GPL/AGPL; `node-forge` (BSD-3-Clause OR GPL-2.0, se puede tomar BSD); `@img/sharp-libvips-linux(musl)-x64` LGPL-3.0 (copyleft débil, sin obligación al correr como SaaS sin distribuir el contenedor).
