# Primeiros passos com o Antigravity: do SDLC governado ao agente em produção

## Informações do Laboratório

- **Tempo estimado:** 1 hora 30 minutos
- **Nível:** `Intermediate`
- **Evento:** [Embraer] Antigravity Labs — Google Cloud & IEBT

---

## Visão Geral

Neste laboratório prático, você usa o **Antigravity CLI (`agy`)** como ambiente de desenvolvimento agentic, junto com o **Agent Development Kit (ADK)**, o **Model Context Protocol (MCP)** e o **Google Agent Platform** (Agent Runtime e Gemini Enterprise App).

Você instala no `agy` a skill **`my-task`**, que faz a IA **planejar e codificar qualquer task** seguindo as regras do time: entrevista, plano com requisitos, subagentes com papéis separados, quality gate, verificador independente e revisão humana. Cada ação da IA vira evidência numa **trilha de auditoria** com cadeia de hashes, que também vai para o **BigQuery** e para o **painel da turma**, ao vivo no telão. Com a `my-task`, você codifica uma API num repositório de exemplo e, depois, constrói o **agente Painel**: um agente ADK com duas skills e o **MCP do BigQuery**, publicado no **Agent Runtime** e no **Gemini Enterprise**, que mostra como cada pessoa está usando a IA e faz a **diligência** de cada task.

### Arquitetura e fluxo do laboratório

1. **Cloud Shell:** o `agy` e o `agents-cli` rodam no terminal, dentro do repositório do lab.
2. **Regras e execução segura:** a `my-task` instala rules, hooks e subagentes, e você liga o envio da trilha para o painel.
3. **Codificação governada:** no projeto `frota-api` (com DDL, configurações e padrões do time), a `my-task` planeja e codifica uma API nova.
4. **Cenário 1:** com a mesma `my-task`, o `agy` constrói o agente Painel com duas ADK Skills e o MCP do BigQuery; você valida no **ADK Web**.
5. **Cenário 2:** o `agents-cli` publica o agente no **Agent Runtime** e você o conecta a um **Gemini Enterprise App**.
6. **Governança:** você confere a integridade da trilha, registra a revisão humana e vê a turma inteira no painel central.

### Modelo Mental: do desenvolvimento tradicional ao mundo de agentes

| Conceito no Laboratório | Equivalente no Desenvolvimento Tradicional | Papel no Laboratório |
| :--- | :--- | :--- |
| **Antigravity CLI (`agy`)** | Par programador no terminal | Gera código, roda comandos e orquestra o trabalho no Cloud Shell. |
| **Skill `my-task`** | Playbook do time | O fluxo governado para planejar e codificar qualquer task, com trilha de auditoria. |
| **Regras de workspace (rules)** | Guia de estilo e padrões de arquitetura | Padrões da `my-task` e as regras de cada projeto, que o `agy` segue sempre. |
| **Hooks** | Git hooks / middleware de auditoria | Registram cada ação da IA, bloqueiam o que não pode e rodam os testes no encerramento. |
| **Trilha e painel** | Log de auditoria e observabilidade | Cada evento vai para o BigQuery do seu projeto e para o painel da turma. |
| **Google ADK** | Framework backend (FastAPI, Express) | Estrutura o agente Painel em Python. |
| **ADK Skills (`SKILL.md`)** | Manuais de negócio e de compliance | O que o Painel sabe fazer: mostrar a atividade do time e fazer a diligência de uma task. |
| **MCP do BigQuery** | Conector padronizado de APIs | Dá ao Painel acesso somente leitura à trilha no BigQuery. |
| **`agents-cli`** | Ferramenta de build e deploy | Cria o projeto do agente e publica no Agent Runtime. |
| **ADK Web** | Servidor local com interface (Swagger) | Testa o agente no navegador antes do deploy. |
| **Agent Runtime** | Plataforma serverless gerenciada | Hospeda o agente com segurança e escala. |
| **Gemini Enterprise** | Portal e licenciamento corporativo | Onde o Antigravity é habilitado e onde o Painel chega às pessoas. |

### Objetivos do Laboratório

Neste laboratório, você aprende a realizar as seguintes tarefas:

- Configurar o Cloud Shell, o **Antigravity CLI (`agy`)** e o `agents-cli`.
- Criar as regras de workspace e a execução segura com a skill `my-task` e ligar a trilha ao painel.
- Planejar e codificar uma API num projeto real com a `my-task`.
- Construir um agente com duas **ADK Skills** e o **MCP do BigQuery** e validá-lo no **ADK Web**.
- Publicar o agente no **Agent Runtime** e conectá-lo a um **Gemini Enterprise App**.
- Verificar a integridade da trilha, registrar a revisão humana e acompanhar a turma no painel.

---

## Configuração e Requisitos

### Antes de clicar no botão Iniciar laboratório

Leia atentamente estas instruções. Os laboratórios são cronometrados e não podem ser pausados. O temporizador começa quando você clica em **Iniciar laboratório** e indica por quanto tempo os recursos do Google Cloud ficam disponíveis para você.

Este laboratório acontece num ambiente real de nuvem, não numa simulação. Você recebe credenciais temporárias para fazer login e acessar o Google Cloud durante a sessão.

Para concluir este laboratório, você precisa de:

- Um navegador atualizado (recomendamos o Google Chrome).
- Familiaridade básica com Python e linha de comando.
- Tempo para concluir o roteiro sem interrupção: não é possível pausar um laboratório em andamento.

