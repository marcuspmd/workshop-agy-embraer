# Painel central da turma (apresentador)

O painel central recebe os eventos da `my-task` de todos os participantes e mostra a turma inteira no telão.

## Antes do evento

> Passo a passo completo (projeto próprio fora do Qwiklabs, ensaio, agente, Gemini Enterprise, véspera e limpeza): [`docs/apresentador-projeto-central.md`](../docs/apresentador-projeto-central.md). Abaixo, o resumo.

1. Num projeto seu (não um projeto do Qwiklabs), no Cloud Shell, clone o repositório e rode:

   ```bash
   cd ~/workshop-agy-embraer
   PROJECT_ID=<projeto-central> ./painel-central/deploy.sh
   ```

   O script cria o dataset `auditoria_ia` e a tabela `eventos`, publica o `painel-hub` no Cloud Run e mostra a **URL** e o **TOKEN**. Guarde os dois: a turma usa na Tarefa 2.

2. Publique o mesmo agente Painel no projeto central, apontando para a tabela central. O jeito mais simples é seguir as Tarefas 2 a 6 do roteiro no projeto central, conectando-se ao seu próprio hub, com `PAINEL_PROJECT=<projeto-central>` no `.env`. No `conectar-painel.mjs` do projeto central, use `--sem-central`: o BigQuery local e a tabela do hub são a mesma, e com `--url` cada evento seria gravado duas vezes. Depois, guarde o `painel-agent` gerado para os próximos eventos.

3. Dê ao agente central as permissões de leitura (Tarefa 6, passo 1, no projeto central) e crie o app **Painel da Turma** no Gemini Enterprise do projeto central.

## Durante o evento

- **Sala ao vivo:** o link `URL/sala?k=<chave>` que o `deploy.sh` mostra (a chave fica só com você). Um avatar por pessoa, com o que a IA está fazendo, a etapa da task e o progresso; clicando, as tasks, os subagentes, os bloqueios e a linha do tempo da pessoa. Para ensaiar sem turma: `python3 painel-central/simular.py --url URL --token TOKEN`.
- **Telão ao vivo:** Logs Explorer do projeto central, filtro `jsonPayload.tipo="my-task"`, com **Stream logs** ligado. Cada linha é uma ação de alguém, com nome, evento e ferramenta; bloqueios aparecem como `WARNING`.
- **Perguntas ao painel (Gemini Enterprise central):**
  - "Quem está ativo agora e em qual task?"
  - "Resumo de hoje por pessoa: ações, bloqueios, quality gate e revisão."
  - "Quais bloqueios a turma teve e por quê?"
  - "Faça a diligência da task de horas de voo da Ana."

## Segurança

- O hub é público, protegido por um token compartilhado com a turma. Use um token novo por evento (`NOVO_TOKEN=1 ./painel-central/deploy.sh`; sem isso, um novo deploy mantém o token) e apague o serviço depois (`gcloud run services delete painel-hub`).
- A sala tem uma chave própria (`PAINEL_VIEW_TOKEN`), diferente do token da turma: quem tem o token só consegue enviar eventos, não ver a sala.
- O hub aceita só as colunas da tabela, corta textos longos e não recebe conteúdo de arquivos: só nomes, hashes, ferramentas e decisões.
- Se a política da sua organização proibir serviços públicos (`allUsers`) no Cloud Run, use um projeto fora dessa política.
