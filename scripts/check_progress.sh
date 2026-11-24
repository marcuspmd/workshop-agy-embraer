#!/usr/bin/env bash
#
# Verificador de progresso do lab "Primeiros passos com o Antigravity" (edição Embraer).
# Uso: ./scripts/check_progress.sh <1|2|3|4|5|6|7|all>
#
set -uo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
pass_count=0; fail_count=0; warn_count=0

WS="${HOME}/workshop-agy-embraer"
AGENT="${WS}/painel-agent"
FROTA="${WS}/frota-api"
SKILL="${WS}/.agents/skills/my-task"
LOG="${WS}/.audit/log.jsonl"
PROJ="${PROJECT_ID:-${DEVSHELL_PROJECT_ID:-}}"

ok()   { echo -e "  [ ${GREEN}PASS${NC} ] $1"; ((pass_count++)); }
fail() { echo -e "  [ ${RED}FAIL${NC} ] $1"; [ -n "${2:-}" ] && echo -e "         ${YELLOW}↳ Dica: $2${NC}"; ((fail_count++)); }
warn() { echo -e "  [ ${YELLOW}WARN${NC} ] $1"; [ -n "${2:-}" ] && echo -e "         ${YELLOW}↳ Dica: $2${NC}"; ((warn_count++)); }
title() { echo -e "${BOLD}--- $1 ---${NC}"; }
has() { command -v "$1" >/dev/null 2>&1; }

check_task_1() {
    title "Tarefa 1: ambiente, Antigravity CLI e agents-cli"
    if [ -n "${PROJ}" ]; then ok "Projeto ativo: ${PROJ}"; else fail "PROJECT_ID não definido." "Rode o bloco de variáveis da Tarefa 1."; fi
    if [ -d "${SKILL}/scripts" ]; then ok "Repositório do lab em ${WS}."; else fail "Repositório não encontrado em ${WS}." "Clone o repositório do lab (Tarefa 1)."; fi
    if has node && [ "$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)" -ge 20 ]; then ok "Node $(node --version)."; else fail "Node 20+ não encontrado." "O Cloud Shell já vem com Node; abra uma nova aba."; fi
    if has uv; then ok "uv no PATH."; else fail "uv não encontrado." "curl -LsSf https://astral.sh/uv/install.sh | sh"; fi
    if has agy; then ok "Antigravity CLI (agy) no PATH."; else fail "agy não encontrado." "curl -fsSL https://antigravity.google/cli/install.sh | bash"; fi
    if has agents-cli; then ok "agents-cli no PATH."; else fail "agents-cli não encontrado." "uvx google-agents-cli setup"; fi
    if [ -d "${HOME}/.gemini" ]; then ok "Configuração do agy inicializada."; else warn "Configuração do agy não encontrada." "Rode agy e conclua o setup."; fi
    echo ""
}

check_task_2() {
    title "Tarefa 2: regras de workspace, execução segura e painel"
    if (cd "${WS}" && node .agents/skills/my-task/scripts/status.mjs --brief >/dev/null 2>&1); then
        ok "my-task instalada (config, hooks, rules, agentes e auditoria)."
    else
        fail "my-task não instalada por completo." "No agy, na raiz do repositório, rode /my-task init."
    fi
    local rules; rules=$(ls "${WS}/.agents/rules"/my-task-*.md 2>/dev/null | wc -l)
    if [ "${rules}" -ge 3 ]; then ok "${rules} rules da my-task (auditoria, testes e linguagem)."; else fail "Rules da my-task ausentes." "Rode /my-task init e responda Python como linguagem."; fi
    if [ -f "${WS}/.agents/rules/projeto-frota-api.md" ] && [ -f "${WS}/.agents/rules/projeto-painel-agent.md" ]; then ok "Rules dos projetos presentes."; else fail "Rules dos projetos ausentes." "Elas vêm no repositório: confira o git clone."; fi
    if (cd "${WS}" && node .agents/skills/my-task/scripts/config.mjs get commands.test 2>/dev/null | grep -q testes.sh); then ok "Comando de testes do quality gate configurado."; else warn "Comando de testes diferente de ./scripts/testes.sh." "Confira a resposta do quality gate no init."; fi
    if (cd "${WS}" && node .agents/skills/my-task/scripts/config.mjs get telemetry.participant 2>/dev/null | grep -vq '^null$\|^undefined$'); then ok "Telemetria ligada para $(cd "${WS}" && node .agents/skills/my-task/scripts/config.mjs get telemetry.participant)."; else fail "Telemetria não ligada." "Rode conectar-painel.mjs com o seu nome, a URL e o token do telão."; fi
    local n; n=$(bq query --quiet --format=csv --use_legacy_sql=false "SELECT COUNT(*) FROM \`${PROJ}.auditoria_ia.eventos\`" 2>/dev/null | tail -1)
    if [ -n "${n}" ] && [ "${n}" -gt 0 ] 2>/dev/null; then ok "${n} eventos no BigQuery do projeto."; else warn "Nenhum evento no BigQuery ainda." "Espere alguns segundos; veja a fila com status.mjs."; fi
    if [ -f "${LOG}" ] && grep -q '"decision":"deny"' "${LOG}"; then ok "Execução segura testada (há bloqueios registrados)."; else warn "Nenhum bloqueio registrado ainda." "Faça os pedidos de teste da Tarefa 2."; fi
    echo ""
}

