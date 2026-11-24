"""Testes do recurso aeronaves (exemplo de estilo para os testes novos)."""
from fastapi.testclient import TestClient

from app.main import app

cliente = TestClient(app)


def test_aeronave_existente_devolve_dados():
    resposta = cliente.get("/api/v1/aeronaves/PR-ABC")
    assert resposta.status_code == 200
    assert resposta.json()["modelo"] == "E195-E2"


def test_aeronave_inexistente_devolve_404_no_formato_padrao():
    resposta = cliente.get("/api/v1/aeronaves/PR-ZZZ")
    assert resposta.status_code == 404
    assert resposta.json()["erro"]["codigo"] == "AERONAVE_NAO_ENCONTRADA"


def test_matricula_invalida_devolve_422():
    resposta = cliente.get("/api/v1/aeronaves/ABC123")
    assert resposta.status_code == 422
    assert resposta.json()["erro"]["codigo"] == "MATRICULA_INVALIDA"