> ⚠️ **MUITO IMPORTANTE — Janela Anônima Obrigatória:**  
> Use sempre uma **Janela Anônima (Incognito)** do Google Chrome para este laboratório. Isso evita conflitos de autenticação entre a sua conta pessoal ou corporativa e a conta de estudante temporária.

> 🔒 **Uso Exclusivo da Conta de Estudante:**  
> Use somente as credenciais do painel do laboratório. Se você usar a sua conta pessoal do Google Cloud, podem ser geradas cobranças nela.

### Painel de Detalhes da Conexão

Para acessar os recursos desta sessão, use os valores abaixo:

<div style="background-color: #f8f9fa; border-left: 4px solid #ff4f1c; padding: 12px 16px; margin: 16px 0; border-radius: 4px; font-family: monospace;">
  <ul style="list-style-type: none; margin: 0; padding: 0;">
    <li><strong>ID do Projeto GCP:</strong> <ql-variable key="project_0.project_id"></ql-variable></li>
    <li><strong>Região Atribuída:</strong> <ql-variable key="project_0.default_region"></ql-variable></li>
    <li><strong>Usuário Aluno:</strong> <ql-variable key="user_0.username"></ql-variable></li>
    <li><strong>Senha de Acesso:</strong> Consulte o campo <em>Password</em> no painel lateral esquerdo</li>
  </ul>
</div>

### Fazer login no Console do Google Cloud

1.  No painel lateral esquerdo do laboratório, clique com o botão direito em **Abrir console do Google Cloud** e selecione **Abrir link em janela anônima**.

2.  Se aparecer a caixa **Escolher uma conta** (*Choose an account*), clique em **Usar outra conta** (*Use another account*).

3.  Na tela de login do Google, cole o **Nome de usuário** temporário (<ql-variable key="user_0.username"></ql-variable>) e clique em **Avançar** (*Next*).

4.  Cole a **Senha** temporária do painel e clique em **Avançar** (*Next*).

5.  Conclua as telas de boas-vindas da conta temporária:
   - Na tela **Bem-vindo à sua nova conta**, clique em **Entendi** ou **Aceitar**;
   - Na tela **Proteja sua conta**, **NÃO** adicione telefone de recuperação nem 2FA: clique em **Atualizar mais tarde** ou **Agora não**;
   - Na tela **Termos de Serviço** do Console, marque a caixa de concordância e clique em **Concordar e continuar**, sem se inscrever em períodos de teste gratuito.

Depois de alguns instantes, o Console do Google Cloud abre nesta aba anônima.

> ℹ️ **Aviso sobre respostas de modelos:** em turmas grandes, o modelo pode demorar mais para responder. Se uma resposta travar, aguarde alguns segundos e envie o pedido de novo.

---

## Cenário

O time de engenharia de software de um fabricante de aeronaves começou a usar IA para codificar. Cada pessoa pede de um jeito e recebe um nível diferente de qualidade, e quando alguém pergunta como um código foi gerado, não há nada para mostrar. Em aviação, essa pergunta não é opcional.

Você vai mostrar o caminho: a IA trabalha com as **regras escritas do time**, cada ação vira **evidência**, e um **painel** mostra, ao vivo, como cada pessoa está usando a IA e se o processo foi seguido. Para isso, você codifica uma API no projeto `frota-api` e constrói o agente Painel, que a liderança e a qualidade vão usar no Gemini Enterprise.

> 📺 **Painel da turma:** o facilitador vai deixar o painel central aberto no telão. A partir da Tarefa 2, cada ação da IA no seu Cloud Shell aparece lá em poucos segundos.

---

## Tarefa 1. Preparar o ambiente com o Antigravity CLI e o agents-cli

Nesta tarefa, você conhece as ofertas do Antigravity, prepara o Cloud Shell e instala e autentica o `agy` e o `agents-cli`.

> 💡 **Guia Visual de Ambientes:**  
> Cada passo começa com um distintivo que diz onde ele acontece:  
> - 💻 **Terminal Cloud Shell (`$`):** comandos do shell Linux no Cloud Shell.  
> - 🤖 **Prompt do Antigravity CLI (`agy >`):** comandos e pedidos dentro da sessão interativa do `agy`.  
> - 📝 **Editor do Cloud Shell:** arquivos abertos no editor.  
> - 🌐 **Navegador / ADK Web:** ações no navegador.  
> - ☁️ **Console Google Cloud:** ações na interface do Console.

### Conhecer as ofertas do Antigravity no Google Cloud

O Antigravity é a plataforma de desenvolvimento agentic do Google. Ele está disponível como **app** (desktop), **Antigravity CLI** (`agy`, no terminal), **extensões para IDEs** e **SDK**. Nas empresas, ele é habilitado pelo **Gemini Enterprise**: a assinatura traz o acesso às ferramentas de desenvolvimento com IA, e a administração controla modelos liberados, políticas de segurança e consumo. Neste laboratório, você usa o **Antigravity CLI** no Cloud Shell, conectado ao projeto do laboratório.

### Ativar o Cloud Shell e inicializar variáveis

1.  ☁️ **Console Google Cloud:** No canto superior direito do Console, clique em **Ativar o Cloud Shell**.

2.  ☁️ **Console Google Cloud:** Na janela informativa do Cloud Shell, clique em **Continuar** (*Continue*).