check_task_3() {
    title "Tarefa 3: API no projeto frota-api"
    if grep -qs 'REQ-01' "${FROTA}"/.my-task/*/PLAN.md; then ok "Task em frota-api/.my-task/ com requisitos numerados."; else fail "Nenhum PLAN.md com REQ-01 em frota-api/.my-task/." "Rode /my-task com o pedido da Tarefa 3 e aprove o plano."; fi
    if grep -rqs "horas-de-voo\|horas_de_voo" "${FROTA}/app"; then ok "Endpoint de horas de voo no código."; else fail "Endpoint de horas de voo não encontrado em frota-api/app." "Aprove o plano da my-task e aguarde a execução terminar."; fi
    if (cd "${FROTA}" && uv run pytest -q >/dev/null 2>&1); then ok "Testes da frota-api passam."; else fail "Testes da frota-api falham." "Peça ao agy para corrigir o código, nunca os testes."; fi
    if grep -rqs "responsavel_matricula" "${FROTA}/app/routers" "${FROTA}/app/services"; then warn "O código novo cita responsavel_matricula." "Dado pessoal não sai na API (docs/padroes.md)."; else ok "Nenhum dado pessoal exposto pelas camadas de API."; fi
    if [ -f "${LOG}" ] && grep -q '"tool":"invoke_subagent"' "${LOG}"; then ok "Subagentes acionados e registrados."; else warn "Nenhum subagente registrado." "Confira agents.enabled no config."; fi
    echo ""
}

check_task_4() {
    title "Cenário 1: agente Painel com ADK Skills e MCP"
    if grep -qs 'REQ-01' "${AGENT}"/.my-task/*/PLAN.md; then ok "Task em painel-agent/.my-task/ com requisitos numerados."; else fail "Nenhum PLAN.md com REQ-01 em painel-agent/.my-task/." "Rode /my-task com o pedido da Tarefa 4."; fi
    if [ -f "${AGENT}/app/agent.py" ]; then ok "Agente criado em ${AGENT}."; else fail "app/agent.py não encontrado." "Aprove o plano da my-task e aguarde a execução terminar."; fi
    for sk in painel diligencia; do
        if [ -f "${AGENT}/app/skills/${sk}/SKILL.md" ]; then ok "Skill ${sk} dentro do pacote (app/skills/)."; else fail "Skill ${sk} fora do pacote do agente." "As skills precisam estar em painel-agent/app/skills/."; fi
    done
    if grep -rqs "bigquery.googleapis.com/mcp" "${AGENT}/app"; then ok "MCP do BigQuery no agente."; else fail "MCP do BigQuery não encontrado." "Veja docs/referencia-adk.md, seção 3."; fi
    if grep -rqs '"execute_sql"' "${AGENT}/app"; then warn "O agente cita execute_sql." "O tool_filter deve ter só execute_sql_readonly e get_table_info."; else ok "MCP somente leitura."; fi
    if [ -f "${AGENT}/.env" ] && grep -q 'PAINEL_PROJECT=' "${AGENT}/.env"; then ok ".env configurado."; else fail ".env ausente ou sem PAINEL_PROJECT." "Crie o .env da Tarefa 4."; fi
    if [ -d "${AGENT}/tests/unit" ] && (cd "${AGENT}" && uv run pytest tests/unit -q >/dev/null 2>&1); then ok "Testes unitários do agente passam."; else fail "Testes unitários do agente ausentes ou falhando." "Peça ao agy para corrigir o código, nunca os testes."; fi
    echo ""
}

