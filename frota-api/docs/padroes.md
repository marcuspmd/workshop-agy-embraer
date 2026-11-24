# Padrões do time — frota-api

Estes padrões valem para todo código novo neste repositório. A revisão de código cobra cada item.

## Arquitetura

- Três camadas: `app/routers` (HTTP) → `app/services` (regra de negócio) → `app/repositories` (SQL).
- **SQL só em `repositories`.** Router não acessa o banco; service não monta SQL.
- Um arquivo por recurso em cada camada (ex.: `routers/aeronaves.py`, `services/aeronaves.py`, `repositories/aeronaves.py`).
- Configuração vem de `config/app.yaml` (via `app/config.py`). Nada de número mágico no código: limites e prefixos ficam no YAML.

## API

- Prefixo de todas as rotas: o `api.prefixo` do `config/app.yaml` (`/api/v1`).
- Nomes de rotas, campos e parâmetros em português, `snake_case`.
- Matrícula de aeronave no formato ANAC: `^P[PRST]-[A-Z]{3}$` (ex.: `PR-ABC`). Matrícula inválida → **422**.
- Recurso inexistente → **404**.
- Datas e horários em ISO 8601, UTC.
- Listas são paginadas com `pagina` e `tamanho` (padrão e máximo vêm do `config/app.yaml`).
- **Erros sempre no formato:**

  ```json
  { "erro": { "codigo": "AERONAVE_NAO_ENCONTRADA", "mensagem": "Aeronave PR-ZZZ não encontrada." } }
  ```

  Use a exceção `ErroApi` de `app/erros.py`; não devolva `HTTPException` direto.

## Dados

- Nunca exponha dado pessoal na API: `manutencoes.responsavel_matricula` (matrícula do mecânico) não sai em nenhuma resposta.
- Somatórios de horas de voo usam a coluna `voos.horas_voo` e são arredondados para 2 casas.

## Testes

- `pytest` com o `TestClient` do FastAPI, em `tests/`, contra o SQLite criado a partir de `db/schema.sql` e `db/seed.sql`.
- Todo requisito tem pelo menos um teste, e o nome do teste cita o requisito (`test_req_01_...`).
- Cubra sempre: caminho feliz, 404, 422 e os limites de período e de paginação.

## O que é proibido

- Segredos, tokens ou senhas no código ou no repositório.
- Dependência nova sem justificativa no README.
- Alterar `db/schema.sql` sem migração descrita no PR.
