# Referência de código ADK para o agente do painel

Padrões testados com o ADK 2.15 para o agente `painel-agent`. O `agy` segue esta referência por causa da rule do projeto `.agents/rules/projeto-painel-agent.md`.

## 1. Carregar as duas skills de dentro do pacote

```python
import os
from pathlib import Path

from google.adk.skills import load_skill_from_dir
from google.adk.tools import skill_toolset

SKILLS_DIR = Path(__file__).parent / "skills"

painel = load_skill_from_dir(SKILLS_DIR / "painel")
diligencia = load_skill_from_dir(SKILLS_DIR / "diligencia")

skills = skill_toolset.SkillToolset(skills=[painel, diligencia])
```

As pastas das skills são cópias de `skills/` da raiz do repositório para `painel-agent/app/skills/`. Nada de `../` nem symlink: o Agent Runtime empacota só o pacote do agente.

## 2. Ferramenta tabela_do_painel

Diz ao agente qual tabela ler, a partir do `.env`. Assim o mesmo código serve para o seu projeto e para o projeto central do apresentador. Nunca levanta exceção.

```python
def tabela_do_painel() -> dict:
    """Projeto, dataset, tabela e fuso do painel.

    Returns:
        dict com projeto, tabela (nome completo, com crases, para usar no SQL) e fuso, ou {"erro": "..."}.
    """
    projeto = os.getenv("PAINEL_PROJECT", "").strip()
    dataset = os.getenv("PAINEL_DATASET", "auditoria_ia").strip()
    if not projeto:
        return {"erro": "PAINEL_PROJECT não definido no .env do agente"}
    return {
        "projeto": projeto,
        "tabela": f"`{projeto}.{dataset}.eventos`",
        "fuso": os.getenv("PAINEL_FUSO", "America/Sao_Paulo"),
    }
```

## 3. MCP do BigQuery no agente

O servidor MCP remoto do BigQuery autentica com OAuth do Google. O `header_provider` gera um token novo a cada chamada, com as credenciais do ambiente: as suas no Cloud Shell e a conta de serviço do Agent Runtime depois do deploy.

```python
import google.auth
import google.auth.transport.requests
from google.adk.tools.mcp_tool.mcp_session_manager import StreamableHTTPConnectionParams
from google.adk.tools.mcp_tool.mcp_toolset import McpToolset

BIGQUERY_SCOPE = "https://www.googleapis.com/auth/bigquery"


def _cabecalho_google(_contexto) -> dict[str, str]:
    credenciais, _ = google.auth.default(scopes=[BIGQUERY_SCOPE])
    credenciais.refresh(google.auth.transport.requests.Request())
    return {"Authorization": f"Bearer {credenciais.token}"}


bigquery = McpToolset(
    connection_params=StreamableHTTPConnectionParams(url="https://bigquery.googleapis.com/mcp"),
    tool_filter=["execute_sql_readonly", "get_table_info"],  # só leitura
    header_provider=_cabecalho_google,
)
```

O `tool_filter` é parte da execução segura: o painel recebe só a consulta somente leitura (`execute_sql_readonly` aceita apenas `SELECT`) e a descrição da tabela, nunca `execute_sql`.

## 4. Montar o agente

```python
from google.adk import Agent

root_agent = Agent(
    name="painel_agent",
    model=os.getenv("MODEL", "gemini-3.8-flash"),
    instruction=(
        "Você é o painel do time: mostra como cada pessoa está usando a IA (a skill my-task no Antigravity) "
        "e se o processo foi seguido. Para saber a tabela, chame tabela_do_painel. "
        "Para perguntas de atividade, siga a skill painel; para pareceres, a skill diligencia. "
        "Consulte só com execute_sql_readonly, usando o projeto de tabela_do_painel. Responda em pt-BR."
    ),
    tools=[skills, tabela_do_painel, bigquery],
)
```

## 5. Variáveis do .env

```text
GOOGLE_GENAI_USE_VERTEXAI=TRUE
GOOGLE_CLOUD_PROJECT=<projeto>
GOOGLE_CLOUD_LOCATION=global
MODEL=gemini-3.8-flash
PAINEL_PROJECT=<projeto onde está a tabela auditoria_ia.eventos>
PAINEL_DATASET=auditoria_ia
```

No seu projeto, `PAINEL_PROJECT` é o seu próprio projeto. No projeto central, o apresentador usa o projeto central e o painel mostra a turma inteira.
