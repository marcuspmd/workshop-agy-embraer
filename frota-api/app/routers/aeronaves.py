"""Rotas HTTP de aeronaves."""
from fastapi import APIRouter

from app.services import aeronaves as servico

router = APIRouter(prefix="/aeronaves", tags=["aeronaves"])


@router.get("/{matricula}")
def obter(matricula: str) -> dict:
    """Dados de uma aeronave."""
    return servico.obter_aeronave(matricula)
