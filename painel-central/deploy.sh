#!/bin/bash
# Prepara o projeto CENTRAL do apresentador: dataset do painel, hub no Cloud Run e o token.
# Uso: PROJECT_ID=<projeto-central> ./painel-central/deploy.sh   (rode da raiz do repositório)
# Uma instância só (min = max = 1): a sala ao vivo guarda o estado da turma em memória
# e o reconstrói do BigQuery quando o serviço reinicia.
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project)}"
REGION="${REGION:-us-central1}"
DATASET="auditoria_ia"
TABELA="eventos"
TOKEN="${PAINEL_TOKEN:-$(openssl rand -hex 12)}"
VIEW_TOKEN="${PAINEL_VIEW_TOKEN:-$(openssl rand -hex 12)}"
SA="painel-hub@${PROJECT_ID}.iam.gserviceaccount.com"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "== Painel central em ${PROJECT_ID} (${REGION}) =="
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  bigquery.googleapis.com logging.googleapis.com --project "${PROJECT_ID}"

bq --project_id="${PROJECT_ID}" --location=US mk --dataset "${PROJECT_ID}:${DATASET}" 2>/dev/null || echo "dataset já existe"
bq --project_id="${PROJECT_ID}" mk --table --time_partitioning_field ts \
  --description "Eventos da my-task de todos os participantes" \
  "${PROJECT_ID}:${DATASET}.${TABELA}" "${DIR}/schema.json" 2>/dev/null || {
    echo "tabela já existe: atualizando as colunas"
    bq --project_id="${PROJECT_ID}" update "${PROJECT_ID}:${DATASET}.${TABELA}" "${DIR}/schema.json" >/dev/null
  }

gcloud iam service-accounts describe "${SA}" --project "${PROJECT_ID}" >/dev/null 2>&1 || \
  gcloud iam service-accounts create painel-hub --display-name "Hub do painel my-task" --project "${PROJECT_ID}"
for ROLE in roles/bigquery.dataEditor roles/bigquery.jobUser; do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" --member "serviceAccount:${SA}" \
    --role "${ROLE}" --condition=None >/dev/null
done

gcloud run deploy painel-hub --source "${DIR}/hub" --region "${REGION}" --project "${PROJECT_ID}" \
  --service-account "${SA}" --allow-unauthenticated \
  --min-instances 1 --max-instances 1 --concurrency 250 --timeout 3600 \
  --set-env-vars "PAINEL_TOKEN=${TOKEN},PAINEL_VIEW_TOKEN=${VIEW_TOKEN},PAINEL_TABELA=${PROJECT_ID}.${DATASET}.${TABELA}"

URL="$(gcloud run services describe painel-hub --region "${REGION}" --project "${PROJECT_ID}" --format 'value(status.url)')"
curl -fsS "${URL}/saude" && echo
echo
echo "== Pronto. Passe para a turma (Tarefa 2 do roteiro): =="
echo "   URL:   ${URL}"
echo "   TOKEN: ${TOKEN}"
echo
echo "== Sala ao vivo (só para o telão, NÃO passe para a turma): =="
echo "   ${URL}/sala?k=${VIEW_TOKEN}"
echo
echo "Ao vivo no telão: Logs Explorer de ${PROJECT_ID}, filtro jsonPayload.tipo=\"my-task\", com Stream logs ligado."
