# Guia de configuração (`.ai/my-task.json`)

A configuração deixa o time ajustar limites, padrões e critérios uma vez, em vez de repetir em todo pedido. Ela é da my-task, que é genérica. O que é específico de um repositório (arquitetura, frameworks, pastas) vai nas **rules do projeto**, em `.agents/rules/`, escritas pelo time.

## Onde fica e quem vence

1. Padrão da skill: `.agents/skills/my-task/assets/config.default.json`
2. Global (todos os projetos da máquina): `~/.ai/my-task.json`
3. Projeto: `.ai/my-task.json`

O de baixo vence. Escalares e objetos: chave a chave. **Listas somam** (padrão, global, projeto), sem duplicar. Veja a configuração efetiva com `node .agents/skills/my-task/scripts/config.mjs`.

**Só pessoas editam este arquivo.** Os hooks bloqueiam o agente de alterá-lo, para que a IA não desligue as próprias regras.

## Quando a mudança vale

| Chaves | Vale quando |
|---|---|
| `policy.*`, `quality_gate.*`, `standards.allow_dependencies`, `standards.coverage`, `agents.enabled`, `audit.*`, `tasks.dir` | Na hora: os hooks leem o config a cada chamada |
| `standards.*` (o resto), `always_criteria`, `language`, `commands.test` (nas rules), `agents.models`, `rules.install` | Depois de `init.mjs --refresh` e de uma sessão nova do `agy` (rules e agentes são gerados a partir do config) |
| `execution.*` | Na hora para o hook `Stop`; o `auto_start` também é lido pela skill na Fase 0 |
| `grill.*`, `agents.max_parallel`, `agents.independent_verifier` | Na próxima tarefa: a skill lê o config na Fase 0 |

## Chaves

```jsonc
{
  "language": "pt-BR",
  "grill": { "max_questions": 10 },             // limite de perguntas na entrevista (pergunta até não sobrar lacuna)
  "tasks": { "dir": ".my-task" },              // cada task vira <projeto>/.my-task/<AAAA-MM-DD-slug>/
  "execution": {
    "auto_start": true,                         // true = executa sozinho após aprovar o plano; false = entrega o /goal para colar
    "max_continues": 30                         // quantas vezes o Stop manda continuar um plano "em execução"
  },
  "commands": {
    "test": "uv run pytest -q"                  // comando de testes do projeto; o init grava com --test-cmd
  },
  "standards": {
    "stack": "auto",                            // python | node | auto (detecta pelo repositório)
    "allow_dependencies": true,                 // false = hook bloqueia uv add / npm install <pacote>
    "architecture": {
      "style": "seguir-o-projeto",              // seguir-o-projeto | camadas | hexagonal | clean | mvc | "texto livre"
      "notes": ""                               // observações: pastas, limites entre camadas, proibições
    },
    "test_types": ["unitario"],                 // unitario | integracao | e2e: todo plano precisa ter cada tipo
    "coverage": {
      "min": 0,                                 // % mínima; 0 = sem mínimo
      "command": null                           // comando que FALHA abaixo do mínimo; o hook Stop roda antes de deixar encerrar
    },
    "conventions": [],                          // convenções do time em texto livre (viram a rule my-task-padroes)
    "require_req_in_test_names": true,          // nome do teste cita o REQ-xx
    "max_function_lines": 40
  },
  "always_criteria": [ "..." ],                 // somados a todo plano e conferidos pelo verificador
  "agents": {
    "enabled": true,                            // false = hook bloqueia invoke_subagent
    "max_parallel": 2,
    "independent_verifier": true,
    "models": {                                 // inherit | flash | pro
      "explore": "inherit",                     // inherit = o modelo escolhido no /model
      "test_writer": "inherit",
      "implement": "inherit",
      "verifier": "inherit"                     // nunca mais fraco que quem fez o trabalho
    }
  },
  "quality_gate": {
    "enabled": true,                            // roda o comando quando o agente tenta encerrar
    "command": null,                            // null = usa commands.test
    "when_exists": [],                          // vazio = só roda quando há arquivos de teste no workspace
    "max_retries": 3,                           // depois disso, deixa encerrar e registra a falha
    "timeout_seconds": 120                      // estourou = inconclusivo, não prende o agente
  },
  "audit": { "archive_transcripts": true },
  "policy": {
    "blocked_commands": [                       // regex sobre o comando de terminal
      { "pattern": "\\bsudo\\b", "reason": "..." }
    ],
    "blocked_tools": [                          // regex sobre o nome da ferramenta (inclui MCP)
      { "pattern": "delete_object|delete_bucket", "reason": "Evidências não são apagadas pela IA." }
    ]
  },
  "rules": { "install": ["auditoria", "testes"] }   // + a rule da linguagem detectada (python ou node)
}
```

## Exemplos de ajuste fino

**Entrevista mais curta ou mais longa:** `"grill": { "max_questions": 5 }`. Vale na próxima tarefa.

**Voltar a colar o `/goal` à mão:** `"execution": { "auto_start": false }`. A skill entrega o comando pronto depois da aprovação.

**Bloquear o deploy feito pela IA sem uma pessoa:** acrescente em `policy.blocked_commands`:

```json
{ "pattern": "\\bagents-cli\\s+deploy\\b", "reason": "Deploy só por uma pessoa, no terminal." }
```

**Mudar a arquitetura ou as convenções:** edite `standards.architecture` ou `standards.conventions` e rode `init.mjs --refresh`: a rule `my-task-padroes` e o verificador são regenerados.

**Cobertura mínima de 80% em Python:** `"standards": { "coverage": { "min": 80, "command": "uv run pytest -q --cov=app --cov-fail-under=80" } }` (precisa do `pytest-cov` no grupo dev). Vale na hora para o hook; a rule muda depois do `--refresh`.

**Exigir aprovação para dependências novas:** `"standards": { "allow_dependencies": false }`.

**Modelos por agente:** no ambiente do lab, a política da organização pode liberar só um modelo (o que você escolhe no `/model`). Por isso o padrão é `inherit` em todos. Onde `pro` estiver liberado, use no verificador: `"agents": { "models": { "verifier": "pro" } }`, depois `init.mjs --refresh`.

## Proteções fixas (não dependem do config)

- A IA não altera `.audit/`, `.agents/` nem `.ai/my-task.json`.
- A IA não roda `audit-review.mjs` nem `init.mjs`.
- Se o hook falhar ao registrar uma ação, ela não passa em silêncio: o `agy` pede confirmação.