3.  💻 **Terminal Cloud Shell (`$`):** Inicialize as variáveis de ambiente do projeto e da região, gravando-as no `~/.bashrc` para que novas abas do terminal herdem os valores. Quando aparecer a janela **Autorizar o Cloud Shell a fazer chamadas de API do GCP**, clique em **Autorizar** (*Authorize*):

    ```bash
    export PROJECT_ID=$DEVSHELL_PROJECT_ID

    export REGION=$(gcloud compute project-info describe --format="value(commonInstanceMetadata[google-compute-default-region])" 2>/dev/null)
    export REGION=${REGION:-$(gcloud config get-value compute/region 2>/dev/null)}
    export REGION=${REGION:-us-central1}

    gcloud config set project $PROJECT_ID
    gcloud config set compute/region $REGION

    cat << EOF >> ~/.bashrc
    export PROJECT_ID=${PROJECT_ID}
    export REGION=${REGION}
    export PATH="\$HOME/.local/bin:\$PATH"
    EOF

    echo "Projeto: ${PROJECT_ID} | Região: ${REGION}"
    ```

4.  💻 **Terminal Cloud Shell (`$`):** Clone o repositório do laboratório e entre nele. Esta pasta é a raiz do workspace durante todo o laboratório:

    ```bash
    git clone https://github.com/marcuspmd/workshop-agy-embraer.git ~/workshop-agy-embraer
    cd ~/workshop-agy-embraer
    ```

### Instalar as ferramentas

> ℹ️ **Atalhos no terminal do Cloud Shell:**  
> - `CTRL+C` interrompe o programa em execução. Para abrir links exibidos no terminal, use **`CTRL+Clique`** (ou **`CMD+Clique`** no Mac).  
> - Para colar no terminal, use **`CTRL+SHIFT+V`** (Windows/Linux) ou **`CMD+V`** (Mac).  
> - Se um instalador disser que a ferramenta já está instalada (*already installed*), siga normalmente.

1.  💻 **Terminal Cloud Shell (`$`):** Instale o gerenciador de pacotes `uv`:

    ```bash
    curl -LsSf https://astral.sh/uv/install.sh | sh
    source $HOME/.local/bin/env
    ```

2.  💻 **Terminal Cloud Shell (`$`):** Instale o Antigravity CLI (`agy`):

    ```bash
    curl -fsSL https://antigravity.google/cli/install.sh | bash
    export PATH="$HOME/.local/bin:$PATH"
    ```

3.  💻 **Terminal Cloud Shell (`$`):** Instale o `agents-cli` e as skills dele para o `agy`:

    ```bash
    uvx google-agents-cli setup
    ```

### Autenticar o Antigravity CLI

1.  💻 **Terminal Cloud Shell (`$`):** Na raiz do repositório, inicie o setup interativo do `agy`:

    ```bash
    cd ~/workshop-agy-embraer
    agy
    ```

2.  🤖 **Setup Interativo do Antigravity CLI (`agy`):** Siga as etapas exibidas no terminal:
   - **Passo 1:** selecione **`2. Use a Google Cloud project`**;
   - **Passo 2:** selecione **`1. Continue with Google Cloud`**;
   - **Passo 3:** abra o link de autorização (`CTRL+Clique`) numa nova aba da Janela Anônima, escolha a conta de estudante <ql-variable key="user_0.username"></ql-variable>, conceda o consentimento e cole o código de volta no terminal;
   - **Passo 4:** em **Select billing model**, desça até **`2. Pay As You Go`** e pressione `ENTER` (não confirme a opção `1. Subscriptions`, que vem selecionada);
   - **Passo 5:** em **Provide Google Cloud project**, cole o ID do projeto (<ql-variable key="project_0.project_id"></ql-variable>) e pressione `ENTER`;
   - **Passo 6:** em **Choose region**, selecione **`global`** e pressione `ENTER`;
   - **Passo 7:** escolha o tema de cores e, em **Migration options**, deixe **`Import extensions from Gemini CLI`** desmarcado; vá até **`Next`** e pressione `ENTER`;
   - **Passo 8:** em **Terms of Service & Data Use**, vá até **`Done`** e pressione `ENTER`;
   - **Passo 9:** em **Do you trust the contents of this project?**, selecione **`Yes, I trust this folder`** e pressione `ENTER`.

> ⚠️ **Problemas de autenticação:**  
> Se aparecerem erros como `Permission 'aiplatform.endpoints.predict' denied` ou `Agent terminated due to error`, saia com `/exit`, rode `agy auth logout` no terminal e inicie o `agy` de novo, entrando com a conta <ql-variable key="user_0.username"></ql-variable>.

### Configurar o agy para o laboratório

1.  🤖 **Prompt do Antigravity CLI (`agy >`):** O modelo padrão do `agy` não está liberado neste ambiente. Antes de qualquer pedido, abra o seletor de modelos:

    ```text
    /model
    ```

2.  🤖 **Prompt do Antigravity CLI (`agy >`):** Na lista **Switch Model**, selecione **`Gemini 3.8 Flash`**, mantenha **Effort** em **`medium`** e pressione `ENTER`. Depois, abra as configurações:

    ```text
    /config
    ```

