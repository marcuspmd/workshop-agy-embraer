"""Leitura da configuração da API (config/app.yaml)."""
from functools import lru_cache
from pathlib import Path

import yaml

RAIZ = Path(__file__).resolve().parent.parent


@lru_cache
def config() -> dict:
    """Devolve a configuração do config/app.yaml."""
    return yaml.safe_load((RAIZ / "config" / "app.yaml").read_text(encoding="utf-8"))
