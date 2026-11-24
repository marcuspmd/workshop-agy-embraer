#!/usr/bin/env node
// Situação da my-task no workspace: instalação, padrões, auditoria, plano e revisão.
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './config.mjs';
import { analyze, currentTasks } from './audit-analyze.mjs';
import { destinations, outboxPath } from './telemetry.mjs';

const HELP = `Uso: node .agents/skills/my-task/scripts/status.mjs [--brief] [--json]

Mostra se a my-task está instalada neste workspace (config, hooks, rules, agentes),
a integridade da auditoria, a cobertura dos requisitos do PLAN.md e a situação da revisão humana.
  --brief  uma linha por item, para o agente checar antes de começar
  --json   saída em JSON
Sai com código 3 quando a instalação está incompleta.`;

if (process.argv.includes('--help')) {
  console.log(HELP);
  process.exit(0);
}

const root = process.cwd();
const exists = (rel) => fs.existsSync(path.join(root, rel));
const listMd = (dir) => (exists(dir) ? fs.readdirSync(path.join(root, dir)).filter((n) => n.startsWith('my-task-') && n.endsWith('.md')).sort() : []);

let hooksOk = false;
try {
  hooksOk = Boolean(JSON.parse(fs.readFileSync(path.join(root, '.agents', 'hooks.json'), 'utf8'))['my-task']);
} catch {
  hooksOk = false;
}

const { config, sources, sha256 } = loadConfig(root);
const a = analyze(root);
const { requirements, uncovered } = a.trace;
const status = {
  installed: exists('.ai/my-task.json') && hooksOk && a.exists,
  config: { project: exists('.ai/my-task.json'), sources: sources.map((s) => s.scope), sha256 },
  hooks: hooksOk,
  rules: listMd('.agents/rules'),
  agents: listMd('.agents/agents'),
  agentsEnabled: config.agents?.enabled !== false,
  maxParallel: config.agents?.max_parallel ?? 2,
  qualityGate: config.quality_gate?.enabled === false ? null : (config.quality_gate?.command || config.commands?.test || 'ligado, sem comando de testes no config'),
  audit: { exists: a.exists, ok: a.chain.ok, events: a.chain.count, reason: a.chain.ok ? null : a.chain.reason },
  plan: { exists: a.trace.plans.length > 0, files: a.trace.plans, requirements: requirements.size, uncovered },
  tasks: currentTasks(root).map((t) => ({ path: t.rel, project: t.project, status: t.status })),
  review: a.reviewStatus,
  telemetry: telemetryStatus(),
};

function telemetryStatus() {
  const dests = destinations(config);
  let total = 0;
  try { total = fs.readFileSync(outboxPath(root), 'utf8').split('\n').filter((l) => l.trim()).length; } catch { total = 0; }
  let state = {};
  try { state = JSON.parse(fs.readFileSync(path.join(root, '.audit', 'outbox-state.json'), 'utf8')); } catch { state = {}; }
  return {
    participant: config.telemetry?.participant ?? null,
    destinations: dests.map((d) => ({ name: d, pending: total - (state[d]?.sent ?? 0), lastError: state[d]?.lastError ?? null })),
  };
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(status, null, 2));
} else {
  const yes = (v) => (v ? '✅' : '❌');
  console.log(`${yes(status.installed)} my-task ${status.installed ? 'instalada' : 'NÃO instalada — rode /my-task init'}`);
  console.log(`${yes(status.config.project)} config: ${status.config.sources.join(' ← ')} (sha ${sha256.slice(0, 12)})`);
  console.log(`${yes(status.hooks)} hooks em .agents/hooks.json`);
  console.log(`${yes(status.rules.length)} rules: ${status.rules.join(', ') || 'nenhuma'}`);
  console.log(`${status.agentsEnabled ? yes(status.agents.length) : '⏸️ '} subagentes: ${status.agentsEnabled ? `${status.agents.join(', ') || 'nenhum'} (até ${status.maxParallel} em paralelo)` : 'desligados no config'}`);
  console.log(`${!status.qualityGate ? '⏸️ ' : status.qualityGate.startsWith('ligado, sem') ? '⚠️ ' : '✅'} portão de qualidade: ${status.qualityGate ?? 'desligado'}`);
  console.log(`${yes(status.audit.ok)} auditoria: ${status.audit.exists ? (status.audit.ok ? `íntegra, ${status.audit.events} eventos` : `QUEBRADA (${status.audit.reason})`) : 'sem registro'}`);
  const tel = status.telemetry;
  const label = { local: 'BigQuery do projeto', central: 'painel central' };
  console.log(tel.destinations.length
    ? `${tel.destinations.every((d) => !d.lastError) ? '✅' : '⚠️ '} painel: ${tel.participant ?? '(sem nome)'} → ${tel.destinations.map((d) => `${label[d.name]} (${d.pending} na fila${d.lastError ? `, erro: ${d.lastError}` : ''})`).join(', ')}`
    : '➖ painel: telemetria desligada — rode conectar-painel.mjs');
  if (!process.argv.includes('--brief') || status.plan.exists) {
    for (const t of status.tasks) console.log(`${t.status === 'concluido' ? '✅' : t.status === 'em execucao' ? '⏳' : '➖'} task: ${t.path} (${t.status ?? 'sem STATE.md'})`);
    console.log(`${status.plan.exists ? yes(!uncovered.length) : '➖'} plano: ${status.plan.exists ? `${status.plan.files.join(', ')}: ${status.plan.requirements} requisitos, ${uncovered.length} sem teste${uncovered.length ? ` (${uncovered.join(', ')})` : ''}` : 'nenhuma task em .my-task/'}`);
    console.log(`${status.review.state === 'EM DIA' ? '✅' : '⏳'} revisão humana: ${status.review.text}`);
  }
}
process.exit(status.installed ? 0 : 3);