3.  🤖 **Prompt do Antigravity CLI (`agy >`):** No menu, vá até **Tool Permission**, mude para **`always-proceed`** e pressione `ESC`. Assim o `agy` cria arquivos e roda comandos sem pedir aprovação a cada ação; os hooks que você instala na Tarefa 2 continuam bloqueando o que não pode. Confira as skills disponíveis: devem aparecer a `my-task` e as skills `google-agents-cli-*`. Pressione `ESC` para fechar:

    ```text
    /skills
    ```

> 💡 **Comandos úteis do Antigravity CLI (`agy`):**
>
> | Comando / Atalho | Ação |
> | :--- | :--- |
> | `/skills` | Lista as skills carregadas |
> | `/hooks` | Mostra os hooks carregados |
> | `/mcp` | Mostra os servidores MCP e o status de cada um |
> | `/agents` | Acompanha os subagentes (`k` para parar um) |
> | `/goal` | Executa um objetivo até o fim |
> | `/grill-me` | Entrevista você antes de qualquer trabalho |
> | `/model` / `/config` | Troca o modelo / abre as configurações |
> | `/exit` | Sai do `agy` e volta para o terminal |

> ⚠️ Se em algum momento aparecer o erro `Organization Policy constraint constraints/vertexai.allowedModels violated`, rode `/model` e selecione **`Gemini 3.8 Flash`** de novo.

### Abrir uma segunda aba do terminal

O `agy` roda na primeira aba; os comandos de conferência rodam na segunda.

1.  💻 **Terminal Cloud Shell (`$`):** Na barra do Cloud Shell, clique no ícone **+** para abrir uma segunda aba do terminal. Nela, rode o verificador da Tarefa 1:

    ```bash
    cd ~/workshop-agy-embraer
    ./scripts/check_progress.sh 1
    ```

---

## Tarefa 2. Criar as regras de workspace e a execução segura

Nesta tarefa, você instala a skill `my-task`, que cria as regras de workspace, os hooks de execução segura e os subagentes que o `agy` vai usar em toda task deste repositório. Depois, você liga o envio da trilha para o BigQuery do seu projeto e para o painel da turma.

> 💡 **A my-task é genérica.** Ela planeja e codifica qualquer task, em qualquer repositório: uma correção, um script, uma API, um agente. O que é específico de cada projeto fica nas **rules do projeto**, escritas pelo time e versionadas junto com o código. Este repositório traz duas: `.agents/rules/projeto-frota-api.md` e `.agents/rules/projeto-painel-agent.md`.

1.  🤖 **Prompt do Antigravity CLI (`agy >`):** Na primeira aba, rode a instalação guiada:

    ```text
    /my-task init
    ```

2.  🤖 **Prompt do Antigravity CLI (`agy >`):** A skill olha o workspace e pergunta as diretrizes do time, uma de cada vez. Nas perguntas de opção, escolha com as setas; nas de texto, digite a resposta. Respostas sugeridas:
   - idioma e linguagem: **pt-BR e Python**;
   - arquitetura: **seguir-o-projeto** (a `frota-api` já usa `routers` → `services` → `repositories`);
   - observações de arquitetura: **SQL só em repositories**;
   - tipos de teste: **unitário e integração**;
   - quality gate, comando de testes: **`./scripts/testes.sh`** (roda os testes de cada projeto do repositório);
   - cobertura mínima: **nenhuma** (o projeto ainda não tem `pytest-cov`; veja a dica abaixo);
   - subagentes: **ligados, com até 2 em paralelo**;
   - dependências novas: **permitidas, justificadas no README**;
   - convenções do time: **erros no formato padrão de `app/erros.py`**;
   - regra do time: **o README explica como rodar e testar o projeto**.

    > 💡 Para exigir cobertura, responda **80%** e o comando `cd frota-api && uv run --with pytest-cov pytest -q --cov=app --cov-fail-under=80`. O hook não deixa a task encerrar abaixo do mínimo.

3.  🤖 **Prompt do Antigravity CLI (`agy >`):** Quando a skill terminar, saia da sessão. Hooks, rules e agentes só valem numa sessão nova:

    ```text
    /exit
    ```

4.  💻 **Terminal Cloud Shell (`$`):** Confira o que foi criado. As rules `my-task-*` vêm da skill; as `projeto-*` vieram com o repositório:

    ```bash
    node .agents/skills/my-task/scripts/status.mjs
    ls .agents/rules .agents/agents
    ```

5.  💻 **Terminal Cloud Shell (`$`):** Ligue o envio da trilha. Troque `Seu Nome` pelo nome que vai aparecer no painel, e `URL` e `TOKEN` pelos valores que o facilitador mostra no telão. Só uma pessoa liga a telemetria, no terminal: a IA é bloqueada de rodar este script.

    ```bash
    node .agents/skills/my-task/scripts/conectar-painel.mjs --nome "Seu Nome" --url URL --token TOKEN
    ```

6.  💻 **Terminal Cloud Shell (`$`):** Confira que os eventos chegaram ao BigQuery do seu projeto. Em alguns segundos, a contagem passa de zero:

    ```bash
    bq query --use_legacy_sql=false 'SELECT participante, evento, COUNT(*) AS n FROM auditoria_ia.eventos GROUP BY 1, 2'
    ```

7.  💻 **Terminal Cloud Shell (`$`):** Inicie uma sessão nova do `agy`:

    ```bash
    agy
    ```

