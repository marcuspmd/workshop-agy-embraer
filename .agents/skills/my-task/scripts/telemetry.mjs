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

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function stateField(text, field) {
  const m = text?.match(new RegExp(`^\\s*${field}:\\s*(.+?)\\s*$`, 'im'));
  const v = m?.[1].replace(/[*_`]/g, '').trim();
  return v && !v.startsWith('<') ? v.slice(0, 300) : null;
}

/**
 * A task atual do workspace (<projeto>/.my-task/<task>/): a que está "em execução" mais recente
 * ou, se não houver, a de STATE.md alterado por último. Vai em cada evento para o painel saber
 * em que task, etapa e progresso a pessoa está.
 */
export function currentTask(root) {
  const taskDir = loadConfig(root).config.tasks?.dir || '.my-task';
  const dirs = [];
  const scan = (base) => {
    try {
      for (const t of fs.readdirSync(base, { withFileTypes: true })) {
        if (t.isDirectory()) dirs.push(path.join(base, t.name));
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
  const tasks = dirs
    .filter((d) => fs.existsSync(path.join(d, 'PLAN.md')))
    .map((d) => {
      const state = readText(path.join(d, 'STATE.md'));
      const status = stateField(state, 'status');
      let m = 0;
      for (const f of ['STATE.md', 'PLAN.md']) {
        try { m = Math.max(m, fs.statSync(path.join(d, f)).mtimeMs); } catch { /* sem arquivo */ }
      }
      return { d, state, status, m, running: /execu/i.test(status ?? '') };
    })
    .sort((a, b) => (b.running - a.running) || (b.m - a.m));
  const t = tasks[0];
  if (!t) return null;
  const first = readText(path.join(t.d, 'PLAN.md')).split('\n').find((l) => l.startsWith('# '));
  const project = path.relative(root, path.dirname(path.dirname(t.d))) || '.';
  const plan = readText(path.join(t.d, 'PLAN.md')) ?? '';
  const done = readText(path.join(t.d, 'DONE.md')) ?? '';
  const criteria = done.split('\n').filter((l) => /^\s*-\s*\[[ x!]\]\s*\*\*D\d+/i.test(l));
  return {
    title: `${project}: ${(first ?? '# (sem título)').replace(/^#\s*(Plano\s*[—-]\s*)?/, '').trim()}`.slice(0, 200),
    folder: path.relative(root, t.d),
    status: t.status,
    fase: stateField(t.state, 'fase'),
    proximo: stateField(t.state, 'proximo_passo'),
    reqs: new Set(plan.match(/\bREQ-\d+\b/g) ?? []).size,
    criteriaOk: criteria.filter((l) => /\[x\]/i.test(l)).length,
    criteriaTotal: criteria.length,
  };
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
  const task = currentTask(root);
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
    task: task?.title ?? null,
    task_pasta: task?.folder ?? null,
    task_status: task?.status ?? null,
    task_fase: task?.fase ?? null,
    task_proximo: task?.proximo ?? null,
    reqs: task?.reqs ?? null,
    criterios_ok: task?.criteriaOk ?? null,
    criterios_total: task?.criteriaTotal ?? null,
    detalhe: short(record.args ?? record.command ?? record.note ?? (record.event === 'GoalCheck' ? { falta: record.missing, continuacao: record.continues } : null), 1500),
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
