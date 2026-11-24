---
name: my-task
description: Fluxo de trabalho governado do time para codificar qualquer task em qualquer repositório — instala regras de workspace e execução segura (/my-task init), entrevista no estilo grill-me, grava a task numa pasta própria (<projeto>/.my-task/<data-slug>/ com REQUEST, PLAN com requisitos REQ-xx, DONE, STATE, LOG e REPORT) seguindo as diretrizes do time (arquitetura, tipos de teste, cobertura mínima, convenções) e, aprovado o plano, já executa sozinho em modo goal com subagentes (testes e implementação em paralelo), passa por um verificador independente e deixa trilha de auditoria com revisão humana. Lê a configuração em .ai/my-task.json. Use para "/my-task init", "/my-task status", "/my-task audit", "/my-task config" e para qualquer pedido de criar, alterar ou corrigir código neste workspace.
---

# my-task

Serve para qualquer task, em qualquer repositório: uma feature, uma correção, um script, um agente. Transforma o pedido num **plano verificável** antes de escrever código, executa o plano em modo goal, sozinho, dividindo o trabalho entre subagentes e só considera pronto o que tem evidência. Tudo o que a IA faz fica registrado em `.audit/log.jsonl`, e a aprovação final é sempre de uma pessoa.

Responda e escreva os arquivos no idioma do config (`language`, padrão pt-BR).

> **Caminho da skill:** `.agents/skills/my-task/`. Os scripts ficam em `scripts/` e aceitam `--help`. Trate-os como caixas-pretas: rode com `--help` antes de usar, em vez de ler o código.

## Como invocar

No Antigravity CLI (`agy`), toda skill vira um comando: esta é `/my-task`, e `/skills` mostra se ela foi carregada.

| O usuário diz | O que acontece |
|---|---|
| `/my-task init`, "configura as regras do workspace" | Instalação guiada das regras e da execução segura — `references/init-workflow.md` |
| `/my-task status` | `node .agents/skills/my-task/scripts/status.mjs` e um resumo de duas linhas |
| `/my-task audit` | `node .agents/skills/my-task/scripts/audit-report.mjs` e o resumo do `AUDIT.md` |
| `/my-task config` | `node .agents/skills/my-task/scripts/config.mjs` e explica as chaves — `references/config-guide.md` |
| `/my-task <tarefa>`, ou qualquer pedido de criar, alterar ou corrigir código | Fluxo completo: fases 0 a 5 |

## Visão geral

```text
0. Conferir instalação e carregar config
1. Entrevista (grill-me)  →  2. Pasta da task (PLAN com REQ-xx, DONE)  →  APROVAÇÃO do usuário
3. Execução automática em modo goal  →  subagentes (testes ∥ implementação)
4. Verificação independente (my-task-verifier)  →  retrabalho se falhar
5. Relatório de auditoria  →  revisão humana (feita pela pessoa, no terminal)
```

A **única parada obrigatória com o usuário é a aprovação do plano.** Depois dela o trabalho segue sozinho, sem novo comando: o hook `Stop` faz o papel do `/goal` e não deixa o agente encerrar antes dos critérios de pronto.

## Fase 0 — Conferir instalação e carregar config

1. Rode `node .agents/skills/my-task/scripts/status.mjs --brief`.
2. Se a saída disser que a my-task **não está instalada** (código de saída 3), pare e siga `references/init-workflow.md`, ou peça ao usuário para rodar `/my-task init`.
3. Rode `node .agents/skills/my-task/scripts/config.mjs` e aplique: `grill.max_questions`, `execution.*`, `commands.test`, `standards.*` (arquitetura, tipos de teste, cobertura, convenções), `always_criteria`, `agents.*`.
4. Siga as rules do workspace: as da my-task (`.agents/rules/my-task-*.md`: auditoria, testes, **padroes** com as diretrizes do time e a linguagem do projeto) e as **rules do projeto** (os outros arquivos de `.agents/rules/`), que o time escreve para cada repositório. Elas valem mesmo fora desta skill.
5. Se o projeto da task já tem uma task `em execução` em `<projeto>/.my-task/`, pergunte se é para continuar essa (leia `STATE.md`, `DONE.md` e o fim do `LOG.md` e siga do `proximo_passo`) ou cancelar e abrir outra.

## Fase 1 — Entrevista (estilo grill-me)

- Não crie nem altere arquivos nesta fase.
- Antes de perguntar, olhe o workspace: README, rules do projeto, os documentos que o pedido cita e o código da área afetada (ou acione o subagente `my-task-explorer`). Pergunta boa vem depois de olhar.
- Faça **uma pergunta por vez**. Em cada pergunta, dê sua **resposta recomendada** e o motivo em uma frase. Quando a resposta for uma escolha entre caminhos, use `ask_question` com as opções (a recomendada primeiro).
- Cubra: o que entra e o que fica de fora, entradas e saídas, casos de borda, critério de aceite e como validar. Não pergunte o que as diretrizes do time (`standards.*`) já decidiram; pergunte só se a task precisar fugir delas.
- Pergunte até não sobrar lacuna: o plano precisa sair sem ambiguidade para a execução rodar sem parar. O limite é `grill.max_questions` (padrão 10); não existe número mínimo, mas não pare antes de cobrir os pontos acima. Se o usuário responder "pode seguir", assuma as respostas recomendadas que faltam e registre essas suposições.

