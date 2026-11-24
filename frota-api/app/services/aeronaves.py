"""Regras de negócio de aeronaves."""
import re

from app.erros import ErroApi
from app.repositories import aeronaves as repositorio

MATRICULA = re.compile(r"^P[PRST]-[A-Z]{3}$")


def validar_matricula(matricula: str) -> str:
    """Normaliza e valida a matrícula no formato ANAC; levanta ErroApi 422 se inválida."""
    valor = matricula.strip().upper()
    if not MATRICULA.match(valor):
        raise ErroApi(422, "MATRICULA_INVALIDA", f"Matrícula {matricula} fora do formato ANAC (ex.: PR-ABC).")
    return valor


def obter_aeronave(matricula: str) -> dict:
    """Devolve a aeronave ou levanta ErroApi 404."""
    valor = validar_matricula(matricula)
    aeronave = repositorio.buscar_por_matricula(valor)
    if aeronave is None:
        raise ErroApi(404, "AERONAVE_NAO_ENCONTRADA", f"Aeronave {valor} não encontrada.")
    return aeronave
