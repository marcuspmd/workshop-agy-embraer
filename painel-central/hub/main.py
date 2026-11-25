"""Hub do painel central: recebe os eventos da my-task de cada participante e grava no BigQuery.

POST /eventos  {"rows": [...]}  com o cabeçalho X-Painel-Token
GET  /saude
GET  /sala?k=<PAINEL_VIEW_TOKEN>                 sala ao vivo da turma (telão)
GET  /api/sala?k=...                             resumo: um card por pessoa
GET  /api/participantes/<nome>?k=...             detalhe de uma pessoa
GET  /api/stream?k=...                           o resumo a cada mudança (Server-Sent Events)
Cada lote também vira log estruturado no Cloud Logging, para o telão acompanhar ao vivo.
"""
import asyncio
import hmac
import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Query, Request
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from sala import Sala

TOKEN = os.environ.get("PAINEL_TOKEN", "")
VIEW_TOKEN = os.environ.get("PAINEL_VIEW_TOKEN", "")
TABELA = os.environ.get("PAINEL_TABELA", "")  # projeto.dataset.tabela
DRY_RUN = os.environ.get("PAINEL_DRY_RUN") == "1"
CAMPOS = {
    "ts", "participante", "projeto_gcp", "workspace", "conversa", "seq", "evento", "ator", "modelo",
    "ferramenta", "decisao", "motivo", "resultado", "arquivos", "pedido", "task", "detalhe", "hash", "prev_hash",
    "task_pasta", "task_status", "task_fase", "task_proximo", "reqs", "criterios_ok", "criterios_total",
}
INTEIROS = {"seq", "reqs", "criterios_ok", "criterios_total"}
MAX_TEXTO = 2000
MAX_LINHAS = 200

app = FastAPI(title="painel-central")
_cliente = None
sala = Sala()
SALA_HTML = Path(__file__).with_name("sala.html")


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
        elif chave in INTEIROS and valor is not None:
            try:
                valor = int(valor)
            except (TypeError, ValueError):
                valor = None
        limpa[chave] = valor
    if not limpa.get("ts") or not limpa.get("hash"):
        raise HTTPException(status_code=422, detail="cada linha precisa de ts e hash")
    limpa["recebido_em"] = recebido_em
    return limpa


def _carregar_sala() -> None:
    """Depois de um reinício, refaz a sala com os eventos das últimas 24 h que já estão no BigQuery."""
    try:
        consulta = (
            f"SELECT * EXCEPT(recebido_em) FROM `{TABELA}` "
            "WHERE ts >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR) ORDER BY ts, seq LIMIT 100000"
        )
        linhas = []
        for r in _bigquery().query(consulta).result():
            linha = dict(r.items())
            linha["ts"] = linha["ts"].isoformat()
            linha["arquivos"] = list(linha.get("arquivos") or [])
            linhas.append(linha)
        sala.adicionar(linhas)
        print(json.dumps({"severity": "INFO", "message": f"sala carregada do BigQuery: {len(linhas)} eventos"}), flush=True)
    except Exception as erro:  # a sala continua com o que chegar ao vivo
        print(json.dumps({"severity": "ERROR", "message": f"sala sem histórico: {erro}"[:500]}), flush=True)
    finally:
        sala.carregada = True


@app.on_event("startup")
def _iniciar() -> None:
    if DRY_RUN or not TABELA:
        sala.carregada = True
        return
    threading.Thread(target=_carregar_sala, daemon=True).start()


def _ver(k: str) -> None:
    if not VIEW_TOKEN or not hmac.compare_digest(k or "", VIEW_TOKEN):
        raise HTTPException(status_code=401, detail="chave da sala inválida")


@app.get("/saude")
def saude() -> dict:
    return {"ok": True, "tabela": TABELA or None, "dry_run": DRY_RUN, "sala": bool(VIEW_TOKEN)}


@app.get("/sala")
def pagina_sala() -> FileResponse:
    # A página em si não tem dados: ela pede tudo à API com a chave que veio na URL (?k=).
    return FileResponse(SALA_HTML, media_type="text/html; charset=utf-8", headers={"Cache-Control": "no-store"})


@app.get("/api/sala")
def api_sala(k: str = Query(default="")) -> dict:
    _ver(k)
    return sala.resumo()


@app.get("/api/participantes/{nome}")
def api_participante(nome: str, k: str = Query(default="")) -> dict:
    _ver(k)
    detalhe = sala.detalhe(nome)
    if detalhe is None:
        raise HTTPException(status_code=404, detail="participante não encontrado")
    return detalhe


@app.get("/api/stream")
async def api_stream(request: Request, k: str = Query(default="")) -> StreamingResponse:
    _ver(k)

    async def eventos():
        visto, ultimo_envio = -1, 0.0
        relogio = asyncio.get_running_loop().time
        yield "retry: 3000\n\n"
        while not await request.is_disconnected():
            # Manda quando algo mudou e, a cada 10 s, mesmo sem mudança: o status "parada" depende do relógio.
            if sala.versao != visto or relogio() - ultimo_envio > 10:
                visto, ultimo_envio = sala.versao, relogio()
                yield f"event: sala\ndata: {json.dumps(sala.resumo(), ensure_ascii=False)}\n\n"
            await asyncio.sleep(0.5)

    return StreamingResponse(eventos(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"})


@app.post("/eventos")
def receber(lote: Lote, x_painel_token: str = Header(default="")) -> dict:
    if not TOKEN or not hmac.compare_digest(x_painel_token, TOKEN):
        raise HTTPException(status_code=401, detail="token inválido")
    if not lote.rows or len(lote.rows) > MAX_LINHAS:
        raise HTTPException(status_code=422, detail=f"envie de 1 a {MAX_LINHAS} linhas")
    agora = datetime.now(timezone.utc).isoformat()
    linhas = [_limpar(linha, agora) for linha in lote.rows]
    if not DRY_RUN:
        erros = _bigquery().insert_rows_json(TABELA, linhas, row_ids=[l["hash"] for l in linhas], ignore_unknown_values=True)
        if erros:
            raise HTTPException(status_code=502, detail=str(erros)[:500])
    sala.adicionar(linhas)
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
