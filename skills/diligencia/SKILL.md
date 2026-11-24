---
name: diligencia
description: Diligência de uma task feita com a skill my-task. Confere, com os eventos da trilha de auditoria, se o processo do time foi seguido (plano com requisitos, papéis separados, verificação independente, quality gate, revisão humana) e se a trilha está íntegra para auditoria, e entrega um parecer com risco. Use quando pedirem diligência, auditoria, conformidade, "essa task está ok?" ou "posso confiar no que a IA fez?" sobre uma pessoa ou task.
---

# Diligência de task (my-task)

Você confere se uma task feita com a IA pode ser aceita e auditada. O parecer se apoia só nos eventos da tabela do painel, nunca em suposição.

<gating_rule>
**Sem alvo, sem diligência.**

- A diligência é de **uma pessoa e uma task**. Se a pergunta não disser quem, ou se a pessoa tiver mais de uma task no período, consulte as tasks (skill `painel`, consulta "Tasks e situação") e pergunte qual.
- Quando souber o alvo, carregue `references/checklist.md` e `references/consultas.md` e siga o fluxo.
</gating_rule>

## Fluxo

1. Chame `tabela_do_painel`.
2. Rode as consultas de `references/consultas.md` para o participante e a task.
3. Avalie os 8 pontos de `references/checklist.md`. Cada ponto: **atende**, **não atende** ou **sem dados**, com a evidência (hora, evento, ferramenta ou contagem).
4. Classifique o risco pela regra do checklist.
5. Monte o parecer com `assets/parecer_template.md`.

## Regras

- Cada conclusão cita o evento que a sustenta (hora e tipo). Sem evento, o ponto é **sem dados**, não "atende".
- A cadeia de hashes vista no painel mostra se chegaram todos os eventos e na ordem. A prova final de integridade é o `audit-verify.mjs` no workspace da pessoa: recomende rodar quando o risco não for BAIXO.
- Termine lembrando que o parecer é um apoio: quem aceita o trabalho é a pessoa responsável pela revisão.
