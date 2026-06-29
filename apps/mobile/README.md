# Pintura Pro — App móvil (Expo / React Native)

App nativa Android/iOS sobre el mismo Supabase que la web. Ver `docs/mobile-plan.md`.

## Correr en tu teléfono (Expo Go)

```bash
cd apps/mobile
cp .env.example .env          # completá EXPO_PUBLIC_SUPABASE_ANON_KEY
npm install
npx expo install --fix        # alinea versiones con el SDK instalado
npx expo start                # escaneá el QR con la app "Expo Go"
```

- **Expo Go**: instalala desde Play Store / App Store en tu teléfono.
- Tu teléfono y la PC deben estar en la **misma red**. Si no, corré `npx expo start --tunnel`.

## Variables de entorno

`.env` (no se commitea):

```
EXPO_PUBLIC_SUPABASE_URL=https://ojdtixmysrfywgvowqie.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<tu anon key, la misma de la web>
```

La anon key es **pública** y segura para el cliente (la seguridad la dan las RLS de Supabase).

## Qué hay hecho

- Navegación por tabs: **Pintores · Trabajos · Aprender · Cuenta**.
- **Pintores**: directorio real desde Supabase + **detalle** (rating, bio, pros/cons, portfolio).
- **Trabajos** (marketplace): pedidos abiertos. El **cliente** publica un trabajo; el **pintor** cotiza desde cada tarjeta.
- **Cuenta** = panel por rol:
  - **Cliente**: ve cotizaciones recibidas, **acepta** una y, al completarse, **deja reseña**.
  - **Pintor/Empresa**: ve sus trabajos, **marca completado** y **edita su perfil** (bio, zona, especialidades, pros/cons).
- **Aprender**: contenido dinámico desde Supabase — guías, videos, cursos, asesoramiento, preguntas antes de pedir presupuesto y novedades.
- **Login** (email/contraseña) con sesión persistente.
- Demo: `martin.rojas@pinturapro.demo` / `Demo1234!`.

Toda la escritura pasa por las **mismas RLS** que la web (un usuario solo puede tocar lo suyo).

## Build a tiendas (EAS Build)

```bash
npm install -g eas-cli
eas login
# Cargá la anon key como secret (no se commitea):
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<tu anon key>"
eas build --profile preview --platform android   # APK para probar
eas build --profile production --platform all     # builds de tienda
eas submit --profile production --platform android # subir a Google Play / App Store
```

## Próximas iteraciones

OAuth (Google/MS/FB) con deep links (`expo-auth-session`) · push notifications (`expo-notifications`) ·
subir fotos al portfolio desde la app (`expo-image-picker`) · fuentes de marca (Space Grotesk/Inter).
