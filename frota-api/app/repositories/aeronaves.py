"""Acesso à tabela aeronaves."""
from app.db import conexao


def buscar_por_matricula(matricula: str) -> dict | None:
    """Devolve a aeronave pela matrícula, ou None."""
    linha = conexao().execute(
        "SELECT matricula, modelo, numero_serie, operador, status FROM aeronaves WHERE matricula = ?",
        (matricula,),
    ).fetchone()
    return dict(linha) if linha else None