## Fase 2 — Pasta da task e plano com requisitos rastreáveis

Cada task tem a sua pasta, criada a partir dos templates:

```bash
node .agents/skills/my-task/scripts/new-task.mjs --project <projeto> --slug <nome-curto>
# → <projeto>/.my-task/<AAAA-MM-DD-slug>/   (use --project . para uma task do workspace inteiro)
```

| Arquivo | O que guarda |
|---|---|
| `REQUEST.md` | O pedido original, **sem alterar**, e as respostas da entrevista (marque as assumidas) |
| `PLAN.md` | Requisitos `REQ-xx`, fora do escopo, estrutura e nomes públicos, casos de teste, divisão para os subagentes, diretrizes aplicadas |
| `DONE.md` | Critérios de pronto com o REQ que cobrem, a evidência e as tentativas |
| `STATE.md` | `status:` (rascunho → em execução → concluído / bloqueado / cancelado), `fase:` e `proximo_passo:`. O hook `Stop` lê este arquivo |
| `LOG.md` | Diário: só acrescente |
| `REPORT.md` | Relatório final (Fase 5) |

Atualize `STATE.md` (`fase`, `proximo_passo`) antes e depois de cada passo longo: se a sessão cair, quem chegar sabe onde parou. A rastreabilidade identifica cada requisito pelo projeto (`frota-api/REQ-01`) e considera a task em execução do projeto, ou a mais recente.

No `PLAN.md`:

1. Extraia os requisitos **frase por frase** do pedido, das respostas da entrevista e das rules e documentos do projeto. Numere no formato exato `- **REQ-01**: descrição verificável`.
2. Liste o que fica **fora do escopo**.
3. Defina a estrutura de arquivos **e os nomes públicos** (módulos, funções, classes), seguindo a arquitetura da rule `my-task-padroes`. Os subagentes trabalham em paralelo e precisam do mesmo contrato.
4. Monte a tabela de casos de teste: todo `REQ-xx` com pelo menos um teste automatizado, sem chamar serviços externos, e com cada tipo de teste exigido em `standards.test_types` representado.
5. Preencha a divisão para os subagentes e a seção "Diretrizes aplicadas".

No `DONE.md`: critérios verificáveis por quem não fez o trabalho, cada um apontando os REQ que cobre. Inclua sempre o comando de testes (`commands.test`), a cobertura mínima (se `standards.coverage.min` > 0), a arquitetura e as convenções da rule `my-task-padroes` e todo item de `always_criteria`. Se o config não tiver comando de testes, defina um e avise que uma pessoa precisa gravá-lo no `.ai/my-task.json` para o portão de qualidade usar.

Mostre um resumo curto do plano (requisitos, fora do escopo, critérios) com o caminho da pasta e peça aprovação. Ajuste até o usuário aprovar. Avise que, com `execution.auto_start` ligado, a execução começa sozinha logo após a aprovação.

## Fase 3 — Execução automática (modo goal)

Depois da aprovação, grave no `STATE.md` `status: em execução`, `aprovado_em:` e `fase: execução`, e registre a aprovação no `LOG.md`. É isso que liga o modo goal.

- **`execution.auto_start` = `true` (padrão):** comece a execução **na mesma resposta**, sem pedir outro comando. Diga em uma linha que a execução começou e que o usuário pode acompanhar com `/agents`. Enquanto o status for `em execução`, o hook `Stop` não deixa o agente encerrar: ele confere os testes (`commands.test`), se todo REQ aparece no nome de um teste, a cobertura mínima (quando há `standards.coverage.command`) e se o `my-task-verifier` foi acionado, e manda continuar com o que falta (até `execution.max_continues` vezes).
- **`execution.auto_start` = `false`:** não implemente nesta resposta. Responda com o comando abaixo num bloco de código, trocando `<pasta da task>` e `<comando de testes>`, e peça ao usuário que cole e envie:

```text
/goal Executar a task <pasta da task> seguindo a skill my-task (Fase 3, "Execução"). Pronto quando: os testes passam (<comando de testes>), todo REQ do PLAN.md aparece no nome de pelo menos um teste, todo critério do DONE.md está [x] com evidência, o my-task-verifier aprova todos os itens e o audit-report.mjs mostra integridade OK e nenhum requisito sem teste.
```

Nos dois casos, durante a execução **não faça perguntas ao usuário**: decida pelo plano e pelas respostas recomendadas, e registre a decisão no `LOG.md`. O status só sai de `em execução` na Fase 5 (`concluído`) ou num bloqueio que impeça terminar (`bloqueado`, com o motivo no `REPORT.md`). Se o usuário pedir para parar, grave `status: cancelado` e encerre.

### Execução

