"""Hub do painel central: recebe os eventos da my-task de cada participante e grava no BigQuery.

POST /eventos  {"rows": [...]}  com o cabeçalho X-Painel-Token
GET  /saude
Cada lote também vira log estruturado no Cloud Logging, para o telão acompanhar ao vivo.
"""
import hmac
import json
import os
from datetime import datetime, timezone

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

TOKEN = os.environ.get("PAINEL_TOKEN", "")
TABELA = os.environ.get("PAINEL_TABELA", "")  # projeto.dataset.tabela
DRY_RUN = os.environ.get("PAINEL_DRY_RUN") == "1"
CAMPOS = {
    "ts", "participante", "projeto_gcp", "workspace", "conversa", "seq", "evento", "ator", "modelo",
    "ferramenta", "decisao", "motivo", "resultado", "arquivos", "pedido", "task", "detalhe", "hash", "prev_hash",
}
MAX_TEXTO = 2000
MAX_LINHAS = 200

app = FastAPI(title="painel-central")
_cliente = None


class Lote(BaseModel):
    rows: list[dict]


def _bigquery():
    global _cliente
    if _cliente is None:
        from google.cloud import bigquery

        _cliente = bigquery.Client()
    return _cliente


def _limpar(linha: dict, recebido_em: str) -> dict:
    limpa = {}
    for chave, valor in linha.items():
        if chave not in CAMPOS:
            continue
        if isinstance(valor, str):
            valor = valor[:MAX_TEXTO]
        elif chave == "arquivos":
            valor = [str(v)[:300] for v in (valor or [])][:50]
        limpa[chave] = valor
    if not limpa.get("ts") or not limpa.get("hash"):
        raise HTTPException(status_code=422, detail="cada linha precisa de ts e hash")
    limpa["recebido_em"] = recebido_em
    return limpa


@app.get("/saude")
def saude() -> dict:
    return {"ok": True, "tabela": TABELA or None, "dry_run": DRY_RUN}


@app.post("/eventos")
def receber(lote: Lote, x_painel_token: str = Header(default="")) -> dict:
    if not TOKEN or not hmac.compare_digest(x_painel_token, TOKEN):
        raise HTTPException(status_code=401, detail="token inválido")
    if not lote.rows or len(lote.rows) > MAX_LINHAS:
        raise HTTPException(status_code=422, detail=f"envie de 1 a {MAX_LINHAS} linhas")
    agora = datetime.now(timezone.utc).isoformat()
    linhas = [_limpar(linha, agora) for linha in lote.rows]
    if not DRY_RUN:
        erros = _bigquery().insert_rows_json(TABELA, linhas, row_ids=[l["hash"] for l in linhas])
        if erros:
            raise HTTPException(status_code=502, detail=str(erros)[:500])
    for l in linhas:
        print(json.dumps({
            "severity": "WARNING" if l.get("decisao") == "deny" else "INFO",
            "message": f"{l.get('participante')} · {l.get('evento')} · {l.get('ferramenta') or l.get('resultado') or ''}",
            "tipo": "my-task",
            "participante": l.get("participante"),
            "evento": l.get("evento"),
            "ferramenta": l.get("ferramenta"),
            "decisao": l.get("decisao"),
            "resultado": l.get("resultado"),
            "task": l.get("task"),
        }, ensure_ascii=False), flush=True)
    return {"recebidos": len(linhas)}
