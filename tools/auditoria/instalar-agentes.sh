#!/usr/bin/env bash
# Hace que los agentes de Pintura Pro se puedan llamar por nombre desde CUALQUIER sesión de
# este Codespace, no sólo desde las que se abren adentro de `pinturapro/`.
#
# Por qué hace falta: Claude Code busca agentes en `.claude/agents/` de la carpeta donde se
# abre la sesión y subiendo hacia la raíz — nunca hacia abajo. Las sesiones de este Codespace
# se abren en `/workspaces/codespaces-blank`, un nivel ARRIBA del proyecto, así que los
# agentes de `pinturapro/.claude/agents/` no aparecían: había que explicarle a cada sesión
# dónde estaban, que es justo el gasto de tokens que el sistema existe para evitar.
# Documentado en https://code.claude.com/docs/en/sub-agents.md.
#
# Qué hace: crea `/workspaces/codespaces-blank/.claude/agents` como un ENLACE a la carpeta
# real. Una sola fuente: un agente nuevo que se agregue al proyecto aparece solo en las dos.
# Enlace de carpeta y no de archivos a propósito: adentro quedan archivos comunes, que es lo
# que cualquier lector de carpetas espera encontrar.
#
# Se corre una vez por Codespace (vive fuera del repo, así que un Codespace nuevo lo necesita
# de nuevo). La primera vez hay que abrir una sesión nueva para que los agentes aparezcan;
# después, los cambios a los agentes se toman solos.
set -euo pipefail

PROYECTO="$(cd "$(dirname "$0")/../.." && pwd)"
RAIZ="$(dirname "$PROYECTO")"
DESTINO="$RAIZ/.claude/agents"

mkdir -p "$RAIZ/.claude"
if [ -L "$DESTINO" ]; then
  echo "ya estaba: $DESTINO -> $(readlink "$DESTINO")"
elif [ -e "$DESTINO" ]; then
  echo "ATENCIÓN: $DESTINO existe y no es un enlace. No lo toco: revisalo a mano." >&2
  exit 1
else
  ln -s "../$(basename "$PROYECTO")/.claude/agents" "$DESTINO"
  echo "listo: $DESTINO -> $(readlink "$DESTINO")"
fi
echo "agentes visibles desde $RAIZ: $(ls "$DESTINO"/*.md | wc -l)"
