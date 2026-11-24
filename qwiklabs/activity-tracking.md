# Verificar meu progresso (activity tracking do Qwiklabs)

O `check_progress.sh` confere o Cloud Shell do aluno, que o Qwiklabs não enxerga. Estas verificações rodam no Qwiklabs, com a conta de serviço do `project_0`, e conferem só o que fica no projeto GCP: a trilha da my-task no BigQuery (`auditoria_ia.eventos`), o agente no Agent Runtime e as permissões do IAM.

## Como cadastrar

1. No editor do lab, abra **Activity Tracking** e crie 6 passos, na ordem da tabela.
2. Em cada passo, cole o código Ruby da seção correspondente e dê os pontos sugeridos.
3. O número do passo precisa bater com o `<ql-activity-tracking step=N>` do `lab_instructions.md`.
4. Antes de publicar, rode um lab de teste até o fim e use o **Test** de cada passo. ⚠️ Confira no editor a forma de abrir os clientes do Google a partir do `handles[:project_0]` (aqui: `connect(Google::Apis::...Service)`): se o seu ambiente usar outra assinatura, ajuste só a linha do `connect` de cada passo.

| Passo | Tarefa do roteiro | O que confere | Pontos |
|---|---|---|---|
| 1 | Tarefa 2 | `AuditInstalled` e pelo menos um bloqueio (`decisao = 'deny'`) na trilha | 15 |
| 2 | Tarefa 3 | Task da `frota-api`: `PLAN.md` em `frota-api/.my-task/`, código em `frota-api/app/` e o `my-task-verifier` acionado | 20 |
| 3 | Tarefa 4 | Task do `painel-agent`: `PLAN.md` em `painel-agent/.my-task/` e o `my-task-verifier` acionado | 20 |
| 4 | Tarefa 5 | Um agente (reasoning engine) no Agent Runtime | 15 |
| 5 | Tarefa 6 | `bigquery.dataViewer`, `bigquery.jobUser` e `mcp.toolUser` para a conta do Agent Runtime | 15 |
| 6 | Tarefa 7 | `HumanReview` na trilha | 15 |

A trilha só chega ao BigQuery depois que o aluno liga a telemetria (`conectar-painel.mjs`, Tarefa 2) e o envio leva alguns segundos. Por isso as mensagens para o aluno sugerem esperar e tentar de novo.

---

## Passo 1 — Tarefa 2: my-task instalada e execução segura testada

```ruby
def check_tarefa_2(handles:, maximum_score:, resources:)
  project_id = handles[:project_0].project_id
  bq = handles[:project_0].connect(Google::Apis::BigqueryV2::BigqueryService)
  sql = <<~SQL
    SELECT
      COUNTIF(evento = 'AuditInstalled') AS instalada,
      COUNTIF(evento = 'PreToolUse' AND decisao = 'deny') AS bloqueios
    FROM `#{project_id}.auditoria_ia.eventos`
  SQL
  req = Google::Apis::BigqueryV2::QueryRequest.new(query: sql, use_legacy_sql: false, location: 'US', timeout_ms: 30_000)
  row = bq.query_job(project_id, req).rows&.first
  instalada = row ? row.f[0].v.to_i : 0
  bloqueios = row ? row.f[1].v.to_i : 0

  if instalada.zero?
    return { score: 0, message: 'Sem AuditInstalled na trilha.',
             student_message: 'Ainda não há eventos da instalação no BigQuery. Confira se você rodou o /my-task init e o conectar-painel.mjs, espere alguns segundos e tente de novo.' }
  end
  if bloqueios.zero?
    return { score: 0, message: 'Sem bloqueios na trilha.',
             student_message: 'A my-task está instalada, mas nenhum bloqueio chegou ao BigQuery. Faça os três pedidos de teste da Tarefa 2 e tente de novo.' }
  end
  { score: maximum_score, message: 'OK', student_message: "my-task instalada e #{bloqueios} ação(ões) bloqueada(s) pelos hooks." }
rescue StandardError => e
  { score: 0, message: "Erro: #{e.message}", student_message: 'Não foi possível ler auditoria_ia.eventos. Confira se a telemetria foi ligada (Tarefa 2) e tente de novo.' }
