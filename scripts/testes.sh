#!/bin/bash
# Roda os testes de cada projeto do repositório que já tem testes. Usado pelo quality gate da my-task.
set -u
FALHOU=0
RODOU=0
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
if compgen -G "${RAIZ}/frota-api/tests/test_*.py" >/dev/null; then
  echo "== frota-api"; RODOU=1
  (cd "${RAIZ}/frota-api" && uv run pytest -q) || FALHOU=1
fi
if compgen -G "${RAIZ}/painel-agent/tests/unit/test_*.py" >/dev/null; then
  echo "== painel-agent"; RODOU=1
  (cd "${RAIZ}/painel-agent" && uv run pytest tests/unit -q) || FALHOU=1
fi
[ "${RODOU}" = 0 ] && echo "nenhum teste encontrado"
exit "${FALHOU}"
