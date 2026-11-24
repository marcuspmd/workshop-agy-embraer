# Instalação guiada (`/my-task init`)

Acionada por "/my-task init", "configura as regras do workspace", "instala a my-task aqui". É aqui que o time cria as **regras de workspace** e a **execução segura**. Não rode o script às cegas: primeiro olhe o workspace, depois pergunte as diretrizes do time, depois instale.

## Passo 1 — Olhar (sem perguntas ainda)

- Rode `node .agents/skills/my-task/scripts/status.mjs --brief`. Se já estiver instalada, diga isso e mostre o status. Reinstalar ou reconfigurar é feito pela pessoa, no terminal (`init.mjs --force` ou `init.mjs --refresh`); os hooks bloqueiam o agente.
- Rode `node --version` (o motor da skill pede Node 20 ou mais recente).
- Veja o que já existe: a linguagem do projeto (`pyproject.toml`, `package.json`…), o comando de testes, a ferramenta de cobertura (`pytest-cov`, `coverage`, `vitest --coverage`, `jest --coverage`), a arquitetura que o código já segue (pastas como `routers/`, `services/`, `domain/`, `adapters/`), lint e typecheck, `.agents/hooks.json`, as rules do projeto em `.agents/rules/` e `.agents/agents/`. A instalação **acrescenta** aos arquivos existentes; não apaga hooks, rules ou agentes de outras origens.

## Passo 2 — Perguntar (uma por vez, recomendada primeiro)

Mostre em duas linhas o que encontrou (linguagem, framework, testes, cobertura, arquitetura que o código já segue) e pergunte **uma por vez**, no estilo grill-me. Use a ferramenta `ask_question`: nas perguntas de **opção**, passe as opções com a recomendada primeiro e marcada "(recomendado)"; nas de **texto**, mostre um exemplo e aceite "nenhuma". Recomende sempre a partir do que você viu no workspace, nunca no escuro.

| # | Pergunta | Tipo | Opções / exemplo | Grava em |
|---|---|---|---|---|
| 1 | Idioma e linguagem principal | opção | pt-BR + a linguagem detectada · en · Python · Node | `--language`, `--stack` |
| 2 | Arquitetura | opção | **seguir-o-projeto** (recomendado quando já há código ou rule do projeto) · camadas · hexagonal · clean · mvc · outra (texto) | `--architecture` |
| 3 | Observações de arquitetura | texto | "SQL só em repositories; routers não chamam repositories" | `--architecture-notes` |
| 4 | Tipos de teste exigidos | opção múltipla | **unitário** · integração · e2e | `--test-types unitario,integracao` |
| 5 | Comando de testes (portão de qualidade) | opção | o comando detectado (recomendado) · outro (texto) · desligado | `--test-cmd` ou `--no-quality-gate` |
| 6 | Cobertura mínima | opção | nenhuma · 70% · **80%** · 90% | `--min-coverage` |
| 7 | Comando de cobertura (só se 6 ≠ nenhuma) | texto | o detectado, que falha abaixo do mínimo: `uv run pytest --cov=app --cov-fail-under=80` · `npx vitest run --coverage --coverage.thresholds.lines=80` | `--coverage-cmd` |
| 8 | Subagentes | opção | **ligados, até 2 em paralelo** · ligados, 1 · desligados | `--max-parallel`, `--no-agents` |
| 9 | Dependências novas | opção | **permitidas, justificadas no README** · só com aprovação de uma pessoa | `--no-deps` |
| 10 | Convenções do time | texto (pode ter várias) | "erros no formato padrão de app/erros.py", "nomes em português", "lint com ruff sem avisos" | `--convention` (uma por item) |
| 11 | Critério de pronto do time | texto | "o README explica como rodar e testar o projeto" | `--criteria` |

- Se a cobertura não tiver comando que falhe abaixo do mínimo, diga isso: sem comando, o mínimo vale só como critério para o verificador, e o hook não confere.
- Se o usuário responder "pode seguir", assuma as recomendadas que faltam e diga quais foram assumidas.
- Antes de instalar, mostre o resumo das respostas numa tabela curta e peça "ok".

## Passo 3 — Instalar

Monte o comando com as respostas e rode na raiz do workspace:

```bash
node .agents/skills/my-task/scripts/init.mjs --language pt-BR --stack python \
  --architecture seguir-o-projeto --architecture-notes "SQL só em repositories" \
  --test-types unitario,integracao --test-cmd "./scripts/testes.sh" \
  --min-coverage 80 --coverage-cmd "cd frota-api && uv run pytest -q --cov=app --cov-fail-under=80" \
  --max-parallel 2 --convention "erros no formato padrão de app/erros.py" \
  --criteria "o README explica como rodar e testar o projeto"
```

Opções úteis: `--no-agents`, `--no-quality-gate`, `--no-deps`, `--dry-run` (mostra antes de gravar). Rode `--help` para ver todas.

## Passo 4 — Fechar

Mensagem curta com:

1. O que foi criado: `.ai/my-task.json`, `.agents/hooks.json`, `.agents/rules/my-task-*.md` (auditoria, testes, padroes com as diretrizes do time e a linguagem do projeto; as rules do projeto continuam como estavam), `.agents/agents/my-task-*.md` e `.audit/log.jsonl`.
2. Que é preciso **abrir uma sessão nova do `agy`** para hooks, rules e agentes valerem: `/exit` e depois `agy`, na mesma pasta. Na sessão nova, `/hooks` mostra os hooks carregados.
3. Como usar: `/my-task <tarefa>` para trabalhar, `/my-task status` para conferir.
4. Como fazer ajuste fino: editar `.ai/my-task.json` à mão (guia em `references/config-guide.md`). Política e portão de qualidade valem na hora; rules e agentes precisam de `node .agents/skills/my-task/scripts/init.mjs --refresh` e uma sessão nova do `agy`.
