"""Estado ao vivo da turma, para a sala do telão (/sala).

Cada lote que chega em POST /eventos entra aqui. O estado fica em memória (o hub roda com uma
instância só) e é reconstruído do BigQuery quando o serviço reinicia. Daqui saem:
- o resumo da sala: um card por pessoa, com o que a IA está fazendo, a etapa e o progresso;
- o detalhe de uma pessoa: task atual, tasks feitas, subagentes, bloqueios e a linha do tempo.
"""
from __future__ import annotations

import json
import re
import threading
import unicodedata
from datetime import datetime, timezone

ETAPAS = ["Entrevista", "Plano", "Execução", "Verificação", "Concluída", "Revisada"]
MAX_EVENTOS_POR_PESSOA = 3000
TRABALHANDO_ATE_S = 180  # sem evento novo por mais que isso, a IA conta como parada
INATIVA_APOS_S = 15 * 60
ESCRITA = {"write_to_file", "replace_file_content", "multi_replace_file_content"}
SUBAGENTE = re.compile(r"my-task-[a-z][a-z-]*[a-z]")
COMANDO_MYTASK = re.compile(r"^\s*/my-task\s+(?!init\b|status\b|audit\b|config\b)\S", re.I)


def _norm(texto: str | None) -> str:
    if not texto:
        return ""
    sem_acento = unicodedata.normalize("NFD", texto)
    return "".join(c for c in sem_acento if unicodedata.category(c) != "Mn").lower().strip()


