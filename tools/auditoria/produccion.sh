#!/usr/bin/env bash
# Compila Pintura Pro en modo producción en una copia aparte y la sirve en :3100.
#
# Para qué: medir en desarrollo engaña (REGLAS §5), y `next build` es la primera puerta para
# publicar. Aparte a propósito: compilar en la carpeta real pisa el `.next` del servidor de
# desarrollo que están usando los agentes.
#
# Vive en el repo y no en /tmp porque /tmp se borra con cada reinicio del Codespace — ya se
# perdieron así el kit de auditoría (dos veces) y la primera versión de este script.
#
# Uso: bash tools/auditoria/produccion.sh        (tarda ~1 minuto)
set -uo pipefail
PROYECTO="$(cd "$(dirname "$0")/../.." && pwd)"
COPIA="${TMPDIR:-/tmp}/pinturapro-produccion"
LOGS="$COPIA-logs"
PUERTO="${PUERTO:-3100}"
mkdir -p "$LOGS"

# Se libera el PUERTO, no se buscan procesos por nombre: Next se renombra a "next-server" y
# `pkill -f "next start"` no lo encontraba. Pasó el 28/9: el servidor viejo siguió vivo con
# su carpeta ya borrada —la página salía de memoria, pero cada archivo JS/CSS daba 400—, el
# nuevo no pudo tomar el puerto (EADDRINUSE), y este script dijo "PRODUCCIÓN LISTA" porque la
# página respondía 200. El agente `simulador-color` midió un sitio muerto durante 10 minutos.
liberar_puerto() {
  for pid in $(ss -ltnp 2>/dev/null | grep ":$PUERTO " | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u); do
    kill "$pid" 2>/dev/null
  done
  for i in $(seq 1 10); do ss -ltn | grep -q ":$PUERTO " || return 0; sleep 1; done
  echo "FALLO: el puerto $PUERTO sigue ocupado"; exit 1
}
liberar_puerto
cd "$PROYECTO"
git worktree remove --force "$COPIA" 2>/dev/null; rm -rf "$COPIA"; git worktree prune
git worktree add --detach "$COPIA" HEAD >/dev/null 2>&1 || { echo "FALLO: no se pudo crear la copia"; exit 1; }
cp apps/web/.env.local "$COPIA/apps/web/.env.local"
cd "$COPIA"
t0=$(date +%s)
pnpm install --frozen-lockfile --prefer-offline > "$LOGS/install.log" 2>&1 || { echo "FALLO install"; tail -20 "$LOGS/install.log"; exit 1; }
t1=$(date +%s)
pnpm --filter @pinturapro/web build > "$LOGS/build.log" 2>&1; rc=$?
t2=$(date +%s)
echo "commit $(git rev-parse --short HEAD) · install $((t1-t0))s · build $((t2-t1))s · salida $rc"
if [ $rc -ne 0 ]; then echo "FALLO build"; tail -40 "$LOGS/build.log"; exit 1; fi
echo "rutas: $(grep -cE '^[├└┌] ' "$LOGS/build.log") · avisos en la compilación:"
grep -iE "warn|error|no se pudieron" "$LOGS/build.log" | grep -v "Compiled with warnings" | head -10 || true
# El mismo servidor que corre en Cloud Run (`output: "standalone"`, ver apps/web/Dockerfile),
# no `next start`: lo que se mide acá tiene que ser lo que va a correr en la nube. Como en la
# imagen, los estáticos y /public se copian a mano junto al servidor.
cd apps/web
cp -r .next/static .next/standalone/apps/web/.next/static
cp -r public .next/standalone/apps/web/public 2>/dev/null || true
cp .env.local .next/standalone/apps/web/.env.local
# La redirección va sobre el GRUPO entero y con `exec`: en `(cd … && node … > log &)` el `&`
# manda al fondo toda la cadena y la redirección sólo cubre a node, así que el shell que
# corre la cadena se quedaba con la salida del script abierta mientras el servidor viviera.
# El script terminaba su trabajo y nunca "terminaba": se colgó dos veces así.
( cd .next/standalone/apps/web && PORT="$PUERTO" HOSTNAME=0.0.0.0 exec node server.js ) > "$LOGS/start.log" 2>&1 < /dev/null &
disown
# "Lista" es que la página responda Y que sus archivos carguen: una página 200 con todo su
# JavaScript en 400 es un sitio muerto para quien lo abre.
for i in $(seq 1 30); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://localhost:$PUERTO/")" = "200" ]; then
    js=$(curl -s "http://localhost:$PUERTO/" | grep -oE '/_next/static/[^"]+\.js' | head -1)
    tipo=$(curl -s -o /dev/null -w '%{http_code} %{content_type}' "http://localhost:$PUERTO$js")
    case "$tipo" in
      "200 application/javascript"*) echo "PRODUCCIÓN LISTA en :$PUERTO (página y archivos)"; exit 0 ;;
      *) echo "FALLO: la página responde pero su JavaScript no ($js -> $tipo)"; tail -5 "$LOGS/start.log"; exit 1 ;;
    esac
  fi
  sleep 2
done
echo "FALLO start"; tail -20 "$LOGS/start.log"; exit 1
