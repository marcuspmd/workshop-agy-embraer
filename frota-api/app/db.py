"""Conexão com o banco SQLite do laboratório, criado a partir do DDL e do seed."""
import sqlite3
from functools import lru_cache

from app.config import RAIZ, config


@lru_cache
def conexao() -> sqlite3.Connection:
    """Cria o banco em memória com db/schema.sql e db/seed.sql (uma vez por processo)."""
    banco = config()["banco"]
    con = sqlite3.connect(":memory:", check_same_thread=False)
    con.row_factory = sqlite3.Row
    con.executescript((RAIZ / banco["schema"]).read_text(encoding="utf-8"))
    con.executescript((RAIZ / banco["seed"]).read_text(encoding="utf-8"))
    return con
