# Supabase — setup (base de datos + auth + storage)

Supabase es el **backbone** del proyecto: Postgres (datos) + Auth (login) + Storage (fotos).
El código ya está armado; falta **crear el proyecto y cargar las keys** (eso lo hacés vos —
la cuenta es tuya).

## 1. Crear el proyecto

1. Entrá a https://supabase.com → **New project**.
2. Región: la más cercana (ej. **South America (São Paulo)** para Argentina).
3. Guardá la contraseña de la base que te genera.

## 2. Cargar las credenciales

En **Project Settings → API** copiá:
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key (¡**SECRETA**, solo servidor!) → `SUPABASE_SERVICE_ROLE_KEY`

Pegalas en `apps/web/.env.local` (gitignored, NO se commitea):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## 3. Crear el esquema

En **SQL Editor** → New query → pegá y corré el contenido de
[`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql).
Crea las tablas `profiles`, `projects`, `jobs`, `reviews`, los triggers (incluido el alta
automática de profile al registrarse) y las políticas **RLS**.

## 4. (Opcional) Regenerar los tipos

Con la BD creada, podés reemplazar los tipos escritos a mano por los reales:
```bash
npx supabase gen types typescript --project-id <ref> > apps/web/lib/supabase/types.ts
```

## 5. Storage (cuando subamos fotos)

En **Storage** crear buckets: `avatars` (público), `projects` (público), `reviews` (público).
Las políticas de acceso se agregan en una migración aparte cuando lleguemos a esa parte.

---

## Cómo se usa en el código (ya disponible)

- **Navegador** (componentes `"use client"`):
  ```ts
  import { createClient } from "@/lib/supabase/client";
  const supabase = createClient();
  ```
- **Servidor** (Server Components / Route Handlers / Server Actions):
  ```ts
  import { createClient } from "@/lib/supabase/server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  ```
- El **middleware** (`apps/web/middleware.ts`) refresca la sesión solo. Si no hay env cargado,
  no hace nada (la app sigue funcionando sin Supabase).

## Datos de demo (sembrados)

La base ya tiene datos de prueba (script `scripts/seed_supabase.py`, reejecutable):
- **1 empresa, 3 pintores, 2 clientes** · **3 obras** · **1 trabajo** · **1 reseña**.
- **Login de demo** (todos con contraseña `Demo1234!`):
  - `empresa@pinturapro.demo` · `martin.rojas@pinturapro.demo` · `lucia.fernandez@pinturapro.demo`
  - `diego.sosa@pinturapro.demo` · `carolina.ruiz@pinturapro.demo` · `javier.mendez@pinturapro.demo`
- Re-sembrar: `SUPABASE_URL=… SUPABASE_SECRET=… python3 scripts/seed_supabase.py` (es idempotente).

## Estado

- [x] SDK instalado (`@supabase/supabase-js`, `@supabase/ssr`)
- [x] Clientes (browser + server) y tipos
- [x] Middleware de sesión (protegido)
- [x] Migración del esquema con RLS
- [x] **Auth**: páginas `/ingresar` y `/crear-cuenta` (con rol cliente/pintor/empresa),
      callback de email (`/auth/callback`), signout (`/auth/signout`) y estado en el navbar.
      Todo protegido: sin keys, la app funciona igual (auth queda inactiva).
- [ ] **Vos:** crear proyecto + cargar keys + correr la migración → probar registro/login
- [ ] En el dashboard de Supabase → **Authentication → Providers**: dejar Email activo
      (y configurar si pedís confirmación por email o no).
- [x] **Migración 0002** (normalización): rating por trigger desde reviews, `specialties`, `category`/`accent_color`.
- [x] Páginas en datos reales: `/pintores`, `/obras`, `/obras/[slug]`, `/pintor/[id]` (vía `lib/queries.ts`).
- [ ] Dashboard del pintor (con auth) y marketplace sobre datos reales
