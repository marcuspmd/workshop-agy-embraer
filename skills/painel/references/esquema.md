# Tabela `eventos`

Uma linha por evento da trilha de auditoria da my-task. Cada participante e workspace tem a própria sequência (`seq`) e a própria cadeia de hashes (`hash` liga com o `prev_hash` da linha seguinte).

| Coluna | O que é |
|---|---|
| `ts` | Quando aconteceu (UTC) |
| `participante` | Nome da pessoa |
| `projeto_gcp`, `workspace` | De onde veio |
| `conversa` | ID da conversa do agy |
| `seq` | Posição na trilha local daquela pessoa |
| `evento` | Tipo do evento (abaixo) |
| `ator` | `ai-agent` (a IA, pelos hooks) ou `human` (a pessoa, no terminal) |
| `modelo` | Modelo usado na conversa |
| `ferramenta` | Ferramenta chamada pela IA |
| `decisao` | Em `PreToolUse`: `allow`, `deny` (bloqueado) ou `ask` |
| `motivo` | Por que foi bloqueado |
| `resultado` | Em `QualityGate`: `passou`, `falhou`, `inconclusivo`. Em `HumanReview`: a decisão |
| `arquivos` | Arquivos alterados (lista) |
| `pedido` | O que a pessoa pediu ao agy |
| `task` | Projeto e título do plano, ex.: `frota-api: horas de voo por aeronave` |
| `detalhe` | Resumo dos argumentos da ferramenta (JSON em texto) |
| `hash`, `prev_hash` | Cadeia de integridade |

## Eventos

| `evento` | Significa |
|---|---|
| `AuditInstalled` | A pessoa instalou a my-task (`/my-task init`) |
| `PainelConectado` | A pessoa ligou o envio para o painel |
| `SessionStart` | Começou uma conversa no agy |
| `PostInvocation` | A pessoa mandou uma mensagem; o texto está em `pedido` |
| `PreToolUse` | A IA pediu para usar uma ferramenta; `decisao` diz se passou |
| `PostToolUse` | A ferramenta rodou; `arquivos` traz o que mudou |
| `Stop` | A IA tentou encerrar |
| `QualityGate` | Os testes rodaram no encerramento; ver `resultado` |
| `HumanReview` | Uma pessoa registrou a revisão no terminal |

## Ferramentas que importam

- `write_to_file`, `replace_file_content`, `multi_replace_file_content`: a IA escreveu código.
- `run_command`: a IA rodou um comando (o comando está em `detalhe`).
- `invoke_subagent`: a IA acionou um subagente (`my-task-test-writer`, `my-task-implementer`, `my-task-verifier` aparecem em `detalhe`).
- Um arquivo `PLAN.md` em `arquivos` indica o plano da task.
