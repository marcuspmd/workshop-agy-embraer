#!/usr/bin/env node
// Confere a integridade da cadeia de auditoria.
// Uso: node .agents/skills/my-task/scripts/audit-verify.mjs [--file caminho/log.jsonl]
import path from 'node:path';
import fs from 'node:fs';
import { verifyChain } from './audit-lib.mjs';

if (process.argv.includes('--help')) {
  console.log('Uso: node .agents/skills/my-task/scripts/audit-verify.mjs [--file caminho/log.jsonl]\nConfere a cadeia de hashes do registro. Sai com 1 se alguma linha foi alterada, removida ou inserida.');
  process.exit(0);
}

const i = process.argv.indexOf('--file');
const file = i > -1 ? path.resolve(process.argv[i + 1]) : path.join(process.cwd(), '.audit', 'log.jsonl');

if (!fs.existsSync(file)) {
  console.error(`Registro não encontrado: ${file}`);
  process.exit(2);
}

const result = verifyChain(file);
if (result.ok) {
  console.log(`✅ Integridade OK: ${result.count} eventos, cadeia íntegra.`);
  console.log(`   Último hash: ${result.lastHash}`);
} else {
  console.log(`❌ Integridade FALHOU no evento ${result.brokenAt}: ${result.reason}.`);
  console.log('   O registro foi alterado depois de gravado.');
  process.exit(1);
}
