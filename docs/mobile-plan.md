# App móvil — Pintura Pro (Expo / React Native)

App nativa para **Android e iOS** desde un solo código, sobre el **mismo Supabase** que la web.

## Stack

- **Expo (React Native) + TypeScript** — un código, ambas plataformas.
- **expo-router** — navegación por archivos (mismo modelo mental que el App Router de Next.js).
- **supabase-js** + AsyncStorage / SecureStore — datos, auth y sesión persistente.
- **Theme propio** (`lib/theme.ts`) que replica los design tokens de la web
  (ink/plaster/concrete/mist/bone, tipografías Space Grotesk / Inter / JetBrains Mono).
- Sin backend nuevo: reusa Supabase (DB + Auth + Storage) y sus RLS.

Vive en el monorepo: **`apps/mobile/`**.

## Cómo correrla (en tu teléfono, con Expo Go)

```bash
cd apps/mobile
npm install
npx expo start          # escaneás el QR con la app "Expo Go" (Android/iOS)
```

Antes, copiá `apps/mobile/.env.example` a `.env` y completá la URL y la anon key de Supabase
(las mismas de la web; la anon key es pública y segura para el cliente).

## Mapa de pantallas (se construye por iteraciones)

- [x] **Foundation**: config Expo, theme, cliente Supabase, sesión persistente.
- [x] **Auth**: login con email/contraseña (OAuth Google/MS/FB en una iteración siguiente).
- [x] **Tabs**: Pintores · Trabajos · Cuenta.
- [x] **Pintores**: directorio real (desde Supabase) + **detalle de pintor** (rating, bio, pros/cons, portfolio).
- [ ] **Cliente**: publicar trabajo, ver cotizaciones, aceptar, dejar reseña.
- [ ] **Pintor**: panel, cotizar trabajos, marcar completado, editar perfil/portfolio.
- [ ] **Aprender / Novedades / Asesoramiento** (contenido dinámico).
- [ ] **Push notifications** (expo-notifications) + **deep links** para OAuth.
- [ ] **Build de tiendas**: EAS Build → Google Play y App Store.

## Reuso con la web

- **Misma base de datos y RLS** → la lógica de permisos ya está validada.
- Los **tipos** y la forma de las queries se replican (`lib/queries.ts` versión RN con supabase-js).
- El **design system** se replica como constantes de tema (no se comparte CSS, pero sí los valores).

## Publicación a las tiendas (cuando esté lista)

- **EAS Build** (servicio de Expo) compila los binarios `.aab` (Android) y `.ipa` (iOS) en la nube,
  sin necesitar una Mac. Se sube a Google Play Console y App Store Connect.
- Requiere cuentas de desarrollador: Google Play (pago único ~US$25) y Apple (US$99/año).
