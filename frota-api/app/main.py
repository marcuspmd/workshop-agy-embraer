"""Aplicação FastAPI da frota-api."""
from fastapi import FastAPI

from app.config import config
from app.erros import ErroApi, tratar_erro_api
from app.routers import aeronaves

app = FastAPI(title=config()["api"]["titulo"])
app.add_exception_handler(ErroApi, tratar_erro_api)
app.include_router(aeronaves.router, prefix=config()["api"]["prefixo"])
