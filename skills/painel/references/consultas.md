# Consultas do painel

Troque `{tabela}` pelo nome completo de `tabela_do_painel` (com crases) e `{fuso}` pelo fuso. Todas usam só `SELECT`.

## Quem está ativo agora (últimos 15 minutos)

```sql
SELECT participante,
       FORMAT_TIMESTAMP('%H:%M', MAX(ts), '{fuso}') AS ultimo_evento,
       ARRAY_AGG(STRUCT(evento, ferramenta, task) ORDER BY ts DESC LIMIT 1)[OFFSET(0)] AS ultimo,
       COUNTIF(evento = 'PostToolUse') AS acoes
FROM {tabela}
WHERE ts >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 15 MINUTE)
GROUP BY participante
ORDER BY MAX(ts) DESC
LIMIT 200
```

## Resumo de hoje por pessoa

```sql
SELECT participante,
       COUNT(DISTINCT conversa) AS conversas,
       COUNTIF(evento = 'PostToolUse') AS acoes,
       COUNT(DISTINCT arquivo) AS arquivos_alterados,
       COUNTIF(decisao = 'deny') AS bloqueios,
       COUNTIF(evento = 'QualityGate' AND resultado = 'passou') AS gates_ok,
       COUNTIF(evento = 'QualityGate' AND resultado = 'falhou') AS gates_falhos,
       COUNTIF(evento = 'HumanReview') AS revisoes,
       COUNTIF(ferramenta = 'invoke_subagent') AS subagentes
FROM {tabela} LEFT JOIN UNNEST(arquivos) AS arquivo
WHERE DATE(ts, '{fuso}') = CURRENT_DATE('{fuso}')
GROUP BY participante
ORDER BY acoes DESC
LIMIT 200
```

## Linha do tempo de uma pessoa

```sql
SELECT FORMAT_TIMESTAMP('%H:%M:%S', ts, '{fuso}') AS hora, evento, ferramenta, decisao, resultado,
       ARRAY_TO_STRING(arquivos, ', ') AS arquivos, SUBSTR(pedido, 1, 120) AS pedido, task
FROM {tabela}
WHERE LOWER(participante) LIKE LOWER('%{nome}%')
  AND ts >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 2 HOUR)
  AND evento != 'PreToolUse'
ORDER BY ts DESC
LIMIT 100
```

## Bloqueios

```sql
SELECT FORMAT_TIMESTAMP('%H:%M', ts, '{fuso}') AS hora, participante, ferramenta, motivo, SUBSTR(detalhe, 1, 160) AS tentativa
FROM {tabela}
WHERE decisao = 'deny' AND DATE(ts, '{fuso}') = CURRENT_DATE('{fuso}')
ORDER BY ts DESC
LIMIT 100
```

## Tasks e situação

```sql
SELECT participante, task,
       MIN(ts) AS inicio, MAX(ts) AS ultimo,
       COUNTIF(ferramenta = 'invoke_subagent') AS subagentes,
       ARRAY_AGG(IF(evento = 'QualityGate', resultado, NULL) IGNORE NULLS ORDER BY ts DESC LIMIT 1)[SAFE_OFFSET(0)] AS ultimo_gate,
       COUNTIF(evento = 'HumanReview') > 0 AS revisada
FROM {tabela}
WHERE task IS NOT NULL AND DATE(ts, '{fuso}') = CURRENT_DATE('{fuso}')
GROUP BY participante, task
ORDER BY ultimo DESC
LIMIT 200
```

## Arquivos que a IA mais mexeu hoje

```sql
SELECT arquivo, COUNT(*) AS alteracoes, COUNT(DISTINCT participante) AS pessoas
FROM {tabela}, UNNEST(arquivos) AS arquivo
WHERE evento = 'PostToolUse' AND DATE(ts, '{fuso}') = CURRENT_DATE('{fuso}')
GROUP BY arquivo
ORDER BY alteracoes DESC
LIMIT 20
```
