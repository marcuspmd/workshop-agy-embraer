"""Erros da API no formato padrão do time: {"erro": {"codigo", "mensagem"}}."""
from fastapi import Request
from fastapi.responses import JSONResponse


class ErroApi(Exception):
    """Erro de negócio com status HTTP, código e mensagem."""

    def __init__(self, status: int, codigo: str, mensagem: str) -> None:
        super().__init__(mensagem)
        self.status = status
        self.codigo = codigo
        self.mensagem = mensagem


async def tratar_erro_api(_request: Request, erro: ErroApi) -> JSONResponse:
    """Converte ErroApi na resposta JSON padrão."""
    return JSONResponse(status_code=erro.status, content={"erro": {"codigo": erro.codigo, "mensagem": erro.mensagem}})