check_task_5() {
    title "Cenário 2: deploy no Agent Runtime"
    local meta="${AGENT}/deployment_metadata.json"
    if [ -f "${meta}" ]; then
        ok "Deploy registrado em deployment_metadata.json."
        local rn; rn=$(grep -o 'projects/[^"]*/reasoningEngines/[0-9]*' "${meta}" | head -1)
        if [ -n "${rn}" ]; then ok "Resource Name: ${rn}"; else warn "Resource Name não encontrado no metadata." "Peça ao agy para mostrar o Resource Name do deploy."; fi
    else
        fail "deployment_metadata.json não encontrado." "Peça o deploy ao agy (Tarefa 5)."
    fi
    echo ""
}

check_task_6() {
    title "Cenário 2: Gemini Enterprise App"
    local pn; pn=$(gcloud projects describe "${PROJ}" --format='value(projectNumber)' 2>/dev/null)
    local sa="service-${pn}@gcp-sa-aiplatform-re.iam.gserviceaccount.com"
    local roles; roles=$(gcloud projects get-iam-policy "${PROJ}" --flatten='bindings[].members' --filter="bindings.members:serviceAccount:${sa}" --format='value(bindings.role)' 2>/dev/null)
    for r in roles/bigquery.dataViewer roles/bigquery.jobUser roles/mcp.toolUser; do
        if echo "${roles}" | grep -q "${r}"; then ok "${r} concedido ao agente."; else fail "${r} não concedido ao agente." "Rode o passo 1 da Tarefa 6."; fi
    done
    warn "A publicação no Gemini Enterprise é conferida no Console: Painel my-task deve aparecer em Agentes com status Enabled."
    echo ""
}

check_task_7() {
    title "Tarefa 7: integridade e revisão humana"
    if (cd "${WS}" && node .agents/skills/my-task/scripts/audit-verify.mjs >/dev/null 2>&1); then ok "Cadeia de auditoria íntegra."; else fail "Cadeia de auditoria quebrada ou ausente." "Rode audit-verify.mjs na raiz do repositório."; fi
    if [ -f "${LOG}" ] && grep -q '"event":"HumanReview"' "${LOG}"; then ok "Revisão humana registrada."; else fail "Revisão humana não registrada." "Rode audit-review.mjs no terminal (Tarefa 7)."; fi
    local pend; pend=$(cd "${WS}" && node .agents/skills/my-task/scripts/status.mjs --json 2>/dev/null | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const t=JSON.parse(d).telemetry;console.log(t.destinations.reduce((a,x)=>a+x.pending,0))}catch{console.log("?")}})')
    if [ "${pend}" = "0" ]; then ok "Todos os eventos enviados ao painel."; else warn "${pend} eventos ainda na fila do painel." "Rode status.mjs; o envio tenta de novo a cada ação."; fi
    echo ""
}

echo -e "${CYAN}${BOLD}================================================================${NC}"
echo -e "${CYAN}${BOLD}   Primeiros passos com o Antigravity: verificador de progresso${NC}"
echo -e "${CYAN}${BOLD}================================================================${NC}\n"

case "${1:-all}" in
    1) check_task_1 ;; 2) check_task_2 ;; 3) check_task_3 ;; 4) check_task_4 ;; 5) check_task_5 ;; 6) check_task_6 ;; 7) check_task_7 ;;
    all|*) check_task_1; check_task_2; check_task_3; check_task_4; check_task_5; check_task_6; check_task_7 ;;
esac

echo -e "${CYAN}${BOLD}================================================================${NC}"
echo -e "${BOLD}Resumo:${NC} ${GREEN}${pass_count} passou${NC} | ${RED}${fail_count} falhou${NC} | ${YELLOW}${warn_count} alertas${NC}"
echo -e "${CYAN}${BOLD}================================================================${NC}"
