#!/bin/bash
# Preparação do projeto do aluno: Antigravity CLI, ADK, Agent Runtime, Gemini Enterprise e BigQuery (MCP).
set -e

PROJECT_ID="$1"
REGION="$2"
ZONE="$3"
SA_KEY_FILE="$4"

echo "== Lab my-task + agy: preparando ${PROJECT_ID} (${REGION}/${ZONE}) =="

if [ -n "${SA_KEY_FILE}" ] && [ -f "${SA_KEY_FILE}" ]; then
  gcloud auth activate-service-account --key-file="${SA_KEY_FILE}" || true
fi
[ -n "${PROJECT_ID}" ] && gcloud config set project "${PROJECT_ID}" || true

gcloud services enable \
  serviceusage.googleapis.com \
  cloudresourcemanager.googleapis.com \
  compute.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  aiplatform.googleapis.com \
  cloudaicompanion.googleapis.com \
  businessaicode.googleapis.com \
  discoveryengine.googleapis.com \
  storage.googleapis.com \
  bigquery.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  cloudtrace.googleapis.com || true

# Região e zona padrão no metadata do projeto, lidas pela Tarefa 1 do roteiro.
if [ -n "${REGION}" ] && [ -n "${ZONE}" ]; then
  for i in 1 2 3 4 5; do
    gcloud compute project-info add-metadata \
      --project="${PROJECT_ID}" \
      --metadata="google-compute-default-region=${REGION},google-compute-default-zone=${ZONE}" && break || sleep 3
  done
fi

# Trilha de auditoria da my-task no BigQuery do aluno: o painel (Tarefas 4 a 6) lê daqui pelo MCP do BigQuery.
SCHEMA_FILE="$(mktemp)"
cat > "${SCHEMA_FILE}" << 'SCHEMA'
[
  {"name": "ts", "type": "TIMESTAMP", "mode": "REQUIRED"},
  {"name": "participante", "type": "STRING"}, {"name": "projeto_gcp", "type": "STRING"},
  {"name": "workspace", "type": "STRING"}, {"name": "conversa", "type": "STRING"},
  {"name": "seq", "type": "INTEGER"}, {"name": "evento", "type": "STRING"}, {"name": "ator", "type": "STRING"},
  {"name": "modelo", "type": "STRING"}, {"name": "ferramenta", "type": "STRING"}, {"name": "decisao", "type": "STRING"},
  {"name": "motivo", "type": "STRING"}, {"name": "resultado", "type": "STRING"},
  {"name": "arquivos", "type": "STRING", "mode": "REPEATED"}, {"name": "pedido", "type": "STRING"},
  {"name": "task", "type": "STRING"}, {"name": "detalhe", "type": "STRING"},
  {"name": "hash", "type": "STRING"}, {"name": "prev_hash", "type": "STRING"}, {"name": "recebido_em", "type": "TIMESTAMP"}
]
SCHEMA
bq --project_id="${PROJECT_ID}" --location=US mk --dataset "${PROJECT_ID}:auditoria_ia" || true
bq --project_id="${PROJECT_ID}" mk --table --time_partitioning_field ts "${PROJECT_ID}:auditoria_ia.eventos" "${SCHEMA_FILE}" || true

echo "== Preparação concluída =="
exit 0