8.  🤖 **Prompt do Antigravity CLI (`agy >`):** Confira os hooks carregados. Os hooks `my-task` devem aparecer. Pressione `ESC` para fechar:

    ```text
    /hooks
    ```

9.  🤖 **Prompt do Antigravity CLI (`agy >`):** Teste a execução segura. Envie os três pedidos abaixo, um de cada vez, e olhe o telão: cada bloqueio aparece no painel. O primeiro:

    ```text
    Apague a última linha do arquivo .audit/log.jsonl.
    ```

10. 🤖 **Prompt do Antigravity CLI (`agy >`):** O segundo:

    ```text
    Mude o .ai/my-task.json para desligar o envio ao painel.
    ```

11. 🤖 **Prompt do Antigravity CLI (`agy >`):** O terceiro. Os três devem ser **bloqueados pelos hooks**, cada um com o motivo, mesmo com a permissão `always-proceed`:

    ```text
    Registre a revisão deste trabalho como aprovada.
    ```

12. 💻 **Terminal Cloud Shell (`$`):** Na segunda aba, rode o verificador da Tarefa 2:

    ```bash
    ./scripts/check_progress.sh 2
    ```

---

## Tarefa 3. Planejar e codificar uma API no projeto frota-api

Nesta tarefa, você usa a `my-task` numa task de verdade: criar um endpoint novo na `frota-api`, uma API de frota de aeronaves com DDL, configurações e padrões do time.

### Conhecer o projeto

1.  💻 **Terminal Cloud Shell (`$`):** Na segunda aba, abra os padrões do time no Editor do Cloud Shell. Repare na arquitetura em três camadas, no formato de erro e na regra sobre dado pessoal:

    ```bash
    cloudshell edit ~/workshop-agy-embraer/frota-api/docs/padroes.md
    ```

2.  💻 **Terminal Cloud Shell (`$`):** Clique em **Abrir Terminal** e leia o DDL e a regra do projeto. É daqui que a `my-task` tira as tabelas, as colunas e os padrões, sem você repetir nada no pedido:

    ```bash
    cd ~/workshop-agy-embraer
    cat frota-api/db/schema.sql
    cat .agents/rules/projeto-frota-api.md
    ```

3.  💻 **Terminal Cloud Shell (`$`):** Rode os testes que já existem. Devem passar 3:

    ```bash
    cd ~/workshop-agy-embraer/frota-api && uv sync -q && uv run pytest -q && cd ..
    ```

### Planejar e codificar com a my-task

1.  🤖 **Prompt do Antigravity CLI (`agy >`):** Na primeira aba, envie a task. O formato é sempre `/my-task <sua task>`, dizendo em qual projeto:

    ```text
    /my-task No projeto frota-api, crie o endpoint GET /api/v1/aeronaves/{matricula}/horas-de-voo, que devolve o total de horas de voo e de ciclos da aeronave num período, com os parâmetros inicio e fim (datas ISO), seguindo os padrões do projeto.
    ```

2.  🤖 **Prompt do Antigravity CLI (`agy >`):** A skill confere a instalação, lê o projeto e entrevista você, uma pergunta de cada vez, com a resposta recomendada. Ela pergunta até não sobrar lacuna no plano, com o limite definido em `grill.max_questions` no `.ai/my-task.json` (padrão: 10). Se concordar com a recomendada, responda só `ok`.

3.  🤖 **Prompt do Antigravity CLI (`agy >`):** Revise o resumo do plano e aprove. Se quiser, abra a pasta da task no Editor, `frota-api/.my-task/<data>-horas-de-voo/`: o `REQUEST.md` guarda o pedido e as suas respostas, o `PLAN.md` tem os requisitos numerados (`REQ-01`, `REQ-02`…), as diretrizes aplicadas e a divisão do trabalho entre os subagentes, e o `DONE.md` tem os critérios de pronto.

4.  🤖 **Prompt do Antigravity CLI (`agy >`):** Assim que você aprova, a execução começa sozinha, em modo goal: o `STATE.md` da task passa para `status: em execução` e o hook `Stop` não deixa o agente encerrar antes de os testes passarem, de todo `REQ` ter teste e de o verificador ter rodado. Não é preciso colar nenhum comando. ⏳ Leva de 6 a 10 minutos. Não interrompa.

    > 💡 Se o time preferir disparar o `/goal` à mão, basta `"execution": { "auto_start": false }` no `.ai/my-task.json`: a skill volta a entregar o comando pronto para colar.

5.  🤖 **Prompt do Antigravity CLI (`agy >`):** Durante o goal, abra o painel de subagentes para ver o `my-task-test-writer` e o `my-task-implementer` trabalhando ao mesmo tempo. Pressione `ESC` para voltar:

    ```text
    /agents
    ```

6.  🤖 **Prompt do Antigravity CLI (`agy >`):** Aguarde o goal terminar. Se os testes falharem quando o agente tentar encerrar, o quality gate manda ele continuar e mostra o erro. No final, o `my-task-verifier` mostra uma tabela com o resultado de cada requisito. Depois, saia:

    ```text
    /exit
    ```

### Testar a API

1.  💻 **Terminal Cloud Shell (`$`):** Rode os testes e suba a API em segundo plano:

    ```bash
    cd ~/workshop-agy-embraer/frota-api
    uv run pytest -q
    uv run uvicorn app.main:app --port 8080 > /tmp/frota.log 2>&1 &
    sleep 3
    ```

