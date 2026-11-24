# Roteiro do facilitador

Material interno: não vai para o Qwiklabs. O roteiro do aluno é o `lab_instructions.md`.

## Divisão do tempo (90 min)

| Tempo | Tarefa | Observação |
| :--- | :--- | :--- |
| 0–12 | 1. Ambiente, agy e agents-cli | É a etapa que mais trava: autenticação do `agy` em 9 passos. Circule pela sala. |
| 12–20 | 2. my-task, execução segura e painel | Mostre a URL e o TOKEN no telão. Abra o Logs Explorer ao vivo: os bloqueios aparecem na hora. |
| 20–40 | 3. API na frota-api com a my-task | A execução automática (modo goal) leva de 6 a 10 min. Mostre `/agents` e o painel ao vivo. |
| 40–55 | 4. Cenário 1: agente Painel | Peça "pode seguir" na entrevista para ganhar tempo. Segunda execução longa do lab. |
| 55–63 | 5. Cenário 2: deploy | Todos copiam o Resource Name. |
| 63–75 | 6. Cenário 2: Gemini Enterprise | Atenção à propagação de IAM (30 a 60 s). |
| 75–90 | 7. Integridade, revisão e painel da turma | Adulteração da cópia, revisão humana e a diligência que muda de ALTO para BAIXO. Feche no painel central. |

São duas execuções longas em modo goal (Tarefas 3 e 4), que começam sozinhas depois da aprovação do plano. Sugestão: cronômetro do Qwiklabs em **120 min** para uma sessão de 90. Se a turma atrasar, a Tarefa 4 pode começar enquanto a execução da Tarefa 3 termina, numa segunda sessão do `agy`.

## Mensagens principais

- **A my-task é genérica.** Ela planeja e codifica qualquer task em qualquer repositório. O que é de cada projeto está nas rules do projeto, versionadas com o código.
- **A IA lê o projeto antes de codar.** DDL, padrões e config da `frota-api` fazem a IA acertar tabelas, camadas e formato de erro sem repetir nada no pedido.
- **Cada ação vira evidência.** Trilha local com cadeia de hashes, BigQuery do projeto e painel do time.
- **O painel é um agente.** Duas ADK Skills e o MCP do BigQuery somente leitura: mostra quem está fazendo o quê e se o processo foi seguido.
- **Execução segura de verdade.** Hooks bloqueiam mesmo com `always-proceed`; o `tool_filter` tira do painel qualquer escrita.

## Checklist antes do evento

- [ ] Publicar este repositório como `github.com/marcuspmd/workshop-agy-embraer` (público), ou trocar a URL do `git clone` no roteiro.
- [ ] Preparar o painel central (`painel-central/README.md`): hub no Cloud Run, URL, TOKEN, agente central e app no Gemini Enterprise.
- [ ] Testar o envio de um projeto Qwiklabs para o hub central (`conectar-painel.mjs` → linha no Logs Explorer do projeto central em segundos).
- [ ] Qwiklabs: colar o `lab_instructions.md` na aba **Instructions** e enviar o `qwiklabs/Archive.zip` no recurso `project_0` (**Update Lab Resource**).
- [ ] Qwiklabs, **Student Visible Outputs**: `project_0.console_url`, `project_0.project_id`, `user_0.username`, `user_0.password`, `project_0.default_region`.
- [ ] Confirmar o modelo liberado (o roteiro usa **Gemini 3.8 Flash** no `agy` e `gemini-3.8-flash` no `.env`) e a cota para a turma: por aluno, duas execuções longas em modo goal, um deploy e algumas perguntas ao painel.
- [ ] Rodar o lab inteiro com uma conta de estudante, de ponta a ponta. Confirmar em especial:
  - o setup do Qwiklabs cria `auditoria_ia.eventos` no projeto do aluno;
  - `conectar-painel.mjs` envia para o BigQuery do aluno (o `gcloud auth print-access-token` funciona no Cloud Shell) e para o hub central;
  - `/my-task init` chega à skill e, depois de uma sessão nova, `/hooks` mostra os hooks `my-task`;
  - o `.audit/log.jsonl` ganha `SessionStart`, `PreToolUse` e `PostToolUse` com o nome das ferramentas, e o painel recebe em segundos;
  - os subagentes `my-task-*` aparecem em `/agents` e conseguem rodar `uv run pytest` no sandbox;
  - o quality gate roda `./scripts/testes.sh` dentro de 120 s;
  - a API gerada devolve 3,86 horas e 3 ciclos para PR-ABC em novembro de 2026;
  - o `agents-cli` cria o projeto em `painel-agent/` e gera `deployment_metadata.json` no deploy, levando `PAINEL_PROJECT` e `PAINEL_DATASET`;
  - o MCP do BigQuery responde no ADK Web com as credenciais do aluno e, depois do deploy, com a conta de serviço `service-<PROJECT_NUMBER>@gcp-sa-aiplatform-re.iam.gserviceaccount.com` (se o `agents-cli` criar uma conta própria para o agente, troque no passo 1 da Tarefa 6);
  - os rótulos da tela do Gemini Enterprise (**Create your first app**, **Add Agent**, **Custom agent via Agent Runtime**, **Agent Runtime reasoning engine**, **Preview**);
  - os bloqueios da Tarefa 2 acontecem mesmo com **Tool Permission** em `always-proceed`.
- [ ] Plano B: um projeto com o painel já publicado e dados de uma rodada de teste, para mostrar no telão se a rede ou a cota falharem.

## Problemas comuns

| Sintoma | O que fazer |
| :--- | :--- |
| `Permission 'aiplatform.endpoints.predict' denied` ou `Agent terminated due to error` | `/exit`, `agy auth logout`, `agy` de novo com a conta de estudante. |
| `constraints/vertexai.allowedModels violated` | `/model` e escolher o modelo liberado. Nos subagentes da `my-task`, o padrão é `inherit` por isso. |
| `agy` ou `agents-cli` não encontrados numa aba nova | `source ~/.bashrc` ou `export PATH="$HOME/.local/bin:$PATH"`. |
| `/my-task` não aparece em `/skills` | Conferir se o `agy` foi aberto em `~/workshop-agy-embraer`. Sair e abrir de novo. |
| O participante não aparece no painel | `node .agents/skills/my-task/scripts/status.mjs` mostra a fila e o último erro; `.audit/shipper.log` tem o detalhe. URL ou token errados: rodar `conectar-painel.mjs` de novo. |
| `status.mjs` mostra erro 401 no painel central | Token diferente do hub. Conferir o TOKEN do telão. |
| O agente diz que não pode reinstalar a `my-task` ou ligar o painel | Correto: a IA é bloqueada de rodar `init.mjs` e `conectar-painel.mjs`. Rodar no terminal. |
| ADK Web com tela preta | Rodar com `--allow_origins="*"` e de dentro de `painel-agent/`. |
| Skill funciona no ADK Web mas não depois do deploy | Ela está fora do pacote. As duas skills precisam estar em `painel-agent/app/skills/`. |
| Painel no Gemini Enterprise responde que não tem permissão | Conferir as três permissões da Tarefa 6, passo 1. |
| `audit-review.mjs` pede terminal interativo | Rodar no terminal do Cloud Shell, fora do `agy`. |

## Verificador de progresso

`scripts/check_progress.sh <1..7|all>` confere o que é verificável em cada tarefa. A publicação no Gemini Enterprise (Tarefa 6) é conferida no Console.
