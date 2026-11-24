#!/usr/bin/env node
// Cria a pasta de uma task a partir dos templates: <projeto>/.my-task/<AAAA-MM-DD-slug>/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listTasks } from './audit-analyze.mjs';
import { loadConfig } from './config.mjs';

const HELP = `Uso: node .agents/skills/my-task/scripts/new-task.mjs --project <pasta> --slug <nome-curto> [--force]

Cria <pasta>/.my-task/<AAAA-MM-DD-slug>/ com REQUEST.md, PLAN.md, DONE.md, STATE.md, LOG.md e REPORT.md
e imprime o caminho criado. Use --project . para uma task do workspace inteiro.
Recusa se o projeto já tem uma task "rascunho" ou "em execução" (use --force para criar mesmo assim).`;

const argv = process.argv.slice(2);
const value = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : undefined; };
if (argv.includes('--help') || argv.includes('-h')) {
  console.log(HELP);
  process.exit(0);
}

const root = process.cwd();
const project = (value('--project') ?? '.').replace(/[\/\\]+$/, '') || '.';
const slug = (value('--slug') ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
if (!slug) {
  console.error('Informe --slug (ex.: --slug horas-de-voo).');
  process.exit(1);
}
if (project !== '.' && !fs.existsSync(path.join(root, project))) {
  console.error(`Projeto não encontrado: ${project}. Rode na raiz do workspace.`);
  process.exit(1);
}

const open = listTasks(root).filter((t) => t.project === project && ['rascunho', 'em execucao'].includes(t.status));
if (open.length && !argv.includes('--force')) {
  console.error(`Já existe task aberta em ${project}: ${open.map((t) => `${t.rel} (${t.status})`).join(', ')}.\nConclua ou cancele (status: cancelado no STATE.md), ou use --force.`);
  process.exit(2);
}

const { config } = loadConfig(root);
const date = new Date().toISOString().slice(0, 10);
const name = `${date}-${slug}`;
const dir = path.join(root, project === '.' ? '' : project, config.tasks?.dir ?? '.my-task', name);
if (fs.existsSync(dir)) {
  console.error(`Já existe: ${path.relative(root, dir)}`);
  process.exit(2);
}

const templates = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'assets', 'templates');
fs.mkdirSync(dir, { recursive: true });
for (const file of ['REQUEST.md', 'PLAN.md', 'DONE.md', 'STATE.md', 'LOG.md', 'REPORT.md']) {
  const text = fs.readFileSync(path.join(templates, file), 'utf8')
    .replace('<projeto>', project)
    .replace('<AAAA-MM-DD-slug>', name)
    .replace('<AAAA-MM-DD HH:MM>', new Date().toISOString().slice(0, 16).replace('T', ' '));
  fs.writeFileSync(path.join(dir, file), text);
}
console.log(path.relative(root, dir));
