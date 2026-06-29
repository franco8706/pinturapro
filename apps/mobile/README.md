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

- Navegación por tabs: **Pintores · Trabajos · Cuenta**.
- **Pintores**: directorio real desde Supabase + **detalle** (rating, bio, pros/cons, portfolio).
- **Trabajos**: pedidos abiertos del marketplace.
- **Cuenta + Login** (email/contraseña) con sesión persistente.
- Demo: `martin.rojas@pinturapro.demo` / `Demo1234!`.

## Próximas iteraciones

Publicar trabajo y cotizaciones desde la app · cotizar/completar (pintor) · editar perfil ·
contenido (Aprender/Novedades) · OAuth (Google/MS/FB) con deep links · push notifications ·
build a tiendas con **EAS Build**.
