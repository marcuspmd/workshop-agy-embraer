// Análise do registro de auditoria, usada por audit-report.mjs e status.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileFingerprint, readEntries, verifyChain } from './audit-lib.mjs';
import { loadConfig } from './config.mjs';

export function listTestFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.audit', '.agents', '.git', '.ai', '.my-task', '.venv', '__pycache__'].includes(item.name)) continue;
    const full = path.join(dir, item.name);
    if (item.isDirectory()) listTestFiles(full, out);
    else if (/\.(test|spec)\.[cm]?[jt]s$/.test(item.name) || /^test_.*\.py$|_test\.py$/.test(item.name) || (/[\/\\]tests?[\/\\]/.test(full) && /\.([cm]?[jt]s|py)$/.test(item.name))) out.push(full);
  }
  return out;
}

// Ferramentas nativas do Antigravity; as demais (por exemplo, de servidores MCP) aparecem como externas no relatório.
const BUILTIN_TOOLS = new Set(['view_file', 'write_to_file', 'replace_file_content', 'multi_replace_file_content', 'list_dir', 'find_by_name', 'grep_search', 'search_web', 'read_url_content', 'run_command', 'manage_task', 'schedule', 'list_permissions', 'ask_permission', 'invoke_subagent', 'define_subagent', 'send_message', 'manage_subagents', 'ask_question', 'generate_image']);

/** Status da task, na linha "status:" do STATE.md, sem acento e em minúsculas (ex.: "em execucao"). */
export function taskStatus(stateFile) {
  try {
    const m = fs.readFileSync(stateFile, 'utf8').match(/^\s*status:\s*(.+?)\s*$/im);
    return m ? m[1].replace(/[*_`]/g, '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : null;
  } catch {
    return null;
  }
}

/**
 * Tasks do workspace: <root>/.my-task/<task>/ (task do workspace inteiro) e <root>/<projeto>/.my-task/<task>/.
 * Ordem: por projeto e pelo nome da pasta, que começa pela data (AAAA-MM-DD-slug).
 */
export function listTasks(root) {
  const taskDir = loadConfig(root).config.tasks?.dir || '.my-task';
  const out = [];
  const scan = (project) => {
    const base = path.join(root, project === '.' ? '' : project, taskDir);
    if (!fs.existsSync(base)) return;
    for (const d of fs.readdirSync(base, { withFileTypes: true }).filter((x) => x.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      const dir = path.join(base, d.name);
      out.push({ project, slug: d.name, dir, rel: path.relative(root, dir), plan: path.join(dir, 'PLAN.md'), status: taskStatus(path.join(dir, 'STATE.md')) });
    }
  };
  scan('.');
  if (fs.existsSync(root)) {
    for (const d of fs.readdirSync(root, { withFileTypes: true })) {
      if (d.isDirectory() && !d.name.startsWith('.') && !['node_modules', '__pycache__'].includes(d.name)) scan(d.name);
    }
  }
  return out;
}

/** A task que vale para a rastreabilidade de cada projeto: a que está em execução, ou a mais recente. */
export function currentTasks(root) {
  const byProject = new Map();
  for (const t of listTasks(root)) {
    const prev = byProject.get(t.project);
    if (!prev || prev.status !== 'em execucao' || t.status === 'em execucao') byProject.set(t.project, t);
  }
  return [...byProject.values()];
}

/** Planos considerados: o PLAN.md da task atual de cada projeto. */
export function planFiles(root) {
  return currentTasks(root).filter((t) => fs.existsSync(t.plan)).map((t) => ({ dir: t.project, file: t.plan, task: t }));
}

export function traceability(root) {
  // Cada requisito é identificado pelo projeto do plano: "frota-api/REQ-01". O plano da raiz usa só "REQ-01".
  const requirements = new Map();
  const coverage = new Map();
  for (const plan of planFiles(root)) {
    const prefix = plan.dir === '.' ? '' : `${plan.dir}/`;
    for (const raw of fs.readFileSync(plan.file, 'utf8').split('\n')) {
      const line = raw.replace(/[*_`]/g, '');
      const m = line.match(/\b(REQ-\d+)\b\s*[:\-—)|]*\s*(.*)/);
      if (m) {
        const id = `${prefix}REQ-${m[1].split('-')[1].padStart(2, '0')}`;
        if (!requirements.has(id)) requirements.set(id, m[2].replace(/\|/g, ' ').trim());
      }
    }
    const testRoot = plan.dir === '.' ? root : path.join(root, plan.dir);
    for (const file of listTestFiles(testRoot)) {
      fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        for (const m of line.matchAll(/(?<![A-Za-z0-9])REQ[-_]?(\d+)(?!\d)/gi)) {
          const id = `${prefix}REQ-${m[1].padStart(2, '0')}`;
          const list = coverage.get(id) ?? [];
          const ref = `${path.relative(root, file)}:${i + 1}`;
          if (!list.includes(ref)) list.push(ref);
          coverage.set(id, list);
        }
      });
    }
  }
  return {
    plans: planFiles(root).map((p) => path.relative(root, p.file)),
    requirements,
    coverage,
    uncovered: [...requirements.keys()].filter((id) => !coverage.has(id)),
    orphanRefs: [...coverage.keys()].filter((id) => !requirements.has(id)),
  };
}

