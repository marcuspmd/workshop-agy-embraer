---
name: painel
description: Painel do time sobre o uso da IA no desenvolvimento. Responde o que cada pessoa está fazendo com a skill my-task no Antigravity (agora, hoje ou num período), em qual task, quais arquivos mudou, o que foi bloqueado, como foi o quality gate e se já tem revisão humana. Use para qualquer pergunta sobre atividade, uso, andamento ou trilha de auditoria do time.
---

# Painel do time (my-task)

Os hooks da my-task gravam cada ação da IA numa trilha local e enviam os eventos para a tabela `eventos` do BigQuery. Você lê essa tabela para mostrar, com dados, como cada pessoa está trabalhando.

<gating_rule>
**Só leitura, sempre com dados.**

- Antes da primeira consulta, chame `tabela_do_painel` para saber o projeto, a tabela e o fuso.
- Consulte só com `execute_sql_readonly`, passando o projeto de `tabela_do_painel` como `projectId`. Nunca escreva nem altere dados.
- Não responda de memória: toda afirmação sobre o que alguém fez vem de uma consulta desta conversa.
</gating_rule>

## Como consultar

1. Carregue `references/esquema.md` para entender as colunas e os eventos.
2. Carregue `references/consultas.md` e adapte a consulta mais próxima da pergunta. Troque `{tabela}` pelo nome completo devolvido por `tabela_do_painel`.
3. Regras de toda consulta:
   - filtro de tempo em `ts` (padrão: as últimas 2 horas; "hoje" é desde a meia-noite no fuso do painel);
   - `LIMIT` de no máximo 200 linhas e só as colunas necessárias, nunca `SELECT *`;
   - filtro por `participante` com `LOWER(participante) LIKE LOWER('%nome%')` quando a pergunta citar alguém.

## Como responder

- Comece pela resposta em uma ou duas frases ("3 pessoas ativas agora; Ana está no quality gate da frota-api").
- Depois, uma tabela curta. Horários no fuso do painel, no formato `HH:MM`.
- Destaque o que pede atenção: bloqueios, quality gate que falhou, task sem revisão humana, alguém parado há mais de 15 minutos.
- No fim, uma linha em itálico com a consulta que você usou, resumida.
- Para um parecer sobre se uma task seguiu o processo, use a skill `diligencia`.