end
```

## Passo 2 — Tarefa 3: endpoint da frota-api com a my-task

```ruby
def check_tarefa_3(handles:, maximum_score:, resources:)
  project_id = handles[:project_0].project_id
  bq = handles[:project_0].connect(Google::Apis::BigqueryV2::BigqueryService)
  sql = <<~SQL
    SELECT
      COUNTIF(EXISTS(SELECT 1 FROM UNNEST(arquivos) a WHERE a LIKE 'frota-api/.my-task/%/PLAN.md')) AS plano,
      COUNTIF(EXISTS(SELECT 1 FROM UNNEST(arquivos) a WHERE a LIKE 'frota-api/app/%')) AS codigo,
      COUNTIF(ferramenta = 'invoke_subagent' AND decisao = 'allow' AND detalhe LIKE '%my-task-verifier%') AS verificador
    FROM `#{project_id}.auditoria_ia.eventos`
  SQL
  req = Google::Apis::BigqueryV2::QueryRequest.new(query: sql, use_legacy_sql: false, location: 'US', timeout_ms: 30_000)
  row = bq.query_job(project_id, req).rows&.first
  plano, codigo, verificador = row ? row.f.map { |c| c.v.to_i } : [0, 0, 0]

  faltando = []
  faltando << 'o plano em frota-api/.my-task/' if plano.zero?
  faltando << 'o código em frota-api/app/' if codigo.zero?
  faltando << 'o my-task-verifier' if verificador.zero?
  unless faltando.empty?
    return { score: 0, message: "Faltando: #{faltando.join(', ')}",
             student_message: "Ainda não aparece na trilha: #{faltando.join(', ')}. Aprove o plano da Tarefa 3, espere a execução terminar e tente de novo." }
  end
  { score: maximum_score, message: 'OK', student_message: 'Plano, código e verificador independente registrados na trilha.' }
rescue StandardError => e
  { score: 0, message: "Erro: #{e.message}", student_message: 'Não foi possível ler auditoria_ia.eventos. Tente de novo em alguns segundos.' }
end
```

## Passo 3 — Tarefa 4: agente Painel com a my-task

```ruby
def check_tarefa_4(handles:, maximum_score:, resources:)
  project_id = handles[:project_0].project_id
  bq = handles[:project_0].connect(Google::Apis::BigqueryV2::BigqueryService)
  sql = <<~SQL
    SELECT
      COUNTIF(EXISTS(SELECT 1 FROM UNNEST(arquivos) a WHERE a LIKE 'painel-agent/.my-task/%/PLAN.md')) AS plano,
      COUNTIF(ferramenta = 'invoke_subagent' AND decisao = 'allow' AND detalhe LIKE '%my-task-verifier%'
              AND task LIKE 'painel-agent:%') AS verificador
    FROM `#{project_id}.auditoria_ia.eventos`
  SQL
  req = Google::Apis::BigqueryV2::QueryRequest.new(query: sql, use_legacy_sql: false, location: 'US', timeout_ms: 30_000)
  row = bq.query_job(project_id, req).rows&.first
  plano, verificador = row ? row.f.map { |c| c.v.to_i } : [0, 0]

  if plano.zero?
    return { score: 0, message: 'Sem PLAN.md do painel-agent.',
             student_message: 'O plano do painel-agent ainda não aparece na trilha. Rode o /my-task da Tarefa 4 e aprove o plano.' }
  end
  if verificador.zero?
    return { score: 0, message: 'Verificador não acionado no painel-agent.',
             student_message: 'O plano existe, mas o my-task-verifier ainda não rodou na task do painel-agent. Espere a execução terminar e tente de novo.' }
  end
  { score: maximum_score, message: 'OK', student_message: 'Agente Painel planejado, construído e verificado com a my-task.' }
rescue StandardError => e
  { score: 0, message: "Erro: #{e.message}", student_message: 'Não foi possível ler auditoria_ia.eventos. Tente de novo em alguns segundos.' }
