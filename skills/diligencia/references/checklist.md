# Checklist de diligência — 8 pontos

| # | Ponto | Atende quando |
|---|---|---|
| 1 | **Plano com requisitos** | Existe um `PostToolUse` com um `PLAN.md` em `arquivos` antes da primeira escrita de código da task. |
| 2 | **Execução depois do plano** | Existe um `PostInvocation` com `/goal` em `pedido` depois do plano. |
| 3 | **Papéis separados** | Há `invoke_subagent` com `my-task-test-writer` e com `my-task-implementer` em `detalhe`. |
| 4 | **Verificação independente** | Há `invoke_subagent` com `my-task-verifier` depois da implementação. |
| 5 | **Quality gate** | O último `QualityGate` da task tem `resultado = 'passou'`. |
| 6 | **Bloqueios respeitados** | Nenhum bloqueio (`decisao = 'deny'`) foi seguido de nova tentativa com a mesma ferramenta e o mesmo motivo em menos de 2 minutos. Bloqueios em si não reprovam: mostram que a execução segura funcionou. |
| 7 | **Revisão humana** | Existe um `HumanReview` depois do último `PostToolUse` com arquivos da task. |
| 8 | **Trilha íntegra no painel** | Para a pessoa e o workspace, `seq` é contínuo e cada `prev_hash` é igual ao `hash` da linha anterior. |

## Risco

- **ALTO:** ponto 5, 7 ou 8 não atende ou está sem dados.
- **MÉDIO:** sem ponto alto, mas algum dos pontos 1 a 4 ou 6 não atende ou está sem dados.
- **BAIXO:** os 8 pontos atendem.