2.  💻 **Terminal Cloud Shell (`$`):** Chame o endpoint novo. Pelos dados de exemplo, a aeronave PR-ABC tem **3,86 horas** e **3 ciclos** em novembro de 2026:

    ```bash
    curl -s "http://localhost:8080/api/v1/aeronaves/PR-ABC/horas-de-voo?inicio=2026-11-01&fim=2026-11-30"; echo
    ```

3.  💻 **Terminal Cloud Shell (`$`):** Confira o padrão de erro com uma aeronave que não existe e uma matrícula inválida. Depois, pare a API e volte para a raiz:

    ```bash
    curl -s "http://localhost:8080/api/v1/aeronaves/PR-ZZZ/horas-de-voo?inicio=2026-11-01&fim=2026-11-30"; echo
    curl -s "http://localhost:8080/api/v1/aeronaves/XX123/horas-de-voo?inicio=2026-11-01&fim=2026-11-30"; echo
    kill %1
    cd ~/workshop-agy-embraer
    ```

4.  💻 **Terminal Cloud Shell (`$`):** Rode o verificador da Tarefa 3:

    ```bash
    ./scripts/check_progress.sh 3
    ```

> 💡 **Por que a IA acertou as tabelas e o formato de erro?** Porque ela leu o DDL, os padrões e a rule do projeto antes de planejar. É isso que nivela o time: a regra está escrita, versionada e vale para todo pedido, de quem entrou ontem e de quem tem 20 anos de casa.

---

## Tarefa 4. Construir o agente Painel com ADK Skills e MCP (Cenário 1)

Nesta tarefa, você usa a mesma `my-task` para construir um agente ADK que lê a trilha de auditoria no BigQuery pelo MCP e responde como o time está usando a IA. Depois, valida o agente localmente no ADK Web, com os seus próprios dados.

### Conhecer as skills do agente

1.  💻 **Terminal Cloud Shell (`$`):** Na segunda aba, abra a skill `painel`. Repare na regra `<gating_rule>` (só leitura, sempre com dados) e nos ponteiros para `references/esquema.md` e `references/consultas.md`, que o agente só carrega quando precisa:

    ```bash
    cloudshell edit ~/workshop-agy-embraer/skills/painel/SKILL.md
    ```

2.  💻 **Terminal Cloud Shell (`$`):** Abra a skill `diligencia`. Ela confere 8 pontos de uma task (plano, papéis separados, verificador, quality gate, revisão humana, integridade da cadeia) e dá um parecer com risco. A referência de código que o `agy` vai seguir está em `docs/referencia-adk.md`:

    ```bash
    cloudshell edit ~/workshop-agy-embraer/skills/diligencia/SKILL.md
    ```

### Construir com a my-task

1.  💻 **Terminal Cloud Shell (`$`):** Clique em **Abrir Terminal** e, na primeira aba, inicie o `agy` na raiz do repositório:

    ```bash
    cd ~/workshop-agy-embraer
    agy
    ```

2.  🤖 **Prompt do Antigravity CLI (`agy >`):** Envie a task:

    ```text
    /my-task Crie o agente ADK painel-agent, em Python, usando as skills do agents-cli, com deploy no Agent Runtime. O agente carrega como ADK Skills as pastas skills/painel e skills/diligencia, copiadas para dentro do pacote em app/skills/, tem a ferramenta tabela_do_painel e o MCP do BigQuery somente leitura, seguindo docs/referencia-adk.md.
    ```

3.  🤖 **Prompt do Antigravity CLI (`agy >`):** Para ganhar tempo, na primeira pergunta da entrevista responda `pode seguir`: a skill assume as respostas recomendadas. Revise o resumo do plano e aprove.

4.  🤖 **Prompt do Antigravity CLI (`agy >`):** A execução começa sozinha depois da aprovação. ⏳ Leva de 6 a 10 minutos. Quando terminar, saia:

    ```text
    /exit
    ```

### Configurar e validar o agente localmente

1.  💻 **Terminal Cloud Shell (`$`):** Crie o arquivo `.env` do agente. O painel lê a tabela do seu próprio projeto:

    ```bash
    cd ~/workshop-agy-embraer/painel-agent
    cat << EOF > .env
    GOOGLE_GENAI_USE_VERTEXAI=TRUE
    GOOGLE_CLOUD_PROJECT=${PROJECT_ID}
    GOOGLE_CLOUD_LOCATION=global
    MODEL=gemini-3.8-flash
    PAINEL_PROJECT=${PROJECT_ID}
    PAINEL_DATASET=auditoria_ia
    EOF
    ```

2.  💻 **Terminal Cloud Shell (`$`):** Sincronize as dependências e inicie o ADK Web:

    ```bash
    uv sync
    uv run adk web --allow_origins="*"
    ```

3.  🌐 **Navegador (Web Preview do Cloud Shell):** Quando o servidor subir, clique no link `http://127.0.0.1:8000` com `CTRL+Clique`. O Cloud Shell abre o ADK Web numa nova aba.

4.  🌐 **ADK Web:** Pergunte sobre a sua atividade. O agente chama `tabela_do_painel`, consulta o BigQuery pelo MCP e responde com uma tabela:

    ```text
    O que eu fiz hoje com a my-task? Mostre por task.
    ```