export function analyze(root) {
  const logFile = path.join(root, '.audit', 'log.jsonl');
  const exists = fs.existsSync(logFile);
  const entries = exists ? readEntries(logFile).filter((e) => !e.__invalid) : [];
  const chain = exists ? verifyChain(logFile) : { ok: false, count: 0, reason: 'sem registro' };

  const sessions = new Map();
  for (const e of entries) {
    if (!e.conversationId) continue;
    const s = sessions.get(e.conversationId) ?? { start: e.ts, models: new Set(), actions: 0, prompts: [], standards: null };
    if (e.model) s.models.add(e.model);
    if (e.event === 'PostToolUse') s.actions++;
    if (e.event === 'SessionStart') s.standards = e.standards ?? null;
    if (e.userInput && s.prompts.at(-1) !== e.userInput) s.prompts.push(e.userInput);
    sessions.set(e.conversationId, s);
  }

  const files = new Map();
  for (const e of entries) {
    if (e.event !== 'PostToolUse') continue;
    for (const f of e.files ?? []) {
      const prev = files.get(f.path);
      files.set(f.path, { ...f, changes: (prev?.changes ?? 0) + 1, lastSeq: e.seq });
    }
  }

  const reviews = entries.filter((e) => e.event === 'HumanReview');
  const lastReview = reviews.at(-1);
  let reviewStatus = { state: 'PENDENTE', text: 'PENDENTE — nenhuma revisão humana registrada.' };
  if (lastReview) {
    const changedAfter = [...files.values()].filter((f) => f.lastSeq > lastReview.seq).map((f) => f.path);
    const reviewedHash = new Map(lastReview.files.map((f) => [f.path, f.sha256]));
    const drifted = [...files.keys()].filter((p) => (fileFingerprint(root, p)?.sha256 ?? null) !== reviewedHash.get(p));
    const stale = [...new Set([...changedAfter, ...drifted])];
    reviewStatus = stale.length
      ? { state: 'DESATUALIZADA', text: `DESATUALIZADA — arquivos mudaram depois da última revisão: ${stale.join(', ')}.` }
      : { state: 'EM DIA', text: `EM DIA — ${lastReview.decision} por ${lastReview.reviewer} em ${lastReview.ts}.` };
  }

  return {
    logFile,
    exists,
    entries,
    chain,
    sessions,
    files,
    commands: entries.filter((e) => e.event === 'PostToolUse' && e.tool === 'run_command'),
    subagents: entries.filter((e) => e.event === 'PreToolUse' && /^(invoke_subagent|define_subagent)$/.test(e.tool ?? '')),
    external: entries.filter((e) => e.event === 'PreToolUse' && e.tool && !BUILTIN_TOOLS.has(e.tool)),
    denied: entries.filter((e) => e.event === 'PreToolUse' && e.decision === 'deny'),
    gates: entries.filter((e) => e.event === 'QualityGate'),
    installs: entries.filter((e) => e.event === 'AuditInstalled' || e.event === 'StandardsRefreshed'),
    reviews,
    reviewStatus,
    transcripts: entries.filter((e) => e.event === 'Stop' && e.transcript?.archived),
    trace: traceability(root),
  };
}
