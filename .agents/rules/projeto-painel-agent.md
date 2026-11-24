---
trigger: model_decision
description: Regras do projeto painel-agent (agente ADK do painel do time). Leia antes de criar, alterar, testar ou publicar o agente em painel-agent/.
---

# Projeto painel-agent

Regra do projeto, escrita pelo time e versionada no repositório. A my-task é genérica; o que é deste projeto está aqui.

- O agente fica em `painel-agent/`, criado com os comandos e as skills do `agents-cli`. O `agy` roda na raiz do repositório; o agente é uma subpasta. A pasta da task fica em `painel-agent/.my-task/<AAAA-MM-DD-slug>/` (crie com `new-task.mjs --project painel-agent`).
- **Siga a referência de código** em `docs/referencia-adk.md`: skills, `tabela_do_painel`, MCP do BigQuery e `.env`.
- **Skills dentro do pacote:** copie as pastas inteiras `skills/painel/` e `skills/diligencia/` para `painel-agent/app/skills/` e carregue com caminho relativo ao módulo. Nada de `../` nem symlink: o Agent Runtime empacota só o pacote do agente.
- Carregue as skills com `load_skill_from_dir` e `SkillToolset`.
- **MCP do BigQuery** com `tool_filter=["execute_sql_readonly", "get_table_info"]`. Nunca `execute_sql`: o painel só lê.
- **Erros:** uma ferramenta nunca levanta exceção; devolve `{"erro": "..."}`.
- **Testes:** `pytest` em `painel-agent/tests/unit/`, sem chamar o modelo nem o BigQuery. Conferem que as duas skills existem em `app/skills/` e carregam, que as instruções citam as duas skills, que o `tool_filter` é só leitura e que `tabela_do_painel` devolve a tabela ou o erro quando falta `PAINEL_PROJECT`. Comando: `cd painel-agent && uv run pytest tests/unit -q`.
- Modelo, projeto, região e tabela vêm do `.env` (`MODEL`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, `PAINEL_PROJECT`, `PAINEL_DATASET`). O `.env` não vai para o repositório.
- Teste local com `uv run adk web --allow_origins="*"`, de dentro de `painel-agent/`.
