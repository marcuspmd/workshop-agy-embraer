---
trigger: model_decision
description: Regras do projeto frota-api (API de frota em FastAPI). Leia antes de criar ou alterar qualquer coisa em frota-api/.
---

# Projeto frota-api

Regra do projeto, escrita pelo time e versionada no repositório. A my-task é genérica; o que é deste projeto está aqui.

- **Antes de planejar, leia:** `frota-api/docs/padroes.md` (arquitetura, API, erros, dados, testes), `frota-api/db/schema.sql` (DDL), `frota-api/config/app.yaml` e o endpoint de exemplo em `frota-api/app/` com o teste `frota-api/tests/test_aeronaves.py`.
- A pasta da task fica em `frota-api/.my-task/<AAAA-MM-DD-slug>/` (crie com `new-task.mjs --project frota-api`).
- Siga as três camadas: `routers` → `services` → `repositories`. SQL só em `repositories`.
- Use só tabelas e colunas que existem no `db/schema.sql`. Mudar o DDL não faz parte de uma task de API: se precisar, pare e pergunte.
- Erros com `ErroApi` (`app/erros.py`), no formato padrão. Limites e prefixos vêm do `config/app.yaml`.
- Nunca exponha `manutencoes.responsavel_matricula` nem outro dado pessoal.
- Testes em `frota-api/tests/`, com o nome citando o requisito. Comando: `cd frota-api && uv run pytest -q`.
- Atualize a tabela de endpoints do `frota-api/README.md`.
