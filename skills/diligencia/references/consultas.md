# Consultas da diligência

Troque `{tabela}`, `{fuso}`, `{nome}` e `{task}` (parte do título da task). Todas usam só `SELECT`.

## Eventos da task, em ordem

```sql
SELECT seq, FORMAT_TIMESTAMP('%H:%M:%S', ts, '{fuso}') AS hora, evento, ferramenta, decisao, resultado,
       ARRAY_TO_STRING(arquivos, ', ') AS arquivos, SUBSTR(pedido, 1, 120) AS pedido, SUBSTR(detalhe, 1, 200) AS detalhe
FROM {tabela}
WHERE LOWER(participante) LIKE LOWER('%{nome}%')
  AND (task LIKE '%{task}%' OR evento IN ('HumanReview', 'QualityGate'))
  AND DATE(ts, '{fuso}') = CURRENT_DATE('{fuso}')
  AND NOT (evento = 'PreToolUse' AND decisao = 'allow')
ORDER BY seq
LIMIT 200
```

## Subagentes acionados

```sql
SELECT FORMAT_TIMESTAMP('%H:%M:%S', ts, '{fuso}') AS hora,
       REGEXP_EXTRACT(detalhe, r'my-task-[a-z-]+') AS subagente
FROM {tabela}
WHERE LOWER(participante) LIKE LOWER('%{nome}%') AND ferramenta = 'invoke_subagent'
  AND task LIKE '%{task}%' AND evento = 'PreToolUse' AND decisao = 'allow'
ORDER BY ts
LIMIT 50
```

## Integridade da cadeia no painel

```sql
WITH ordenado AS (
  SELECT participante, workspace, seq, hash, prev_hash,
         LAG(hash) OVER (PARTITION BY participante, workspace ORDER BY seq) AS hash_anterior,
         LAG(seq) OVER (PARTITION BY participante, workspace ORDER BY seq) AS seq_anterior
  FROM {tabela}
  WHERE LOWER(participante) LIKE LOWER('%{nome}%')
)
SELECT workspace,
       COUNT(*) AS eventos,
       COUNTIF(seq_anterior IS NOT NULL AND seq != seq_anterior + 1) AS buracos_na_sequencia,
       COUNTIF(hash_anterior IS NOT NULL AND prev_hash != hash_anterior) AS elos_quebrados,
       MIN(seq) AS primeiro_seq, MAX(seq) AS ultimo_seq
FROM ordenado
GROUP BY workspace
LIMIT 20
```

Buracos na sequência podem ser eventos ainda na fila de envio: se o último evento for de menos de 1 minuto atrás, diga isso em vez de reprovar.