end
```

## Passo 4 — Tarefa 5: deploy no Agent Runtime

A região vem do metadata do projeto (gravado pelo `scripts/script.sh` do terraform), com `us-central1` como reserva.

```ruby
def check_tarefa_5(handles:, maximum_score:, resources:)
  project_id = handles[:project_0].project_id
  compute = handles[:project_0].connect(Google::Apis::ComputeV1::ComputeService)
  meta = compute.get_project(project_id).common_instance_metadata&.items || []
  region = meta.find { |i| i.key == 'google-compute-default-region' }&.value || 'us-central1'

  ai = handles[:project_0].connect(Google::Apis::AiplatformV1::AiplatformService)
  ai.root_url = "https://#{region}-aiplatform.googleapis.com/"
  engines = ai.list_project_location_reasoning_engines("projects/#{project_id}/locations/#{region}").reasoning_engines || []

  if engines.empty?
    return { score: 0, message: "Nenhum reasoning engine em #{region}.",
             student_message: "Nenhum agente encontrado no Agent Runtime (#{region}). Peça o deploy ao agy (Tarefa 5) e espere terminar." }
  end
  { score: maximum_score, message: 'OK', student_message: "Agente no Agent Runtime: #{engines.first.display_name || engines.first.name}." }
rescue StandardError => e
  { score: 0, message: "Erro: #{e.message}", student_message: 'Não foi possível consultar o Agent Runtime. Tente de novo em alguns segundos.' }
end
```

## Passo 5 — Tarefa 6: permissões do agente

```ruby
def check_tarefa_6(handles:, maximum_score:, resources:)
  project_id = handles[:project_0].project_id
  crm = handles[:project_0].connect(Google::Apis::CloudresourcemanagerV1::CloudResourceManagerService)
  number = crm.get_project(project_id).project_number
  member = "serviceAccount:service-#{number}@gcp-sa-aiplatform-re.iam.gserviceaccount.com"
  policy = crm.get_project_iam_policy(project_id, Google::Apis::CloudresourcemanagerV1::GetIamPolicyRequest.new)

  wanted = %w[roles/bigquery.dataViewer roles/bigquery.jobUser roles/mcp.toolUser]
  missing = wanted.reject { |role| policy.bindings.any? { |b| b.role == role && b.members.include?(member) } }
  unless missing.empty?
    return { score: 0, message: "Faltando: #{missing.join(', ')}",
             student_message: "A conta do Agent Runtime ainda não tem: #{missing.join(', ')}. Rode o passo 1 da Tarefa 6." }
  end
  { score: maximum_score, message: 'OK', student_message: 'O agente pode ler a trilha no BigQuery pelo MCP.' }
rescue StandardError => e
  { score: 0, message: "Erro: #{e.message}", student_message: 'Não foi possível ler as permissões do projeto. Tente de novo em alguns segundos.' }
end
```

## Passo 6 — Tarefa 7: revisão humana registrada

```ruby
def check_tarefa_7(handles:, maximum_score:, resources:)
  project_id = handles[:project_0].project_id
  bq = handles[:project_0].connect(Google::Apis::BigqueryV2::BigqueryService)
  sql = <<~SQL
    SELECT COUNTIF(evento = 'HumanReview' AND ator = 'human') AS revisoes
    FROM `#{project_id}.auditoria_ia.eventos`
  SQL
  req = Google::Apis::BigqueryV2::QueryRequest.new(query: sql, use_legacy_sql: false, location: 'US', timeout_ms: 30_000)
  revisoes = bq.query_job(project_id, req).rows&.first&.f&.first&.v.to_i

  if revisoes.zero?
    return { score: 0, message: 'Sem HumanReview.',
             student_message: 'Nenhuma revisão humana chegou ao BigQuery. Rode o audit-review.mjs no terminal (Tarefa 7), espere alguns segundos e tente de novo.' }
  end
  { score: maximum_score, message: 'OK', student_message: 'Revisão humana registrada e enviada à trilha.' }
rescue StandardError => e
  { score: 0, message: "Erro: #{e.message}", student_message: 'Não foi possível ler auditoria_ia.eventos. Tente de novo em alguns segundos.' }
end
```
