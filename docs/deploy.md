# Publicar Pintura Pro

Los pasos para pasar de "anda en el Codespace" a "anda en internet", **en orden**. Varios
dependen del anterior: si salteás uno, el siguiente falla de una forma que no siempre es obvia.

---

## 0. Antes de tocar nada: qué NO puede salir así

Estas tres cosas no son detalles técnicos, y ninguna se arregla desde el código.

### La base está llena de datos inventados

Hoy **el 100% de lo que se ve es demo**: los 3 pintores, las 20 reseñas de 5 estrellas y las
3 obras del portfolio pertenecen a cuentas `*@pinturapro.demo`, y las fotos son de stock de
Unsplash presentadas como obra propia.

Publicar eso significa mostrar pintores que no existen y reseñas que nadie escribió. Además de
ser un problema de credibilidad el día que alguien lo note, las reseñas fabricadas son
publicidad engañosa (Ley 24.240).

**Antes de abrir al público hay que decidir una de dos:**

- **Empezar vacío.** Borrar los datos demo y arrancar con el directorio en cero. Los estados
  vacíos ya están escritos y explican qué hacer.
- **Empezar con pintores reales.** Cargar profesionales que existan y hayan dado su
  consentimiento, sin reseñas hasta que haya trabajos de verdad.

Para borrar los datos demo:

```sql
-- Ver primero qué se lleva puesto:
select count(*) from public.profiles p
  join auth.users u on u.id = p.id where u.email like '%@pinturapro.demo';

-- Borrar (cascadea a projects, jobs y reviews):
delete from auth.users where email like '%@pinturapro.demo';
```

### El equipo de /nosotros no es real

La página presenta a "Martín Rojas, Fundador · Maestro pintor" y dos personas más. Son los
mismos nombres que los pintores demo. Hay que reemplazarlos por el equipo real o sacar
la sección.

### "Verificado" tiene que significar algo

El distintivo existe en la base (`profiles.verified`) pero **ninguna parte del código lo
escribe**: sólo se puede activar a mano por SQL. Está bien que sea manual, pero antes de
publicar hay que definir qué se chequea (matrícula, seguro, antecedentes, entrevista) y
dejarlo escrito. Si no se va a verificar a nadie, no marcar a nadie.

---

## 1. Supabase

La base ya está creada y migrada (proyecto `ojdtixmysrfywgvowqie`). Falta:

1. **Sacarla del plan free.** Un proyecto free se **pausa solo a los 7 días sin actividad** y
   el sitio se cae entero. Ya pasó una vez. Un sitio en producción va en plan Pro.
2. **Backups.** Verificar que estén activos y probar una restauración antes de necesitarla.
3. **Auth → URL Configuration:**
   - `Site URL` = el dominio final (ej. `https://pinturapro.com.ar`)
   - `Redirect URLs` += `https://pinturapro.com.ar/auth/callback`

Si el proyecto se recrea desde cero, correr `supabase/setup-completo.sql` en el SQL Editor:
son las 13 migraciones en un archivo, re-ejecutable sin romper nada.

## 2. Vercel

Ya hay un `vercel.json` en la raíz con el build del monorepo resuelto.

1. Importar el repo desde GitHub.
2. **Root Directory: dejar la raíz** (el `vercel.json` ya apunta a `apps/web`).
3. Cargar las variables de entorno (siguiente paso) **antes del primer build**.
4. Deploy.

> **Plan:** el simulador con IA puede tardar hasta 60s. En Hobby el techo es 60s y el body de
> un request es 4.5MB. Si el simulador se va a usar en serio, va plan Pro.

## 3. Variables de entorno

Están todas documentadas en `apps/web/.env.example`. Las cuatro obligatorias:

| Variable | Si falta |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **El sitio sirve datos inventados con HTTP 200.** Parece andar. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Nadie puede iniciar sesión. |
| `SUPABASE_SERVICE_ROLE_KEY` | Se rompen las subidas de fotos y no salen los emails. |
| `NEXT_PUBLIC_SITE_URL` | `robots.txt` y `sitemap.xml` apuntan a localhost; los emails salen sin botón. |

⚠️ Las `NEXT_PUBLIC_` **se congelan en el build**. Si las cargás después, hay que volver a
buildear: no alcanza con reiniciar.

⚠️ `REPLICATE_POINTS_PER_SIDE`: si no la seteás, el default del código es 32 y **cada análisis
cuesta el doble**. El `.env.example` sugiere 16.

## 4. OAuth (Google, Microsoft, Facebook)

La callback de cada proveedor apunta a Supabase, no al dominio, así que **no cambia**. Lo que
sí hay que hacer:

- **Facebook**: pasar la app a modo **Live**. Requiere URL de política de privacidad — ya está
  publicada en `/privacidad`. Sin esto sólo entran los testers.
- **Google**: publicar el consent screen y agregar el dominio a los autorizados.
- **Microsoft**: verificación de editor pendiente.

Detalle en `docs/auth-oauth.md`.

## 5. Costos: poner límites ANTES de abrir

**Replicate cobra por uso.** El endpoint `/api/segment` exige sesión y limita a 12 análisis por
hora y usuario, pero ese contador vive en memoria del proceso: en serverless el límite real es
`12 × instancias`, no hay tope por IP, y crear una cuenta es gratis.

1. **Poner un spend limit en el panel de Replicate.** Es un clic y es la única red de contención
   real hoy.
2. Cuando haya tráfico, mover la cuota a Upstash Redis y contar también por IP.

## 6. Monitoreo

Hoy **no hay ninguno**: si el sitio se cae a las 3 de la mañana, nadie se entera. Los
`console.error` van a los logs de Vercel, que no alertan y en Hobby se retienen una hora.

Mínimo indispensable:

1. **Uptime check** sobre `/api/health` (UptimeRobot o BetterStack, gratis). Ese endpoint ya
   consulta la base de verdad y devuelve 503 si no responde.
2. **Sentry** para ver los errores de servidor con su traza.

## 7. Después de desplegar, verificar en este orden

```bash
curl -s https://TU-DOMINIO/api/health          # debe decir ok, no 503
curl -s https://TU-DOMINIO/robots.txt          # el host NO puede decir localhost
curl -s https://TU-DOMINIO/sitemap.xml | head  # las URLs tampoco
```

Y a mano, en el navegador:

- `/pintores` muestra los pintores **reales** (si muestra los de siempre con la base vacía,
  faltan las variables de Supabase y estás viendo los mocks).
- Crear una cuenta, iniciar sesión, cerrar sesión.
- Entrar con Google.
- Publicar un pedido, cotizarlo desde otra cuenta, aceptarlo. Verificar que aparezca el
  teléfono de la contraparte.
- `/admin` y `/panel` con una cuenta que **no** sea admin: tienen que rebotar a `/mi-panel`.

## 8. Lo que queda pendiente y conviene saber

- **No hay tests automatizados.** Ningún cambio futuro tiene red de contención.
- **La comisión se calcula y se guarda, pero no se cobra.** No hay pasarela de pago: el dinero
  se mueve directamente entre cliente y pintor, y así lo dicen los términos.
- **La app móvil no está lista para las tiendas.** Le faltan los íconos y el splash: sin eso el
  build sale con el ícono de Expo y la tienda lo rechaza.
- **`profiles.type` no se congela durante el onboarding.** Una cuenta recién creada por OAuth
  podría cambiarse el rol antes de completar el alta. Hoy no da acceso a nada (los privilegios
  cuelgan de `is_admin`, que sí está congelado), pero conviene cerrarlo.
