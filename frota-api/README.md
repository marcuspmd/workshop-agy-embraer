# frota-api

API interna (fictícia) de frota de aeronaves, usada no laboratório como **repositório do projeto**: é aqui que a `my-task` vai codificar a task de vocês.

## O que tem aqui

| Caminho | O que é |
|---|---|
| `db/schema.sql` | DDL do banco: aeronaves, voos e manutenções |
| `db/seed.sql` | dados de exemplo (fictícios) |
| `config/app.yaml` | configuração da API: prefixo, paginação, limites |
| `docs/padroes.md` | padrões do time: arquitetura, nomes, erros, testes |
| `app/` | código: `routers` → `services` → `repositories` |
| `tests/` | testes com `pytest` e o `TestClient` do FastAPI |

## Rodar e testar

```bash
cd frota-api
uv sync
uv run pytest -q
uv run uvicorn app.main:app --reload --port 8080
```

O banco roda em SQLite, criado a partir de `db/schema.sql` e `db/seed.sql` a cada inicialização.

## Endpoints

| Método e caminho | O que faz |
|---|---|
| `GET /api/v1/aeronaves/{matricula}` | dados de uma aeronave |
