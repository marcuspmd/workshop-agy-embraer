#!/usr/bin/env node
// Envia a fila .audit/outbox.jsonl para o BigQuery do projeto e para o painel central.
// Uso: node shipper.mjs <raiz-do-workspace> [--once] [--verbose]
// Roda em segundo plano, chamado pela telemetria; também pode rodar à mão para conferir o envio.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadConfig } from './config.mjs';
import { destinations, outboxPath } from './telemetry.mjs';

if (process.argv.includes('--help')) {
  console.log('Uso: node shipper.mjs <raiz> [--once] [--verbose]\nEnvia a fila de telemetria (.audit/outbox.jsonl) para o BigQuery do projeto e para o painel central.');
  process.exit(0);
}

const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : process.cwd());
const verbose = process.argv.includes('--verbose');
const dir = path.join(root, '.audit');
const stateFile = path.join(dir, 'outbox-state.json');
const lockDir = path.join(dir, '.ship-lock');
const logFile = path.join(dir, 'shipper.log');
const BATCH = 100;
const DEADLINE = Date.now() + 60_000;

const log = (msg) => {
  const line = `${new Date().toISOString()} ${msg}`;
  if (verbose) console.log(line);
  try { fs.appendFileSync(logFile, `${line}\n`); } catch { /* sem log */ }
};

function takeLock() {
  try {
    fs.mkdirSync(lockDir);
    return true;
  } catch {
    try {
      if (Date.now() - fs.statSync(lockDir).mtimeMs > 120_000) {
        fs.rmSync(lockDir, { recursive: true, force: true });
        fs.mkdirSync(lockDir);
        return true;
      }
    } catch { /* outro processo pegou */ }
    return false;
  }
}

const readState = () => { try { return JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { return {}; } };
const writeState = (s) => fs.writeFileSync(stateFile, JSON.stringify(s, null, 2));

function readOutbox() {
  if (!fs.existsSync(outboxPath(root))) return [];
  return fs.readFileSync(outboxPath(root), 'utf8').split('\n').filter((l) => l.trim()).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

function accessToken() {
  const cache = path.join(os.tmpdir(), `my-task-token-${os.userInfo().uid}.json`);
  try {
    const c = JSON.parse(fs.readFileSync(cache, 'utf8'));
    if (c.exp > Date.now()) return c.token;
  } catch { /* sem cache */ }
  const token = execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8', timeout: 20_000 }).trim();
  fs.writeFileSync(cache, JSON.stringify({ token, exp: Date.now() + 45 * 60_000 }), { mode: 0o600 });
  return token;
}

async function sendLocal(rows, t) {
  const { project, dataset = 'auditoria_ia', table = 'eventos' } = t.local;
  const url = `https://bigquery.googleapis.com/bigquery/v2/projects/${project}/datasets/${dataset}/tables/${table}/insertAll`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ignoreUnknownValues: true, rows: rows.map((r) => ({ insertId: r.hash, json: r })) }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.insertErrors?.length) throw new Error(`BigQuery ${res.status}: ${JSON.stringify(body.error ?? body.insertErrors).slice(0, 300)}`);
}

async function sendCentral(rows, t) {
  const res = await fetch(`${t.central.url.replace(/\/$/, '')}/eventos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Painel-Token': t.central.token },
    body: JSON.stringify({ rows }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`painel central ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

async function main() {
  if (!takeLock()) return;
  try {
    const { config } = loadConfig(root);
    const t = config.telemetry ?? {};
    const senders = { local: sendLocal, central: sendCentral };
    for (;;) {
      const rows = readOutbox();
      const state = readState();
      let pending = false;
      for (const dest of destinations(config)) {
        const sent = state[dest]?.sent ?? 0;
        if (sent >= rows.length) continue;
        pending = true;
        const batch = rows.slice(sent, sent + BATCH);
        try {
          await senders[dest](batch, t);
          state[dest] = { sent: sent + batch.length, lastOk: new Date().toISOString(), lastError: null };
          log(`${dest}: ${batch.length} eventos enviados (${sent + batch.length}/${rows.length})`);
        } catch (err) {
          state[dest] = { ...state[dest], sent, lastError: err.message, lastErrorAt: new Date().toISOString() };
          log(`${dest}: falhou — ${err.message}`);
          writeState(state);
          return; // tenta de novo na próxima ação do agente
        }
        writeState(state);
        fs.utimesSync(lockDir, new Date(), new Date());
      }
      if (!pending || process.argv.includes('--once') || Date.now() > DEADLINE) return;
    }
  } finally {
    fs.rmSync(lockDir, { recursive: true, force: true });
  }
}

main().catch((err) => log(`erro: ${err.message}`));