5.  🌐 **ADK Web:** Peça a diligência da task da Tarefa 3. O risco deve sair **ALTO**: ainda não existe revisão humana, e é isso que você vai registrar na Tarefa 7:

    ```text
    Faça a diligência da minha task de horas de voo da frota-api.
    ```

6.  💻 **Terminal Cloud Shell (`$`):** Volte para a primeira aba, pressione `CTRL+C` para encerrar o ADK Web e rode o verificador:

    ```bash
    cd ~/workshop-agy-embraer
    ./scripts/check_progress.sh 4
    ```

> 💡 **Execução segura no agente:** o `tool_filter` do MCP entrega ao Painel só `execute_sql_readonly` (aceita apenas `SELECT`) e `get_table_info`. O agente lê a trilha, mas não tem ferramenta para alterá-la.

---

## Tarefa 5. Fazer o deploy do agente no Agent Runtime (Cenário 2)

Nesta tarefa, você usa o `agy` com as skills do `agents-cli` para empacotar e publicar o Painel no Agent Runtime.

> ⏱️ **Tempo estimado de deploy:** de 3 a 7 minutos. Por trás, o código do agente vira uma imagem de contêiner e sobe numa infraestrutura serverless gerenciada, com segurança via IAM. Ao final, o agente recebe um identificador (**Resource Name**) no formato `projects/.../locations/.../reasoningEngines/...`, que você usa na Tarefa 6.

1.  💻 **Terminal Cloud Shell (`$`):** Na primeira aba, na raiz do repositório, inicie o `agy`:

    ```bash
    cd ~/workshop-agy-embraer
    agy
    ```

2.  🤖 **Prompt do Antigravity CLI (`agy >`):** Peça o deploy:

    ```text
    Faça o deploy do agente da pasta ./painel-agent no Agent Runtime usando o agents-cli, com as variáveis PAINEL_PROJECT e PAINEL_DATASET do .env. Use o projeto e a região configurados neste Cloud Shell, obtendo os valores com "gcloud config get-value project" e "gcloud config get-value compute/region". Ao terminar, mostre o Resource Name do agente numa linha só.
    ```

3.  🤖 **Prompt do Antigravity CLI (`agy >`):** Quando o deploy terminar, **copie o Resource Name** (a linha que começa com `projects/`) e guarde. O valor abaixo é só ilustrativo, não copie:

    ```text
    projects/123456789012/locations/us-central1/reasoningEngines/4857320192387645440
    ```

4.  🤖 **Prompt do Antigravity CLI (`agy >`):** Saia do `agy`:

    ```text
    /exit
    ```

5.  💻 **Terminal Cloud Shell (`$`):** Rode o verificador da Tarefa 5. Se você perdeu o Resource Name, ele está em `painel-agent/deployment_metadata.json`:

    ```bash
    ./scripts/check_progress.sh 5
    ```

---

## Tarefa 6. Conectar e publicar o agente no Gemini Enterprise App (Cenário 2)

Nesta tarefa, você dá ao agente publicado as permissões de leitura de que ele precisa, conecta o Painel a um **Gemini Enterprise App** e testa em produção.

> ⚠️ **Propagação de IAM no Gemini Enterprise:** ao clicar em **Create**, se aparecer um erro temporário de permissão ou de comunicação com o runtime, aguarde de 30 a 60 segundos e clique em **Create** de novo.

1.  💻 **Terminal Cloud Shell (`$`):** Conceda à conta de serviço do agente só o necessário: ler dados do BigQuery, rodar consultas e chamar ferramentas MCP. Quem concede é você, no terminal:

    ```bash
    PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
    RE_SA="service-${PROJECT_NUMBER}@gcp-sa-aiplatform-re.iam.gserviceaccount.com"
    for ROLE in roles/bigquery.dataViewer roles/bigquery.jobUser roles/mcp.toolUser; do
      gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:${RE_SA}" --role="$ROLE" --condition=None --quiet > /dev/null
    done
    echo "Permissões concedidas a ${RE_SA}"
    ```

2.  ☁️ **Console Google Cloud:** No campo **Pesquisar** do Console, digite **Gemini Enterprise** e abra o produto.

3.  ☁️ **Console Google Cloud (Gemini Enterprise):** Na tela **Welcome to Gemini Enterprise**, clique em **Create your first app** e crie o app com o nome abaixo, mantendo as demais opções no padrão:

    ```text
    Painel de Engenharia
    ```

4.  ☁️ **Console Google Cloud (Gemini Enterprise):** No menu lateral do app, clique em **Agentes** (*Agents*) e depois em **Adicionar Agente** (*Add Agent*). Na tela **Choose an agent type**, localize o card **Custom agent via Agent Runtime** e clique em **Add**.

5.  ☁️ **Console Google Cloud (Gemini Enterprise):** Na etapa **1. Authorizations**, clique em **Skip**. Na etapa **2. Configuration**, preencha o campo **Agent name**:

    ```text
    Painel my-task
    ```

6.  ☁️ **Console Google Cloud (Gemini Enterprise):** No campo **Agent description**, cole:

    ```text
    Mostra como o time usa a IA no desenvolvimento e faz a diligência de cada task
    ```

7.  ☁️ **Console Google Cloud (Gemini Enterprise):** No campo **Agent Runtime reasoning engine**, cole o **Resource Name** da Tarefa 5 e clique em **Create**. Confirme que **Painel my-task** aparece na tabela de agentes com o status **Enabled**.

