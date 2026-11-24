# Auditoria da my-task

## O que é registrado em `.audit/log.jsonl`

| Evento | Quando | O que guarda |
|---|---|---|
| `AuditInstalled` / `StandardsRefreshed` | `init.mjs` | Quem instalou, hash do config, arquivos gerados com hash |
| `SessionStart` | Toda sessão nova do `agy` | Prompt, workspace, **padrões em vigor**: hash do config, da skill, de cada rule e de cada agente |
| `PostInvocation` | Toda chamada ao modelo | Modelo, número da chamada, prompt atual |
| `PreToolUse` | Antes de cada ferramenta | Ferramenta, argumentos resumidos (textos longos viram hash), decisão (`allow`/`deny`) e motivo |
| `PostToolUse` | Depois de cada ferramenta | Erro, se houve, e **hash de cada arquivo alterado** |
| `Stop` | Quando o agente encerra | Motivo, transcrição arquivada com hash |
| `QualityGate` | No `Stop`, quando já existem arquivos de teste no workspace | Comando, resultado (passou, falhou ou inconclusivo), final da saída, tentativa |
| `HumanReview` | `audit-review.mjs` | Revisor, decisão, observações, hash do último evento revisado e de cada arquivo |
| `PainelConectado` | `conectar-painel.mjs` | Nome no painel, projeto do BigQuery e se o painel central está ligado |

Chamadas a ferramentas de servidores MCP  entram como `PreToolUse`/`PostToolUse` e aparecem no relatório na seção **Ferramentas externas (MCP)**.

## Painel do time (telemetria)

Depois de `conectar-painel.mjs`, cada evento gravado na trilha também entra numa fila (`.audit/outbox.jsonl`). Um processo em segundo plano (`shipper.mjs`) envia a fila para a tabela `auditoria_ia.eventos` do BigQuery do projeto e, se configurado, para o painel central do time (um serviço no Cloud Run que grava no BigQuery central e no Cloud Logging). O envio nunca trava o `agy`: se falhar, a fila espera e a próxima ação tenta de novo. Vai para o painel o resumo do evento (ferramenta, decisão, arquivos, pedido curto, task, hashes), nunca o conteúdo dos arquivos. `status.mjs` mostra o que ainda está na fila.

Cada linha leva o hash da anterior. Alterar, apagar ou inserir uma linha quebra a cadeia, e `audit-verify.mjs` aponta onde. Segredos comuns (chaves de API, tokens, senhas, chaves privadas) são removidos antes de gravar.

## O que é bloqueado

Fixo (não depende do config):

- escrever em `.audit/`, `.agents/` ou `.ai/my-task.json`, por ferramenta ou por comando de terminal;
- rodar `audit-review.mjs`, `init.mjs` ou `conectar-painel.mjs` pelo agente.

Pelo config:

- comandos em `policy.blocked_commands` (por padrão, inclui apagar a trilha no BigQuery e objetos no Cloud Storage);
- ferramentas em `policy.blocked_tools` (por padrão, `delete_object` e `delete_bucket` de servidores MCP);
- instalar dependências (`uv add`, `pip install`, `npm install <pacote>`) quando `standards.allow_dependencies` é `false`;
- acionar subagentes quando `agents.enabled` é `false`.

## Limites (diga isso a quem perguntar)

- É uma demonstração do tipo de evidência que um time consegue gerar. Não certifica nada e não substitui processos como ED-12C/DO-178C nem a qualificação de ferramentas (ED-215/DO-330).
- Os bloqueios cobrem os caminhos óbvios. Um agente ou uma pessoa com acesso à máquina ainda consegue apagar o arquivo ou reescrever a cadeia inteira recalculando os hashes. A cadeia prova que nada mudou **desde a última âncora confiável**, como o hash gravado na revisão humana.
- A cópia da trilha no BigQuery e no painel central fica fora da máquina: quem reescrever a trilha local não reescreve o que já foi enviado. Em produção, a tabela central teria retenção travada, assinatura e controle de acesso.
- Os nomes dos argumentos das ferramentas não são documentados. O hook descobre os caminhos de arquivo por aproximação; se o `AUDIT.md` vier sem hashes de arquivos, ajuste o `audit-hook.mjs`.
