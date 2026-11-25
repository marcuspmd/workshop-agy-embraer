#!/usr/bin/env python3
"""Simula uma turma usando a my-task e manda os eventos ao hub, para ensaiar a sala ao vivo.

Uso:
  python3 painel-central/simular.py --url <URL do hub> --token <TOKEN> [--pessoas 8] [--velocidade 1]

Cada pessoa simulada faz o caminho do lab: instala a my-task, testa os bloqueios, abre a task
da frota-api, passa pela entrevista, aprova o plano, executa com subagentes, falha e passa no
quality gate, conclui e registra a revisão humana. Os nomes terminam em "(simulação)": apague
a tabela antes do evento (docs/apresentador-projeto-central.md, Parte 7).
Só usa a biblioteca padrão do Python.
"""
import argparse
import hashlib
import json
import random
import threading
import time
import urllib.request
from datetime import datetime, timezone

NOMES = ["Ana Souza", "Bruno Lima", "Carla Dias", "Diego Rocha", "Elisa Prado", "Fábio Nunes",
         "Gabriela Reis", "Henrique Alves", "Isabela Costa", "João Martins", "Karen Ito", "Lucas Moraes"]
PASTA = "frota-api/.my-task/{data}-horas-de-voo"
TITULO = "frota-api: horas de voo por aeronave"
PEDIDO = ("/my-task No projeto frota-api, crie o endpoint GET /api/v1/aeronaves/{matricula}/horas-de-voo, "
          "que devolve o total de horas de voo e de ciclos da aeronave num período.")


