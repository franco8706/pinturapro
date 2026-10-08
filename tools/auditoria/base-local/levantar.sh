#!/usr/bin/env bash
# Una copia LOCAL de Supabase (base, autenticación, API y almacenamiento) con las migraciones
# del repo y los datos demo, para probar una migración nueva —y la web contra ella— sin tocar
# la base en vivo.
#
# Para qué: aplicar una migración a la base en vivo lo autoriza el dueño, y probarla adentro de
# una transacción en vivo necesita su contraseña. Acá no hace falta ninguna de las dos cosas:
# se prueba todo, se ven fallar las pruebas nuevas contra el estado anterior, y al dueño se le
# lleva la migración ya verificada (6/10/2026, la 0027 de la suscripción).
#
# Uso:
#   bash tools/auditoria/base-local/levantar.sh            # hasta la última migración
#   bash tools/auditoria/base-local/levantar.sh 0026       # hasta la 0026 (para ver fallar lo nuevo)
#
# Deja en tools/auditoria/.salida/base-local/web.env las variables para correr la web contra
# esta base (ver tools/auditoria/base-local/LEEME.md). Las claves son las de desarrollo que
# Supabase usa en TODAS las instalaciones locales: no son secretos de nadie.
set -uo pipefail
PROYECTO="$(cd "$(dirname "$0")/../../.." && pwd)"
TRABAJO="$PROYECTO/tools/auditoria/.salida/base-local"
HASTA="${1:-9999}"
CLI="npx -y supabase@2.119.0"
mkdir -p "$TRABAJO"
cd "$TRABAJO"

# Un proyecto de Supabase aparte, SIN migraciones propias: las del repo se aplican a mano, en
# orden, para poder parar en la que se quiera. `supabase init` dentro del repo agregaría un
# config.toml a supabase/ que nadie pidió.
[ -f supabase/config.toml ] || $CLI init >/dev/null 2>&1 <<< "n"

if ! docker ps --format '{{.Names}}' | grep -q '^supabase_db_base-local$'; then
  echo "levantando Supabase local (la primera vez baja ~2 GB de imágenes)..."
  $CLI start -x realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor > start.log 2>&1 \
    || { echo "FALLO: no levantó"; tail -20 start.log; exit 1; }
fi

$CLI status -o env > status.env 2>/dev/null || { echo "FALLO: supabase status"; exit 1; }
# shellcheck disable=SC1091
source status.env
DB="$DB_URL"

echo "base en blanco..."
$CLI db reset --local > reset.log 2>&1 || { echo "FALLO: db reset"; tail -20 reset.log; exit 1; }

echo "migraciones hasta $HASTA:"
for f in $(ls "$PROYECTO"/supabase/migrations/0*.sql | sort); do
  n=$(basename "$f" | cut -c1-4)
  [ "$n" \> "$HASTA" ] && break
  if psql "$DB" -v ON_ERROR_STOP=1 -q -f "$f" > /dev/null 2> migracion.err; then
    echo "  ✓ $(basename "$f")"
  else
    echo "  ✗ $(basename "$f")"; grep -E 'ERROR' migracion.err | head -5; exit 1
  fi
done

echo "buckets de fotos..."
for b in projects avatars; do
  curl -s -o /dev/null -X POST "$API_URL/storage/v1/bucket" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H "apikey: $SERVICE_ROLE_KEY" -H "Content-Type: application/json" \
    -d "{\"id\":\"$b\",\"name\":\"$b\",\"public\":true}"
done

echo "datos demo..."
SUPABASE_URL="$API_URL" SUPABASE_SECRET="$SERVICE_ROLE_KEY" python3 "$PROYECTO/scripts/seed_supabase.py" > semilla.log 2>&1 \
  || { echo "FALLO: semilla"; tail -20 semilla.log; exit 1; }
# La actividad del marketplace (pedidos abiertos, cotizaciones, un trabajo en curso y uno
# terminado sin reseñar), como en la base en vivo: varias pruebas la necesitan.
( cd "$PROYECTO/apps/web" && NEXT_PUBLIC_SUPABASE_URL="$API_URL" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
    node scripts/seed-marketplace-activity.mjs ) > actividad.log 2>&1 \
  || { echo "FALLO: actividad del marketplace"; tail -20 actividad.log; exit 1; }
# El admin de la demo (en vivo se marcó a mano).
psql "$DB" -q -c "update public.profiles set is_admin = true where id = (select id from auth.users where email = 'empresa@pinturapro.demo');" 2>/dev/null

cat > web.env <<EOF
NEXT_PUBLIC_SUPABASE_URL=$API_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
NEXT_PUBLIC_SITE_URL=http://localhost:3000
# La tarea del dólar (etapa 2 de la suscripción): un token de prueba, y las dos fuentes
# apuntadas al servidor que levanta la prueba \`cotizacion-dolar\` (no se depende del dólar real).
COTIZACION_TOKEN=prueba-local-cotizacion
COTIZACION_FUENTE_URL=http://127.0.0.1:54399/bna
COTIZACION_CONTROL_URL=http://127.0.0.1:54399/bcra
EOF
echo "LISTA · base local $DB · API $API_URL · variables para la web en $TRABAJO/web.env"