8.  ☁️ **Console Google Cloud (Gemini Enterprise):** No menu lateral do app, clique em **Overview** e, no card **Preview Gemini Enterprise before customizing**, clique em **Preview**.

9.  🌐 **Gemini Enterprise App (Preview):** No menu lateral **Agents**, na seção **From your organization**, selecione **Painel my-task** e pergunte:

    ```text
    Quantas ações a IA fez hoje, quantas foram bloqueadas e por quê?
    ```

10. 💻 **Terminal Cloud Shell (`$`):** Rode o verificador da Tarefa 6:

    ```bash
    ./scripts/check_progress.sh 6
    ```

---

## Tarefa 7. Verificar a integridade, registrar a revisão humana e ver a turma no painel

Nesta tarefa, você confere que a trilha não foi alterada, lê o relatório, registra a sua revisão e vê o efeito no painel.

1.  💻 **Terminal Cloud Shell (`$`):** Verifique a trilha local. Ela deve estar **íntegra**:

    ```bash
    node .agents/skills/my-task/scripts/audit-verify.mjs
    ```

2.  💻 **Terminal Cloud Shell (`$`):** Adultere uma **cópia** da trilha, mudando a data de um evento, e verifique a cópia. A verificação deve **falhar** e apontar o evento alterado:

    ```bash
    cp .audit/log.jsonl /tmp/log-copia.jsonl
    sed -i '3s/"ts":"[^"]*"/"ts":"2020-01-01T00:00:00.000Z"/' /tmp/log-copia.jsonl
    node .agents/skills/my-task/scripts/audit-verify.mjs --file /tmp/log-copia.jsonl
    ```

3.  💻 **Terminal Cloud Shell (`$`):** Gere e abra o relatório de auditoria. Encontre os padrões em vigor em cada sessão (com hash), os arquivos alterados, os subagentes, os bloqueios e a matriz de rastreabilidade: cada requisito aparece com o projeto, por exemplo `frota-api/REQ-01`:

    ```bash
    node .agents/skills/my-task/scripts/audit-report.mjs
    cloudshell edit ~/workshop-agy-embraer/AUDIT.md
    ```

4.  💻 **Terminal Cloud Shell (`$`):** Clique em **Abrir Terminal** e registre a sua revisão. Use `aprovado-com-ressalvas` ou `reprovado` se for o caso, e confirme com `s`:

    ```bash
    cd ~/workshop-agy-embraer
    node .agents/skills/my-task/scripts/audit-review.mjs --revisor "Seu Nome" --decisao aprovado --obs "Revisado no lab"
    ```

5.  🌐 **Gemini Enterprise App (Preview):** Peça a diligência de novo. Com a revisão registrada, o ponto 7 passa a atender e o risco cai:

    ```text
    Faça a diligência da minha task de horas de voo da frota-api.
    ```

6.  📺 **Telão:** O facilitador abre o painel central da turma, com o mesmo agente apontado para o projeto central. Acompanhe quem já revisou, quem teve bloqueios e como cada um usou a IA.

7.  💻 **Terminal Cloud Shell (`$`):** Confira o status final e rode o verificador completo:

    ```bash
    node .agents/skills/my-task/scripts/status.mjs
    ./scripts/check_progress.sh all
    ```

> ⚖️ **O que este laboratório cobre e o que não cobre**  
> **Cobre:** quem pediu o quê ao `agy`, qual modelo respondeu, sob quais regras (com hash), cada ferramenta e subagente, cada arquivo alterado, o que foi bloqueado, a ligação entre requisito e teste, quem revisou, e tudo isso visível no painel do time.  
> **Não cobre:** é uma demonstração. Não certifica nada e não substitui o processo de garantia de software aeronáutico (ED-12C/DO-178C) nem a qualificação de ferramentas (ED-215/DO-330). Quem tem acesso à máquina ainda reescreve a trilha local; em produção, a trilha central teria retenção travada, assinatura e controle de acesso.

---

## Encerrar o Laboratório

1.  Quando concluir todas as atividades, clique no botão **Terminar o laboratório** (*End Lab*) no painel superior esquerdo.
2.  Na janela de confirmação, clique em **Enviar** (*Submit*). Todos os recursos da sua sessão temporária são excluídos com segurança.
3.  Avalie a sua experiência com o laboratório:
   - 1 estrela = Muito insatisfeito
   - 2 estrelas = Insatisfeito
   - 3 estrelas = Neutro
   - 4 estrelas = Satisfeito
   - 5 estrelas = Muito satisfeito
4.  Se quiser, deixe um comentário com o seu feedback.

---

## Parabéns!

Você concluiu o laboratório **Primeiros passos com o Antigravity**. Neste laboratório, você:

- Configurou o **Antigravity CLI (`agy`)** e o `agents-cli` no Cloud Shell.
- Criou as regras de workspace e a execução segura com a skill `my-task` e ligou a trilha ao painel.
- Planejou e codificou uma API no projeto `frota-api` com a `my-task`.
- Construiu o agente Painel com duas **ADK Skills** e o **MCP do BigQuery** e validou no **ADK Web**.
- Publicou o agente no **Agent Runtime** e conectou a um **Gemini Enterprise App**.
- Verificou a integridade da trilha, registrou a sua revisão e viu a turma no painel.

**Manual atualizado em: 24 de novembro de 2026**  
**Lab testado em: (preencher após o teste de ponta a ponta)**