class Pessoa:
    def __init__(self, nome, args):
        self.nome, self.args, self.seq, self.prev = f"{nome} (simulação)", args, 0, None
        self.task = None  # campos da task atual, copiados em cada evento

    def esperar(self, a, b):
        time.sleep(random.uniform(a, b) / self.args.velocidade)

    def enviar(self, evento, **campos):
        self.seq += 1
        ts = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        linha = {"ts": ts, "participante": self.nome, "projeto_gcp": "qwiklabs-simulado", "workspace": "workshop-agy-embraer",
                 "conversa": "sim", "seq": self.seq, "evento": evento, "ator": "ai-agent", "modelo": "gemini-3.8-flash",
                 **(self.task or {}), **campos}
        linha["hash"] = hashlib.sha256(f"{self.nome}{self.seq}{ts}{random.random()}".encode()).hexdigest()
        linha["prev_hash"], self.prev = self.prev, linha["hash"]
        corpo = json.dumps({"rows": [linha]}).encode()
        req = urllib.request.Request(f"{self.args.url.rstrip('/')}/eventos", data=corpo, method="POST",
                                     headers={"Content-Type": "application/json", "X-Painel-Token": self.args.token})
        try:
            urllib.request.urlopen(req, timeout=10).read()
        except Exception as erro:  # segue a simulação mesmo se um envio falhar
            print(f"[{self.nome}] falhou: {erro}")

    def ferramenta(self, nome, detalhe=None, arquivos=None, negar=None):
        det = json.dumps(detalhe or {}, ensure_ascii=False)
        self.enviar("PreToolUse", ferramenta=nome, detalhe=det, decisao="deny" if negar else "allow", motivo=negar)
        if negar:
            return
        self.esperar(0.5, 2)
        self.enviar("PostToolUse", ferramenta=nome, detalhe=det, arquivos=arquivos or [])

    def estado(self, status, fase, proximo, ok=0):
        self.task = {"task": TITULO, "task_pasta": PASTA.format(data=datetime.now().date()), "task_status": status,
                     "task_fase": fase, "task_proximo": proximo, "reqs": 5, "criterios_ok": ok, "criterios_total": 5}

    def rodar(self):
        self.esperar(0, 20)
        self.enviar("AuditInstalled", ator="human")
        self.esperar(2, 6)
        self.enviar("PainelConectado", ator="human")
        self.esperar(2, 5)
        self.enviar("SessionStart")
        for motivo in ["a trilha de auditoria só pode ser alterada pelos scripts da my-task",
                       "o .ai/my-task.json só é alterado por uma pessoa",
                       "a revisão humana é registrada pela pessoa, no terminal"]:
            self.esperar(3, 8)
            self.enviar("PostInvocation", pedido="(teste de execução segura)")
            self.ferramenta("run_command", {"CommandLine": "…"}, negar=motivo)
        self.esperar(4, 10)
        self.enviar("PostInvocation", pedido=PEDIDO)
        for f in ["frota-api/db/schema.sql", "frota-api/docs/padroes.md", ".agents/rules/projeto-frota-api.md"]:
            self.esperar(1, 3)
            self.ferramenta("view_file", {"AbsolutePath": f})
        for pergunta in ["O período é fechado nas duas pontas?", "Matrícula inválida devolve 422?", "Aeronave sem voos devolve zero?"]:
            self.esperar(1, 3)
            self.enviar("PreToolUse", ferramenta="ask_question", decisao="allow", detalhe=json.dumps({"question": pergunta}, ensure_ascii=False))
            self.esperar(6, 15)  # a pessoa pensando
            self.enviar("PostToolUse", ferramenta="ask_question", detalhe="{}")
        self.estado("rascunho", "plano", "aguardar a aprovação do plano")
        self.ferramenta("run_command", {"CommandLine": "node .agents/skills/my-task/scripts/new-task.mjs --project frota-api --slug horas-de-voo"})
        self.ferramenta("write_to_file", arquivos=[f"{self.task['task_pasta']}/PLAN.md", f"{self.task['task_pasta']}/DONE.md"])
        self.enviar("Stop")
        self.esperar(8, 20)
        self.enviar("PostInvocation", pedido="aprovo")
        self.estado("em execução", "execução", "subagentes em paralelo")
        self.ferramenta("write_to_file", arquivos=[f"{self.task['task_pasta']}/STATE.md"])
        for sub in ["my-task-test-writer", "my-task-implementer"]:
            self.esperar(0.5, 1.5)
            self.enviar("PreToolUse", ferramenta="invoke_subagent", decisao="allow", detalhe=json.dumps({"agent": sub}))
        for arq in ["frota-api/tests/test_horas_de_voo.py", "frota-api/app/routers/aeronaves.py",
                    "frota-api/app/services/aeronaves.py", "frota-api/app/repositories/aeronaves.py"]:
            self.esperar(3, 9)
            self.ferramenta("write_to_file", arquivos=[arq])
        for sub in ["my-task-test-writer", "my-task-implementer"]:
            self.enviar("PostToolUse", ferramenta="invoke_subagent", detalhe=json.dumps({"agent": sub}))
        self.estado("em execução", "execução — integração", "rodar os testes", ok=1)
        self.ferramenta("run_command", {"CommandLine": "./scripts/testes.sh"})
        self.enviar("Stop")
        if random.random() < 0.6:
            self.enviar("QualityGate", resultado="falhou")
            self.esperar(3, 8)
            self.ferramenta("replace_file_content", arquivos=["frota-api/app/services/aeronaves.py"])
            self.ferramenta("run_command", {"CommandLine": "./scripts/testes.sh"})
            self.enviar("Stop")
        self.enviar("QualityGate", resultado="passou")
        self.enviar("GoalCheck", detalhe=json.dumps({"falta": ["my-task-verifier não foi acionado"], "continuacao": 1}, ensure_ascii=False))
        self.estado("em execução", "verificação", "acionar o my-task-verifier", ok=3)
        self.enviar("PreToolUse", ferramenta="invoke_subagent", decisao="allow", detalhe=json.dumps({"agent": "my-task-verifier"}))
        self.esperar(8, 18)
        self.enviar("PostToolUse", ferramenta="invoke_subagent", detalhe=json.dumps({"agent": "my-task-verifier"}))
        self.estado("em execução", "relatório", "gerar o AUDIT.md e o REPORT.md", ok=5)
        self.ferramenta("run_command", {"CommandLine": "node .agents/skills/my-task/scripts/audit-report.mjs"})
        self.estado("concluído", "concluída", "revisão humana no terminal", ok=5)
        self.ferramenta("write_to_file", arquivos=[f"{self.task['task_pasta']}/REPORT.md", f"{self.task['task_pasta']}/STATE.md"])
        self.enviar("Stop")
        self.enviar("QualityGate", resultado="passou")
        if random.random() < 0.7:
            self.esperar(15, 40)
            self.enviar("HumanReview", ator="human", resultado=random.choice(["aprovado", "aprovado", "aprovado-com-ressalvas"]))
        print(f"[{self.nome}] terminou")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--url", required=True)
    p.add_argument("--token", required=True)
    p.add_argument("--pessoas", type=int, default=8)
    p.add_argument("--velocidade", type=float, default=1.0, help="2 = duas vezes mais rápido")
    args = p.parse_args()
    nomes = random.sample(NOMES, min(args.pessoas, len(NOMES)))
    threads = [threading.Thread(target=Pessoa(n, args).rodar) for n in nomes]
    for t in threads:
        t.start()
    for t in threads:
        t.join()


if __name__ == "__main__":
    main()
