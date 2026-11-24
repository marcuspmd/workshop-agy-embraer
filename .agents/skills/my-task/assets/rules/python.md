---
trigger: glob
globs: "*.py"
description: Padrões de código Python do time (my-task).
---

# Padrões de código Python (my-task)

- Projeto gerenciado pelo `uv` (`pyproject.toml`). Rode tudo com `uv run`.
- {{deps_rule}}
- Type hints em todas as funções públicas e docstring curta dizendo o que fazem.
- Funções pequenas (até {{max_function_lines}} linhas), com nomes descritivos e uma responsabilidade cada.
- Configuração vem de variáveis de ambiente (`.env`), nunca escrita no código.
- Nunca coloque segredos, chaves ou tokens no código nem no repositório.
- Nada de código morto nem comentário que repete o código.