def _ts(valor) -> datetime:
    if isinstance(valor, datetime):
        return valor if valor.tzinfo else valor.replace(tzinfo=timezone.utc)
    try:
        dt = datetime.fromisoformat(str(valor).replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return datetime.fromtimestamp(0, timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _detalhe(evento: dict):
    bruto = evento.get("detalhe")
    if not bruto:
        return None
    try:
        return json.loads(bruto)
    except (TypeError, ValueError):
        return bruto


def _primeiro_texto(valor, chaves=("CommandLine", "command", "cmd", "Command", "question", "Question", "prompt", "message")):
    """O texto mais útil dos argumentos de uma ferramenta: o comando, a pergunta, a mensagem."""
    if isinstance(valor, dict):
        for chave in chaves:
            v = valor.get(chave)
            if isinstance(v, str) and v.strip():
                return v
            if isinstance(v, dict) and v.get("preview"):
                return v["preview"]
        for v in valor.values():
            achado = _primeiro_texto(v, chaves)
            if achado:
                return achado
    elif isinstance(valor, list):
        for v in valor:
            achado = _primeiro_texto(v, chaves)
            if achado:
                return achado
    return None


def _subagentes(evento: dict) -> list[str]:
    return sorted(set(SUBAGENTE.findall(evento.get("detalhe") or "")))


def _curto(texto: str | None, n: int = 140) -> str | None:
    if not texto:
        return None
    texto = " ".join(str(texto).split())
    return texto if len(texto) <= n else texto[: n - 1] + "…"


def _arquivos(evento: dict) -> list[str]:
    return [a.split("/")[-1] for a in (evento.get("arquivos") or [])]


def descrever(evento: dict) -> dict | None:
    """Uma linha legível da linha do tempo, ou None para eventos que só fazem barulho."""
    ev = evento.get("evento")
    ferramenta = evento.get("ferramenta") or ""
    tipo, texto = "info", None
    if ev == "PreToolUse":
        if evento.get("decisao") == "deny":
            tipo, texto = "bloqueio", f"Bloqueado: {ferramenta} — {evento.get('motivo') or 'sem motivo'}"
        elif ferramenta == "invoke_subagent":
            nomes = ", ".join(_subagentes(evento)) or "subagente"
            tipo, texto = "subagente", f"Acionou {nomes}"
        elif ferramenta == "ask_question":
            tipo, texto = "pergunta", f"Perguntou: {_curto(_primeiro_texto(_detalhe(evento)), 160) or '(pergunta à pessoa)'}"
        else:
            return None
    elif ev == "PostToolUse":
        if ferramenta in ESCRITA:
            tipo, texto = "codigo", f"Editou {', '.join(_arquivos(evento)[:4]) or 'arquivos'}"
        elif ferramenta == "run_command":
            tipo, texto = "comando", f"Rodou: {_curto(_primeiro_texto(_detalhe(evento)), 120) or 'um comando'}"
        elif ferramenta in ("invoke_subagent", "ask_question"):
            return None
        else:
            tipo, texto = "ferramenta", f"Usou {ferramenta or 'uma ferramenta'}"
    elif ev == "PostInvocation":
        tipo, texto = "pessoa", f"Pessoa: {_curto(evento.get('pedido'), 160) or '(mensagem)'}"
    elif ev == "SessionStart":
        tipo, texto = "sessao", "Nova sessão do agy"
    elif ev == "Stop":
        tipo, texto = "sessao", "A IA encerrou o turno"
    elif ev == "QualityGate":
        r = evento.get("resultado")
        tipo, texto = ("gate-ok" if r == "passou" else "gate-falhou"), f"Quality gate: {r}"
    elif ev == "GoalCheck":
        falta = _detalhe(evento)
        falta = falta.get("falta") if isinstance(falta, dict) else None
        tipo, texto = "goal", "Modo goal: continua" + (f" (falta: {_curto('; '.join(falta), 120)})" if falta else "")
    elif ev == "HumanReview":
        tipo, texto = "revisao", f"Revisão humana: {evento.get('resultado') or 'registrada'}"
    elif ev == "PainelConectado":
        tipo, texto = "sessao", "Ligou o painel"
    elif ev == "AuditInstalled":
        tipo, texto = "sessao", "Instalou a my-task"
    elif ev == "StandardsRefreshed":
        tipo, texto = "sessao", "Atualizou as diretrizes do time"
    else:
        return None
    return {"ts": evento["ts"], "tipo": tipo, "texto": texto}


def _iniciais(nome: str) -> str:
    partes = [p for p in re.split(r"\s+", re.sub(r"\(.*?\)", "", nome).strip()) if p and p[0].isalnum()]
    if not partes:
        return "?"
    if len(partes) == 1:
        return partes[0][:2].upper()
    return (partes[0][0] + partes[-1][0]).upper()


class Sala:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._eventos: dict[str, list[dict]] = {}
        self._hashes: set[str] = set()
        self.versao = 0
        self.carregada = False

    # ---------------------------------------------------------------- entrada
    def adicionar(self, linhas: list[dict]) -> int:
        novos = 0
        with self._lock:
            tocados = set()
            for linha in linhas:
                h = linha.get("hash")
                if not h or h in self._hashes:
                    continue
                self._hashes.add(h)
                ev = dict(linha)
                ev["_dt"] = _ts(ev.get("ts"))
                ev["ts"] = _iso(ev["_dt"])
                nome = (ev.get("participante") or "sem nome").strip() or "sem nome"
                ev["participante"] = nome
                self._eventos.setdefault(nome, []).append(ev)
                tocados.add(nome)
                novos += 1
            for nome in tocados:
                lista = self._eventos[nome]
                lista.sort(key=lambda e: (e["_dt"], e.get("seq") or 0))
                if len(lista) > MAX_EVENTOS_POR_PESSOA:
                    del lista[: len(lista) - MAX_EVENTOS_POR_PESSOA]
            if novos:
                self.versao += 1
        return novos

    # ---------------------------------------------------------------- análise
    @staticmethod
    def _status_ia(eventos: list[dict], agora: datetime) -> tuple[str, str]:
        ultimo = eventos[-1]
        idade = (agora - ultimo["_dt"]).total_seconds()
        if idade > INATIVA_APOS_S:
            return "inativa", f"sem atividade há {int(idade // 60)} min"
        ev, ferramenta = ultimo.get("evento"), ultimo.get("ferramenta")
        if ev == "HumanReview":
            return "parada", f"revisão registrada: {ultimo.get('resultado') or 'ok'}"
        if ultimo.get("ator") == "human":
            return "parada", "a pessoa está no terminal"
        if ev == "PreToolUse" and ferramenta == "ask_question":
            return "esperando", "esperando a resposta da pessoa"
        if ev == "QualityGate" and ultimo.get("resultado") == "falhou":
            return "trabalhando", "testes falharam: corrigindo"
        if ev == "GoalCheck":
            return "trabalhando", "modo goal: continuando a task"
        if ev in ("Stop", "QualityGate"):
            if _norm(ultimo.get("task_status")).startswith("conclu"):
                return "esperando", "task concluída: falta a revisão humana"
            if _norm(ultimo.get("task_status")) == "rascunho":
                return "esperando", "plano pronto: esperando a aprovação"
            return "esperando", "terminou o turno: aguardando a pessoa"
        if idade > TRABALHANDO_ATE_S:
            return "parada", f"parada há {int(idade // 60)} min"
        if ev == "PreToolUse" and ultimo.get("decisao") == "deny":
            return "trabalhando", "acabou de ser bloqueada"
        if ev == "PreToolUse" and ferramenta == "invoke_subagent":
            return "trabalhando", f"acionando {', '.join(_subagentes(ultimo)) or 'subagente'}"
        if ev == "PreToolUse" and ferramenta == "run_command":
            return "trabalhando", "rodando um comando"
        if ev == "PostInvocation":
            return "trabalhando", "lendo a mensagem da pessoa"
        if ev == "SessionStart":
            return "trabalhando", "abriu uma sessão do agy"
        if ferramenta in ESCRITA:
            return "trabalhando", "escrevendo código"
        return "trabalhando", f"usando {ferramenta}" if ferramenta else "trabalhando"

    @staticmethod
    def _tasks(eventos: list[dict]) -> list[dict]:
        tasks: dict[str, dict] = {}
        for e in eventos:
            pasta = e.get("task_pasta")
            if pasta:
                t = tasks.setdefault(pasta, {
                    "pasta": pasta, "titulo": e.get("task") or pasta, "inicio": e["ts"], "_inicio": e["_dt"],
                    "gates_ok": 0, "gates_falha": 0, "bloqueios": 0, "acoes": 0, "subagentes": set(),
                    "arquivos": set(), "revisao": None, "_concluida_em": None,
                })
                t.update({
                    "titulo": e.get("task") or t["titulo"], "status": e.get("task_status"), "fase": e.get("task_fase"),
                    "proximo": e.get("task_proximo"), "reqs": e.get("reqs"), "criterios_ok": e.get("criterios_ok"),
                    "criterios_total": e.get("criterios_total"), "fim": e["ts"],
                })
                st = _norm(e.get("task_status"))
                if st.startswith("conclu") and not t["_concluida_em"]:
                    t["_concluida_em"] = e["_dt"]
                elif not st.startswith("conclu"):
                    t["_concluida_em"] = None
                ev = e.get("evento")
                if ev == "QualityGate":
                    t["gates_ok" if e.get("resultado") == "passou" else "gates_falha"] += 1
                if ev == "PreToolUse" and e.get("decisao") == "deny":
                    t["bloqueios"] += 1
                if ev == "PostToolUse":
                    t["acoes"] += 1
                    t["arquivos"].update(e.get("arquivos") or [])
                if e.get("ferramenta") == "invoke_subagent":
                    t["subagentes"].update(_subagentes(e))
            if e.get("evento") == "HumanReview":
                # A revisão vale para a task concluída mais recente antes dela.
                candidatas = [t for t in tasks.values() if t["_concluida_em"] and t["_concluida_em"] <= e["_dt"]]
                if candidatas:
                    alvo = max(candidatas, key=lambda t: t["_concluida_em"])
                    alvo["revisao"] = {"decisao": e.get("resultado"), "ts": e["ts"]}
        saida = []
        for t in tasks.values():
            t["etapa"] = Sala._etapa_task(t)
            t["subagentes"] = sorted(t["subagentes"])
            t["arquivos"] = len(t["arquivos"])
            saida.append({k: v for k, v in t.items() if not k.startswith("_")})
        return sorted(saida, key=lambda t: t["fim"], reverse=True)

    @staticmethod
    def _etapa_task(t: dict) -> int:
        st, fase = _norm(t.get("status")), _norm(t.get("fase"))
        if t.get("revisao"):
            return 5
        if st.startswith("conclu") or st.startswith("bloque") or st.startswith("cancel"):
            return 4
        if "execu" in st:
            return 3 if "verific" in fase or "relat" in fase else 2
        return 1  # rascunho: plano escrito, esperando aprovação

    def _pedido_novo(self, eventos: list[dict], tasks: list[dict]) -> dict | None:
        """Um /my-task <pedido> mais novo que a task atual: a pessoa está na entrevista de uma task nova."""
        pedido = next((e for e in reversed(eventos) if e.get("evento") in ("PostInvocation", "SessionStart")
                       and COMANDO_MYTASK.match(e.get("pedido") or "")), None)
        if not pedido:
            return None
        if tasks and tasks[0]["inicio"] >= pedido["ts"]:
            return None
        return pedido

    def _card(self, nome: str, eventos: list[dict], agora: datetime) -> dict:
        status, status_texto = self._status_ia(eventos, agora)
        tasks = self._tasks(eventos)
        novo = self._pedido_novo(eventos, tasks)
        atual = tasks[0] if tasks else None
        if novo:
            etapa, titulo, progresso = 0, _curto(re.sub(r"^\s*/my-task\s+", "", novo.get("pedido") or ""), 120), None
        elif atual:
            etapa, titulo = atual["etapa"], atual["titulo"]
            progresso = {"ok": atual.get("criterios_ok") or 0, "total": atual.get("criterios_total") or 0}
        else:
            etapa, titulo, progresso = None, None, None
        ultimo_bloqueio = next((e for e in reversed(eventos) if e.get("decisao") == "deny"), None)
        ultima = next((d for d in (descrever(e) for e in reversed(eventos)) if d), None)
        return {
            "nome": nome,
            "iniciais": _iniciais(nome),
            "status": status,
            "status_texto": status_texto,
            "etapa": etapa,
            "etapa_nome": ETAPAS[etapa] if etapa is not None else None,
            "task_status": (atual or {}).get("status") if not novo else "entrevista",
            "task": titulo,
            "progresso": progresso,
            "ultima_ts": eventos[-1]["ts"],
            "ultima_acao": ultima,
            "bloqueios": sum(1 for e in eventos if e.get("decisao") == "deny"),
            "bloqueio_recente": bool(ultimo_bloqueio and (agora - ultimo_bloqueio["_dt"]).total_seconds() < 60),
            "tasks_concluidas": sum(1 for t in tasks if t["etapa"] >= 4 and _norm(t.get("status")).startswith("conclu")),
            "revisadas": sum(1 for t in tasks if t.get("revisao")),
        }

    # ---------------------------------------------------------------- saída
    def resumo(self) -> dict:
        agora = datetime.now(timezone.utc)
        with self._lock:
            cards = [self._card(n, ev, agora) for n, ev in self._eventos.items() if ev]
            versao = self.versao
        cards.sort(key=lambda c: _norm(c["nome"]))
        contar = lambda status: sum(1 for c in cards if c["status"] == status)  # noqa: E731
        return {
            "agora": _iso(agora),
            "versao": versao,
            "carregada": self.carregada,
            "etapas": ETAPAS,
            "totais": {
                "pessoas": len(cards),
                "trabalhando": contar("trabalhando"),
                "esperando": contar("esperando"),
                "paradas": contar("parada") + contar("inativa"),
                "em_execucao": sum(1 for c in cards if c["etapa"] in (2, 3)),
                "concluidas": sum(c["tasks_concluidas"] for c in cards),
                "revisadas": sum(c["revisadas"] for c in cards),
                "bloqueios": sum(c["bloqueios"] for c in cards),
            },
            "participantes": cards,
        }

    def detalhe(self, nome: str) -> dict | None:
        agora = datetime.now(timezone.utc)
        with self._lock:
            eventos = list(self._eventos.get(nome) or [])
        if not eventos:
            return None
        card = self._card(nome, eventos, agora)
        tasks = self._tasks(eventos)
        ultimo = eventos[-1]
        sessao = max((i for i, e in enumerate(eventos) if e.get("evento") == "SessionStart"), default=0)
        pendentes: dict[str, int] = {}
        for e in eventos[sessao:]:
            if e.get("ferramenta") != "invoke_subagent":
                continue
            for s in _subagentes(e):
                if e.get("evento") == "PreToolUse" and e.get("decisao") != "deny":
                    pendentes[s] = pendentes.get(s, 0) + 1
                elif e.get("evento") == "PostToolUse" and pendentes.get(s):
                    pendentes[s] -= 1
        linha = [d for d in (descrever(e) for e in eventos) if d]
        return {
            "agora": _iso(agora),
            "card": card,
            "ambiente": {
                "workspace": ultimo.get("workspace"),
                "projeto_gcp": ultimo.get("projeto_gcp"),
                "modelo": next((e.get("modelo") for e in reversed(eventos) if e.get("modelo")), None),
                "primeira_ts": eventos[0]["ts"],
            },
            "atual": tasks[0] if tasks and card["etapa"] != 0 else None,
            "proximo": (tasks[0] if tasks and card["etapa"] != 0 else {}).get("proximo"),
            "subagentes_ativos": sorted(s for s, n in pendentes.items() if n > 0) if card["status"] == "trabalhando" else [],
            "tasks": tasks,
            "contagens": {
                "acoes": sum(1 for e in eventos if e.get("evento") == "PostToolUse"),
                "arquivos": len({a for e in eventos for a in (e.get("arquivos") or [])}),
                "bloqueios": card["bloqueios"],
                "gates_ok": sum(1 for e in eventos if e.get("evento") == "QualityGate" and e.get("resultado") == "passou"),
                "gates_falha": sum(1 for e in eventos if e.get("evento") == "QualityGate" and e.get("resultado") == "falhou"),
                "sessoes": sum(1 for e in eventos if e.get("evento") == "SessionStart"),
            },
            "bloqueios": [
                {"ts": e["ts"], "ferramenta": e.get("ferramenta"), "motivo": e.get("motivo")}
                for e in reversed(eventos) if e.get("decisao") == "deny"
            ][:20],
            "linha_do_tempo": linha[-60:][::-1],
        }
