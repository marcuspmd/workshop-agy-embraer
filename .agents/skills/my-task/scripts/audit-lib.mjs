// Biblioteca compartilhada da auditoria da skill my-task.
// Registro em JSON Lines com cadeia de hashes (cada linha carrega o hash da anterior),
// para que qualquer alteração ou remoção de linha seja detectável.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { enqueue } from './telemetry.mjs';

export const GENESIS = '0'.repeat(64);
export const LOG_NAME = 'log.jsonl';

export const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');

export function resolveRoot(payload) {
  const first = payload?.workspacePaths?.[0];
  if (typeof first === 'string' && first.length > 0) {
    return first.startsWith('file://') ? fileURLToPath(first) : first;
  }
  return process.cwd();
}

export function auditDir(root) {
  const dir = path.join(root, '.audit');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export const logPath = (root) => path.join(auditDir(root), LOG_NAME);

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function withLock(dir, fn) {
  const lock = path.join(dir, '.lock');
  const started = Date.now();
  for (;;) {
    try {
      fs.mkdirSync(lock);
      break;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      if (Date.now() - started > 5000) {
        fs.rmSync(lock, { recursive: true, force: true }); // trava abandonada
        continue;
      }
      sleep(25);
    }
  }
  try {
    return fn();
  } finally {
    fs.rmSync(lock, { recursive: true, force: true });
  }
}

export function readEntries(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch {
        return { __invalid: true, __line: index + 1 };
      }
    });
}

export function hashRecord(record) {
  const { hash, ...rest } = record;
  return sha256(`${rest.prevHash}\n${JSON.stringify(rest)}`);
}

/** Acrescenta um evento no fim da cadeia e devolve o registro gravado. */
export function appendEntry(root, entry) {
  const dir = auditDir(root);
  const file = path.join(dir, LOG_NAME);
  const saved = withLock(dir, () => {
    const entries = readEntries(file);
    const last = entries.at(-1);
    const record = {
      seq: (last?.seq ?? 0) + 1,
      ts: new Date().toISOString(),
      ...entry,
      prevHash: last?.hash ?? GENESIS,
    };
    const full = { ...record, hash: hashRecord(record) };
    fs.appendFileSync(file, `${JSON.stringify(full)}\n`);
    return full;
  });
  enqueue(root, saved); // telemetria em segundo plano: BigQuery do projeto e painel central
  return saved;
}

/** Confere a cadeia inteira. Devolve { ok, count, brokenAt, reason }. */
export function verifyChain(file) {
  const entries = readEntries(file);
  let prev = GENESIS;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.__invalid) return { ok: false, count: entries.length, brokenAt: e.__line, reason: 'linha não é JSON válido' };
    if (e.seq !== i + 1) return { ok: false, count: entries.length, brokenAt: i + 1, reason: `sequência esperada ${i + 1}, encontrada ${e.seq} (linha removida ou inserida)` };
    if (e.prevHash !== prev) return { ok: false, count: entries.length, brokenAt: e.seq, reason: 'prevHash não bate com a linha anterior' };
    if (hashRecord(e) !== e.hash) return { ok: false, count: entries.length, brokenAt: e.seq, reason: 'conteúdo da linha foi alterado' };
    prev = e.hash;
  }
  return { ok: true, count: entries.length, lastHash: prev };
}

const SECRET_PATTERNS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[CHAVE PRIVADA REMOVIDA]'],
  [/AIza[0-9A-Za-z_-]{35}/g, '[REDACTED]'],
  [/gh[pousr]_[A-Za-z0-9]{36,}/g, '[REDACTED]'],
  [/\b(api[_-]?key|token|secret|password|passwd|senha)\b(\s*[:=]\s*)("[^"]*"|'[^']*'|\S+)/gi, '$1$2[REDACTED]'],
];

export function redact(text) {
  if (typeof text !== 'string') return text;
  return SECRET_PATTERNS.reduce((acc, [re, rep]) => acc.replace(re, rep), text);
}

/** Resume argumentos de ferramenta: textos longos viram hash + tamanho. */
export function summarize(value, depth = 0) {
  if (depth > 4) return '[...]';
  if (typeof value === 'string') {
    if (value.length > 300) {
      return { sha256: sha256(value), length: value.length, preview: redact(value.slice(0, 80)) };
    }
    return redact(value);
  }
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => summarize(v, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, summarize(v, depth + 1)]));
  }
  return value;
}

/** Textos curtos (sem quebra de linha) dentro dos argumentos: candidatos a caminho ou comando. */
export function shortStrings(value, out = []) {
  if (typeof value === 'string') {
    if (value.length <= 300 && !value.includes('\n')) out.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((v) => shortStrings(v, out));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((v) => shortStrings(v, out));
  }
  return out;
}

export function fileFingerprint(root, candidate) {
  const abs = path.isAbsolute(candidate) ? candidate : path.join(root, candidate);
  try {
    const stat = fs.statSync(abs);
    if (!stat.isFile()) return null;
    const rel = path.relative(root, abs);
    if (rel.startsWith('..')) return null;
    return { path: rel.split(path.sep).join('/'), sha256: sha256(fs.readFileSync(abs)), bytes: stat.size };
  } catch {
    return null;
  }
}

export function readState(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(auditDir(root), 'state.json'), 'utf8'));
  } catch {
    return {};
  }
}

export function writeState(root, state) {
  fs.writeFileSync(path.join(auditDir(root), 'state.json'), JSON.stringify(state, null, 2));
}

/** Fotografia dos padrões em vigor: config efetiva, SKILL.md, rules e agentes da my-task (com hash). */
export function standardsSnapshot(root, configSha) {
  const list = (dir, prefix) => {
    const abs = path.join(root, dir);
    if (!fs.existsSync(abs)) return [];
    return fs
      .readdirSync(abs)
      .filter((n) => n.startsWith(prefix) && n.endsWith('.md'))
      .sort()
      .map((n) => fileFingerprint(root, path.join(dir, n)))
      .filter(Boolean);
  };
  return {
    configSha256: configSha ?? null,
    skill: fileFingerprint(root, '.agents/skills/my-task/SKILL.md'),
    rules: list('.agents/rules', 'my-task-'),
    agents: list('.agents/agents', 'my-task-'),
  };
}
