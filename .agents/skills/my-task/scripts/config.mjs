#!/usr/bin/env node
// Configuração da skill my-task: padrão da skill ← global (~/.ai/my-task.json) ← projeto (.ai/my-task.json).
// Escalares e objetos: o projeto vence chave a chave. Listas: somam (padrão, global, projeto), sem duplicar.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const SKILL_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const DEFAULT_FILE = path.join(SKILL_DIR, 'assets', 'config.default.json');
export const GLOBAL_FILE = path.join(os.homedir(), '.ai', 'my-task.json');
export const projectFile = (root) => path.join(root, '.ai', 'my-task.json');

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`${file} não é um JSON válido: ${err.message}`);
  }
}

function keyOf(item) {
  return typeof item === 'object' ? JSON.stringify(item) : String(item);
}

export function merge(base, over) {
  if (over === undefined || over === null) return base;
  if (Array.isArray(base) && Array.isArray(over)) {
    const seen = new Set(base.map(keyOf));
    return [...base, ...over.filter((i) => !seen.has(keyOf(i)) && seen.add(keyOf(i)))];
  }
  if (base && typeof base === 'object' && !Array.isArray(base) && typeof over === 'object' && !Array.isArray(over)) {
    const out = { ...base };
    for (const [k, v] of Object.entries(over)) out[k] = k in base ? merge(base[k], v) : v;
    return out;
  }
  return over;
}

export function loadConfig(root = process.cwd()) {
  const sources = [];
  let config = readJson(DEFAULT_FILE) ?? {};
  sources.push({ scope: 'padrão da skill', file: DEFAULT_FILE });
  for (const [scope, file] of [['global', GLOBAL_FILE], ['projeto', projectFile(root)]]) {
    const data = readJson(file);
    if (data) {
      config = merge(config, data);
      sources.push({ scope, file });
    }
  }
  const sha256 = crypto.createHash('sha256').update(JSON.stringify(config)).digest('hex');
  return { config, sources, sha256 };
}

export function getPath(obj, dotted, fallback) {
  const value = dotted.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
  return value === undefined ? fallback : value;
}

const HELP = `Uso:
  node config.mjs              mostra a configuração efetiva e de onde ela veio
  node config.mjs get <chave>  lê uma chave (ex.: agents.max_parallel)
  node config.mjs --help       esta ajuda

Arquivos (o de baixo vence):
  ${DEFAULT_FILE}
  ${GLOBAL_FILE}
  <projeto>/.ai/my-task.json`;

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, key] = process.argv.slice(2);
  if (cmd === '--help' || cmd === '-h') {
    console.log(HELP);
  } else {
    const { config, sources, sha256 } = loadConfig();
    if (cmd === 'get') {
      const v = getPath(config, key ?? '');
      console.log(typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v));
    } else {
      console.log('# Fontes (a última vence):');
      sources.forEach((s) => console.log(`#   ${s.scope}: ${s.file}`));
      console.log(`# sha256: ${sha256}`);
      console.log(JSON.stringify(config, null, 2));
    }
  }
}
