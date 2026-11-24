#!/usr/bin/env node
// Liga a telemetria da my-task: cada evento da trilha vai para o BigQuery do projeto
// e, se você informar a URL e o token, para o painel central do time.
// Só uma pessoa roda este script, no terminal. Os hooks bloqueiam a IA de rodá-lo.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { appendEntry, readEntries, logPath } from './audit-lib.mjs';
import { loadConfig, projectFile } from './config.mjs';
import { outboxPath, toRow, wakeShipper } from './telemetry.mjs';

const HELP = `Uso: node .agents/skills/my-task/scripts/conectar-painel.mjs --nome "Seu Nome" [opções]

  --nome "<nome>"      como você aparece no painel (obrigatório)
  --url <url>          URL do painel central do time (o apresentador informa)
  --token <token>      token do painel central (o apresentador informa)
  --projeto <id>       projeto do BigQuery local (padrão: gcloud config get-value project)
  --sem-central        envia só para o BigQuery do próprio projeto
  --help               esta ajuda

Grava a seção "telemetry" do .ai/my-task.json, envia a trilha que já existe e confere a conexão.`;

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const value = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };
if (has('--help') || has('-h')) { console.log(HELP); process.exit(0); }

const root = process.cwd();
const nome = value('--nome');
if (!nome) { console.error('Informe --nome "Seu Nome".\n'); console.log(HELP); process.exit(1); }
if (!fs.existsSync(projectFile(root))) { console.error('A my-task não está instalada aqui: rode /my-task init antes.'); process.exit(1); }

let projeto = value('--projeto') || process.env.GOOGLE_CLOUD_PROJECT;
if (!projeto) {
  try { projeto = execFileSync('gcloud', ['config', 'get-value', 'project'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { projeto = ''; }
  if (projeto === '(unset)') projeto = '';
}
const url = has('--sem-central') ? null : value('--url') ?? null;
const token = has('--sem-central') ? null : value('--token') ?? null;
if ((url && !token) || (!url && token)) { console.error('Informe --url e --token juntos (ou use --sem-central).'); process.exit(1); }

const file = projectFile(root);
const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
cfg.telemetry = {
  ...(cfg.telemetry ?? {}),
  enabled: true,
  participant: nome,
  local: { project: projeto || null, dataset: 'auditoria_ia', table: 'eventos' },
  central: { url, token },
};
fs.writeFileSync(file, `${JSON.stringify(cfg, null, 2)}\n`);

// A trilha que já existe vai para a fila, para o painel mostrar desde a instalação.
const { config } = loadConfig(root);
const queued = new Set();
if (fs.existsSync(outboxPath(root))) {
  for (const l of fs.readFileSync(outboxPath(root), 'utf8').split('\n')) {
    try { queued.add(JSON.parse(l).hash); } catch { /* linha vazia */ }
  }
}
const backlog = readEntries(logPath(root)).filter((e) => !e.__invalid && !queued.has(e.hash));
fs.appendFileSync(outboxPath(root), backlog.map((e) => `${JSON.stringify(toRow(root, e, config))}\n`).join(''));
appendEntry(root, { event: 'PainelConectado', actor: 'human', osUser: os.userInfo().username, participant: nome, project: projeto || null, central: Boolean(url) });

async function check() {
  if (!url) return 'não configurado';
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/saude`, { signal: AbortSignal.timeout(10_000) });
    return res.ok ? 'respondendo' : `respondeu ${res.status}`;
  } catch (err) {
    return `sem resposta (${err.message})`;
  }
}

const central = await check();
wakeShipper(root);
console.log(`✅ Telemetria ligada para "${nome}".`);
console.log(`   BigQuery do projeto: ${projeto ? `${projeto}.auditoria_ia.eventos` : 'sem projeto (use --projeto)'}`);
console.log(`   Painel central: ${url ? `${url} — ${central}` : 'não configurado'}`);
console.log(`   ${backlog.length + 1} eventos na fila. Acompanhe o envio com: node .agents/skills/my-task/scripts/status.mjs`);