1. Se o plano pede um projeto novo, crie a estrutura primeiro, com a ferramenta que o plano ou as rules do projeto indicam (por exemplo, o `agents-cli` para um agente ADK). Se a pasta já existir, não recrie.
2. **Em paralelo**, com `invoke_subagent` (no máximo `agents.max_parallel` ao mesmo tempo):
   - `my-task-test-writer`: escreve os testes do plano, nas pastas de teste da sua linha;
   - `my-task-implementer`: implementa o código, nos arquivos da sua linha.
   Passe a cada um o caminho do `PLAN.md` da pasta da task e a sua linha da tabela "Divisão para os subagentes". Os subagentes não herdam esta conversa: tudo o que precisam tem que estar no plano.
3. Quando os dois terminarem, integre: rode `commands.test` (e o comando de cobertura, se houver). Se falhar, corrija **o código**, nunca o teste. Se o teste estiver errado em relação ao plano, registre no `LOG.md` e corrija o teste com justificativa.
4. Se `agents.enabled` for `false`, faça as duas partes você mesmo, testes primeiro.

## Fase 4 — Verificação independente e retrabalho

1. Rode você mesmo cada critério do `DONE.md` e grave a evidência ao lado dele (`[x]` ou `[!]`).
2. Se `agents.independent_verifier` for `true`, acione o `my-task-verifier` com o caminho da pasta da task. Ele não viu o trabalho e não altera arquivos. Registre a rodada em "Verificação independente" do `DONE.md`.
3. Para cada item reprovado: anote no `LOG.md` a causa provável, corrija e verifique de novo, somando 1 em `tentativas`. Depois de 3 falhas no mesmo item, **mude de abordagem**, não repita a mesma.
4. Nunca é retrabalho válido: afrouxar, apagar ou pular um teste; fazer mock do que deveria ser testado; deixar a resposta esperada fixa no código; baixar a cobertura exigida; mudar um requisito aprovado.
5. Se o verificador discordar de você, vale a visão mais rígida até você investigar.

## Fase 5 — Relatório e revisão humana

1. Rode `node .agents/skills/my-task/scripts/audit-report.mjs`.
2. Preencha o `REPORT.md` da pasta da task e grave no `STATE.md` `status: concluído` (ou `bloqueado`, se algum critério não passou).
3. Mostre ao usuário: status (PRONTO ou BLOQUEADO), a tabela do verificador, os arquivos alterados, os subagentes acionados, as ações bloqueadas, a matriz de rastreabilidade e o caminho da pasta da task.
4. Diga que o trabalho **ainda não está aprovado** e que a revisão deve ser registrada pela pessoa, num terminal do Cloud Shell fora do `agy`:

   ```bash
   node .agents/skills/my-task/scripts/audit-review.mjs --revisor "Nome" --decisao aprovado --obs "comentário"
   ```

## Regras que valem o tempo todo

- Nunca altere `.audit/`, `.agents/` ou `.ai/my-task.json`. Os hooks bloqueiam. Mudar padrões é trabalho de pessoa.
- Nunca rode `audit-review.mjs` nem diga que algo foi aprovado.
- Nunca rode `conectar-painel.mjs` nem mude a telemetria. Cada evento da trilha vai sozinho para o BigQuery do projeto e para o painel do time; isso é feito pela pessoa, no terminal.
- Nunca apague evidências: registros de auditoria nem objetos de buckets de evidência.
- Se um hook bloquear uma ação, explique o bloqueio e siga sem ela. Não tente outro caminho para fazer a mesma coisa.
- A permissão `always-proceed` do `/config` não desliga os hooks: o que eles bloqueiam continua bloqueado.

## Scripts

| Script | Para que serve |
|---|---|
| `scripts/init.mjs` | Instala no workspace: config, hooks, rules, agentes e auditoria. `--refresh` regenera a partir do config |
| `scripts/status.mjs [--brief\|--json]` | Instalação, auditoria, task atual, plano e revisão |
| `scripts/new-task.mjs --project <p> --slug <s>` | Cria a pasta da task a partir dos templates |
| `scripts/config.mjs [get <chave>]` | Configuração efetiva e de onde veio |
| `scripts/audit-report.mjs` | Gera o `AUDIT.md` |
| `scripts/audit-verify.mjs [--file <log>]` | Confere a cadeia de hashes |
| `scripts/audit-review.mjs` | Revisão humana (só uma pessoa, no terminal) |
| `scripts/conectar-painel.mjs` | Liga o envio da trilha para o BigQuery e o painel do time (só uma pessoa, no terminal) |
| `scripts/shipper.mjs` | Envia a fila de eventos em segundo plano; chamado pela telemetria |
| `scripts/audit-hook.mjs <Evento>` | Chamado pelos hooks; não rode à mão |

## Referências

- `references/init-workflow.md` — como conduzir o `/my-task init`
- `references/config-guide.md` — todas as chaves do `.ai/my-task.json`
- `references/agents.md` — quando e como usar cada subagente
- `references/audit.md` — o que é registrado, o que é bloqueado e os limites
