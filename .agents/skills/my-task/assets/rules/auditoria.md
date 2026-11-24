---
trigger: always_on
description: Regras de auditoria e execução segura da my-task, válidas em toda sessão deste workspace.
---

# Auditoria e execução segura (my-task)

Tudo o que o agente faz neste workspace é registrado pelos hooks em `.audit/log.jsonl`, numa cadeia de hashes.

- Nunca crie, altere ou apague nada em `.audit/`, `.agents/` ou `.ai/my-task.json`. Mudanças nos padrões são feitas por uma pessoa.
- Nunca rode `audit-review.mjs` e nunca diga que um trabalho foi aprovado. A aprovação é sempre humana.
- Nunca apague evidências, logs de auditoria ou objetos de buckets de evidência. Evidências só são acrescentadas, com nomes novos.
- Se um hook bloquear uma ação, não tente contornar por outro caminho. Explique o bloqueio ao usuário e siga sem ela.
- Ao terminar uma tarefa, gere o relatório com `node .agents/skills/my-task/scripts/audit-report.mjs` e mostre o resumo.
- Responda e escreva relatórios em {{language}}.
