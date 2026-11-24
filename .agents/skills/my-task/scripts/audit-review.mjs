#!/usr/bin/env node
// Registra a revisão HUMANA do trabalho feito pela IA. Precisa ser rodado por uma pessoa, num terminal.
// Uso: node .agents/skills/my-task/scripts/audit-review.mjs --revisor "Nome" --decisao aprovado --obs "comentário"
// Decisões: aprovado | aprovado-com-ressalvas | reprovado
import readline from 'node:readline/promises';
import os from 'node:os';
import path from 'node:path';
import { appendEntry, fileFingerprint, readEntries, verifyChain } from './audit-lib.mjs';

const DECISIONS = ['aprovado', 'aprovado-com-ressalvas', 'reprovado'];
if (process.argv.includes('--help')) {
  console.log(`Uso: node .agents/skills/my-task/scripts/audit-review.mjs --revisor "Nome" --decisao <${DECISIONS.join('|')}> [--obs "comentário"]\nRegistra a revisão HUMANA do trabalho da IA. Só funciona num terminal interativo; a IA é bloqueada de rodar.`);
  process.exit(0);
}
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

const reviewer = arg('revisor');
const decision = arg('decisao');
const notes = arg('obs') ?? '';

if (!process.stdin.isTTY) {
  console.error('A revisão humana precisa ser feita num terminal interativo, por uma pessoa.');
  process.exit(1);
}
if (!reviewer || !DECISIONS.includes(decision)) {
  console.error(`Uso: --revisor "Nome" --decisao <${DECISIONS.join('|')}> [--obs "comentário"]`);
  process.exit(1);
}

const root = process.cwd();
const file = path.join(root, '.audit', 'log.jsonl');
const chain = verifyChain(file);
if (!chain.ok) {
  console.error(`A cadeia de auditoria está quebrada (evento ${chain.brokenAt}: ${chain.reason}). Revisão não registrada.`);
  process.exit(1);
}

// Estado atual de todos os arquivos que a IA alterou.
const aiFiles = new Set();
for (const e of readEntries(file)) if (e.event === 'PostToolUse') for (const f of e.files ?? []) aiFiles.add(f.path);
const files = [...aiFiles].sort().map((p) => fileFingerprint(root, p) ?? { path: p, sha256: null, missing: true });

console.log(`\nRevisor:  ${reviewer}`);
console.log(`Decisão:  ${decision}`);
console.log(`Arquivos: ${files.length} alterados pela IA`);
files.forEach((f) => console.log(`  - ${f.path}${f.missing ? ' (removido)' : ''}`));

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const answer = (await rl.question('\nVocê revisou esses arquivos e confirma a decisão? (s/N) ')).trim().toLowerCase();
rl.close();
if (answer !== 's') {
  console.log('Revisão não registrada.');
  process.exit(0);
}

const entry = appendEntry(root, {
  event: 'HumanReview',
  actor: 'human',
  reviewer,
  osUser: os.userInfo().username,
  decision,
  notes,
  reviewedUpToSeq: chain.count,
  reviewedUpToHash: chain.lastHash,
  files,
});
console.log(`\n✅ Revisão registrada (evento ${entry.seq}, hash ${entry.hash.slice(0, 12)}…).`);
