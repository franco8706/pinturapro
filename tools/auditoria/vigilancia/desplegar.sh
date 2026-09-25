#!/usr/bin/env bash
#
# Despliega el vigilante en Google Cloud. Se corre UNA vez; después queda andando solo.
#
# Deja tres cosas:
#   1. Un trabajo de Cloud Run con la revisión completa.
#   2. Un horario (Cloud Scheduler) que lo dispara cada 30 minutos.
#   3. Un chequeo de disponibilidad de Cloud Monitoring que mira /api/health cada minuto.
#
# Las alertas se configuran aparte, desde la consola, porque hay que elegir a qué mail van.
# Está explicado paso a paso en docs/vigilancia-google-cloud.md.
set -euo pipefail

PROYECTO="${GOOGLE_CLOUD_PROJECT:?Falta GOOGLE_CLOUD_PROJECT (el id del proyecto de Google Cloud)}"
SITIO="${PINTURAPRO_URL:?Falta PINTURAPRO_URL (la dirección pública del sitio, con https://)}"
REGION="${REGION:-southamerica-east1}"   # São Paulo: lo más cerca de Argentina
REPO="${REPO:-pinturapro}"
IMAGEN="${REGION}-docker.pkg.dev/${PROYECTO}/${REPO}/vigilancia:latest"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "▸ Proyecto: $PROYECTO · Región: $REGION"
echo "▸ Sitio a vigilar: $SITIO"
echo

echo "▸ Habilitando los servicios que hacen falta…"
gcloud services enable \
  run.googleapis.com \
  cloudscheduler.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  monitoring.googleapis.com \
  --project "$PROYECTO"

echo "▸ Repositorio de imágenes…"
gcloud artifacts repositories describe "$REPO" --location "$REGION" --project "$PROYECTO" >/dev/null 2>&1 || \
  gcloud artifacts repositories create "$REPO" \
    --repository-format=docker --location "$REGION" \
    --description="Imágenes de Pintura Pro" --project "$PROYECTO"

echo "▸ Construyendo la imagen del vigilante…"
gcloud builds submit "$AQUI" --tag "$IMAGEN" --project "$PROYECTO"

echo "▸ Trabajo de Cloud Run…"
if gcloud run jobs describe vigilancia --region "$REGION" --project "$PROYECTO" >/dev/null 2>&1; then
  gcloud run jobs update vigilancia \
    --image "$IMAGEN" --region "$REGION" --project "$PROYECTO" \
    --set-env-vars "PINTURAPRO_URL=${SITIO}" \
    --max-retries 1 --task-timeout 3m
else
  gcloud run jobs create vigilancia \
    --image "$IMAGEN" --region "$REGION" --project "$PROYECTO" \
    --set-env-vars "PINTURAPRO_URL=${SITIO}" \
    --max-retries 1 --task-timeout 3m
fi

echo "▸ Horario: cada 30 minutos…"
CUENTA="vigilancia-scheduler@${PROYECTO}.iam.gserviceaccount.com"
gcloud iam service-accounts describe "$CUENTA" --project "$PROYECTO" >/dev/null 2>&1 || \
  gcloud iam service-accounts create vigilancia-scheduler \
    --display-name="Dispara la vigilancia de Pintura Pro" --project "$PROYECTO"

gcloud projects add-iam-policy-binding "$PROYECTO" \
  --member="serviceAccount:${CUENTA}" --role="roles/run.invoker" --condition=None >/dev/null

DISPARADOR="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROYECTO}/jobs/vigilancia:run"
if gcloud scheduler jobs describe vigilancia-cada-30 --location "$REGION" --project "$PROYECTO" >/dev/null 2>&1; then
  gcloud scheduler jobs update http vigilancia-cada-30 --location "$REGION" --project "$PROYECTO" \
    --schedule="*/30 * * * *" --time-zone="America/Argentina/Buenos_Aires" \
    --uri="$DISPARADOR" --http-method=POST \
    --oauth-service-account-email "$CUENTA"
else
  gcloud scheduler jobs create http vigilancia-cada-30 --location "$REGION" --project "$PROYECTO" \
    --schedule="*/30 * * * *" --time-zone="America/Argentina/Buenos_Aires" \
    --uri="$DISPARADOR" --http-method=POST \
    --oauth-service-account-email "$CUENTA"
fi

echo "▸ Chequeo de disponibilidad, cada minuto…"
DOMINIO="$(echo "$SITIO" | sed -E 's#https?://##; s#/.*##')"
cat > /tmp/uptime-pinturapro.json <<JSON
{
  "displayName": "Pintura Pro está en pie",
  "monitoredResource": { "type": "uptime_url", "labels": { "host": "${DOMINIO}", "project_id": "${PROYECTO}" } },
  "httpCheck": { "path": "/api/health", "port": 443, "useSsl": true, "validateSsl": true },
  "period": "60s",
  "timeout": "10s",
  "selectedRegions": ["USA", "SOUTH_AMERICA"]
}
JSON
gcloud monitoring uptime create-config --config-from-file=/tmp/uptime-pinturapro.json --project "$PROYECTO" 2>/dev/null \
  || echo "  (ya existía, o crealo desde la consola: Monitoring → Uptime checks)"

echo
echo "✓ Listo. Probá el vigilante ahora mismo con:"
echo "    gcloud run jobs execute vigilancia --region $REGION --project $PROYECTO --wait"
echo
echo "Falta UNA cosa, que hay que hacer a mano porque requiere elegir a qué mail avisar:"
echo "    docs/vigilancia-google-cloud.md, sección «Que te avise»"
