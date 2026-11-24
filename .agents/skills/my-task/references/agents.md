# Subagentes da my-task

O `init` instala quatro agentes em `.agents/agents/`. Todos têm `mainAgent: false` e `subagent: true`: não aparecem como agente principal, só são acionados pela skill com `invoke_subagent`. Os modelos vêm de `agents.models` no config.

| Agente | Quando | Ferramentas | Escreve em |
|---|---|---|---|
| `my-task-explorer` | Fase 1, antes de perguntar, se o workspace já tem código | leitura | nada |
| `my-task-test-writer` | Fase 3, em paralelo com o implementer | leitura, escrita, comando | as pastas de teste da sua linha no `PLAN.md` |
| `my-task-implementer` | Fase 3, em paralelo com o test-writer | leitura, escrita, comando | os arquivos de código da sua linha no `PLAN.md` |
| `my-task-verifier` | Fase 4, depois da integração | leitura, comando | nada |

## Regras para acionar

- **Subagentes não herdam a conversa.** Começam com contexto limpo. Tudo o que precisam tem que estar no `PLAN.md` ou no prompt de acionamento: caminho do plano, a tarefa da tabela "Divisão para os subagentes" e os arquivos em que podem mexer.
- **Paralelo só com contrato fechado.** O test-writer e o implementer trabalham ao mesmo tempo porque o plano já define arquivos e nomes públicos (módulos, funções, classes). Se o plano não define, feche antes.
- **Estrutura criada antes do paralelo.** Se a task pede um projeto novo, o agente principal cria a estrutura primeiro (por exemplo, com o `agents-cli` para um agente ADK); só depois aciona os dois subagentes.
- **Arquivos separados.** Um agente nunca mexe nos arquivos do outro. É isso que permite o paralelo sem conflito, e é o que torna os testes um contrato independente.
- **Limite:** no máximo `agents.max_parallel` ao mesmo tempo. Espere um terminar antes de acionar outro.
- **Verificador independente:** acione depois que o trabalho estiver integrado e com os testes rodando. Ele recebe o pedido original e o plano, não o seu raciocínio.
- **Não delegue coisa pequena.** Um ajuste de uma linha é mais rápido feito por você.

## Exemplo de acionamento

```text
invoke_subagent → my-task-test-writer
"Leia frota-api/.my-task/2026-11-24-horas-de-voo/PLAN.md. Sua tarefa é a linha 'my-task-test-writer' da tabela Divisão para os subagentes.
Escreva só na pasta de testes dessa linha. Devolva a lista REQ-xx → nome do teste."
```

## Permissões

Os subagentes herdam do agente principal os prefixos de comandos permitidos, os escopos de leitura e escrita e o sandbox. Pedidos de permissão aparecem para você no `agy` (no CLI, `Alt+J` pula para o próximo subagente esperando aprovação). Para acompanhar os subagentes, use `/agents`. Os hooks de auditoria e as proteções continuam valendo.

## Problemas conhecidos

- Um nome de ferramenta errado na lista `tools` de um agente pode travar o subagente. Use só os nomes da documentação do Antigravity.
- Se um subagente travar, abra `/agents`, selecione o subagente e pare-o com `k`. Faça a parte dele você mesmo e registre no relatório.
