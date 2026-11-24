// Telemetria da my-task: cada evento gravado na trilha local (.audit/log.jsonl) também entra numa
// fila (.audit/outbox.jsonl). Um processo em segundo plano (shipper.mjs) envia a fila para o
// BigQuery do próprio projeto e, se configurado, para o painel central do time.
// Nada aqui bloqueia o agy: se o envio falhar, a fila espera e a trilha local continua valendo.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.mjs';

const SHIPPER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'shipper.mjs');
export const outboxPath = (root) => path.join(root, '.audit', 'outbox.jsonl');

export function destinations(config) {
  const t = config.telemetry ?? {};
  if (t.enabled === false) return [];
  const out = [];
  if (t.local?.project) out.push('local');
  if (t.central?.url && t.central?.token) out.push('central');
  return out;
}

function planTitle(root) {
  // Título do plano da task mais recente (<projeto>/.my-task/<task>/PLAN.md), para saber de qual task é o evento.
  const taskDir = loadConfig(root).config.tasks?.dir || '.my-task';
  const candidates = [];
  const scan = (base) => {
    try {
      for (const t of fs.readdirSync(base, { withFileTypes: true })) {
        if (t.isDirectory()) candidates.push(path.join(base, t.name, 'PLAN.md'));
      }
    } catch {
      // projeto sem tasks
    }
  };
  scan(path.join(root, taskDir));
  try {
    for (const d of fs.readdirSync(root, { withFileTypes: true })) {
      if (d.isDirectory() && !d.name.startsWith('.') && !['node_modules', '.venv'].includes(d.name)) scan(path.join(root, d.name, taskDir));
    }
  } catch {
    return null;
  }
  const found = candidates
    .filter((f) => fs.existsSync(f))
    .map((f) => ({ f, m: fs.statSync(f).mtimeMs }))
    .sort((a, b) => b.m - a.m)[0];
  if (!found) return null;
  const first = fs.readFileSync(found.f, 'utf8').split('\n').find((l) => l.startsWith('# '));
  const project = path.relative(root, path.dirname(path.dirname(path.dirname(found.f)))) || '.';
  return `${project}: ${(first ?? '# (sem título)').replace(/^#\s*(Plano\s*[—-]\s*)?/, '').trim()}`.slice(0, 200);
}

function short(value, max = 500) {
  if (value == null) return null;
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/** Converte um registro da trilha numa linha da tabela auditoria_ia.eventos. */
export function toRow(root, record, config) {
  const t = config.telemetry ?? {};
  let resultado = null;
  if (record.event === 'QualityGate') resultado = record.passed === true ? 'passou' : record.passed === false ? 'falhou' : 'inconclusivo';
  if (record.event === 'HumanReview') resultado = record.decision ?? null;
  return {
    ts: record.ts,
    participante: t.participant || record.reviewer || record.osUser || os.userInfo().username,
    projeto_gcp: t.local?.project ?? null,
    workspace: path.basename(root),
    conversa: record.conversationId ?? null,
    seq: record.seq,
    evento: record.event,
    ator: record.actor ?? null,
    modelo: record.model ?? null,
    ferramenta: record.tool ?? null,
    decisao: record.event === 'PreToolUse' ? record.decision ?? null : null,
    motivo: short(record.reason, 300),
    resultado,
    arquivos: (record.files ?? []).map((f) => f.path).slice(0, 50),
    pedido: short(record.userInput, 500),
    task: planTitle(root),
    detalhe: short(record.args ?? record.command ?? record.note ?? null, 1500),
    hash: record.hash,
    prev_hash: record.prevHash,
  };
}

/** Põe o registro na fila e acorda o envio em segundo plano. Nunca lança erro. */
export function enqueue(root, record) {
  try {
    const { config } = loadConfig(root);
    if (!destinations(config).length) return;
    fs.appendFileSync(outboxPath(root), `${JSON.stringify(toRow(root, record, config))}\n`);
    wakeShipper(root);
  } catch {
    // telemetria é complementar: a trilha local já foi gravada
  }
}

export function wakeShipper(root) {
  if (process.env.MYTASK_NO_SHIP === '1') return;
  try {
    const child = spawn(process.execPath, [SHIPPER, root], { detached: true, stdio: 'ignore' });
    child.unref();
  } catch {
    // sem envio agora; a próxima ação tenta de novo
  }
}
