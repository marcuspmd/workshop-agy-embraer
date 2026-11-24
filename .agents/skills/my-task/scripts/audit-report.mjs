#!/usr/bin/env node
// Gera AUDIT.md na raiz do workspace a partir de .audit/log.jsonl.
import fs from 'node:fs';
import path from 'node:path';
import { fileFingerprint, shortStrings } from './audit-lib.mjs';
import { analyze } from './audit-analyze.mjs';

if (process.argv.includes('--help')) {
  console.log(`Uso: node .agents/skills/my-task/scripts/audit-report.mjs

Gera AUDIT.md na raiz do workspace: integridade da cadeia, padrões em vigor em cada sessão,
prompts e modelos, arquivos alterados pela IA (com hash), comandos, subagentes, ações bloqueadas,
portão de qualidade, matriz de rastreabilidade (PLAN.md × testes) e situação da revisão humana.
Só lê o registro; não altera nada além do AUDIT.md.`);
  process.exit(0);
}

const root = process.cwd();
const a = analyze(root);
if (!a.exists) {
  console.error('Nenhum registro em .audit/log.jsonl. Rode /my-task init neste workspace.');
  process.exit(2);
}

const short = (s, n = 8) => (s ? String(s).slice(0, n) : '—');
const cell = (s) => String(s ?? '—').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const { requirements, coverage, uncovered, orphanRefs } = a.trace;
const out = [];
const table = (head, rows) => {
  out.push(`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`);
  rows.forEach((r) => out.push(`| ${r.join(' | ')} |`));
  out.push('');
};

out.push('# Relatório de auditoria da IA', '', `Gerado em ${new Date().toISOString()} a partir de \`.audit/log.jsonl\`.`, '');

out.push('## Resumo', '');
table(['Item', 'Valor'], [
  ['Integridade da cadeia', a.chain.ok ? `✅ íntegra (${a.chain.count} eventos)` : `❌ quebrada no evento ${a.chain.brokenAt}: ${a.chain.reason}`],
  ['Sessões do agente', a.sessions.size],
  ['Modelos usados', cell([...new Set([...a.sessions.values()].flatMap((s) => [...s.models]))].join(', ') || '—')],
  ['Arquivos alterados pela IA', a.files.size],
  ['Comandos executados pela IA', a.commands.length],
  ['Subagentes acionados', a.subagents.length],
  ['Chamadas a ferramentas externas (MCP)', a.external.length],
  ['Ações bloqueadas', a.denied.length],
  ['Requisitos sem teste', requirements.size ? uncovered.length : 'sem PLAN.md'],
  ['Revisão humana', cell(a.reviewStatus.text)],
]);

out.push('## Instalação e mudanças nos padrões', '');
table(['Evento', 'Data', 'Tipo', 'Por', 'Config (sha256)'], a.installs.map((e) => [
  e.seq, e.ts, e.event === 'AuditInstalled' ? 'instalação' : 'atualização dos padrões', cell(e.osUser), `\`${short(e.configSha256, 12)}\``,
]));

out.push('## Sessões, padrões em vigor e prompts', '');
for (const [id, s] of a.sessions) {
  out.push(`### Conversa \`${short(id, 12)}\``, '');
  out.push(`- Início: ${s.start}`, `- Modelo(s): ${[...s.models].join(', ') || '—'}`, `- Ações com ferramentas: ${s.actions}`);
  if (s.standards) {
    out.push(`- Config em vigor: \`${short(s.standards.configSha256, 12)}\``);
    if (s.standards.skill) out.push(`- Skill: \`${s.standards.skill.path}\` (\`${short(s.standards.skill.sha256, 12)}\`)`);
    for (const f of [...(s.standards.rules ?? []), ...(s.standards.agents ?? [])]) out.push(`- \`${f.path}\` (\`${short(f.sha256, 12)}\`)`);
  }
  if (s.prompts.length) {
    out.push('- Prompts do usuário:');
    s.prompts.forEach((p) => out.push(`  - ${cell(p.length > 300 ? `${p.slice(0, 300)}…` : p)}`));
  }
  out.push('');
}

out.push('## Arquivos alterados pela IA', '');
if (!a.files.size) out.push('Nenhum.', '');
else table(['Arquivo', 'Alterações', 'Último hash registrado', 'Situação atual'], [...a.files.values()]
  .sort((x, y) => x.path.localeCompare(y.path))
  .map((f) => {
    const now = fileFingerprint(root, f.path)?.sha256;
    const status = !now ? 'removido' : now === f.sha256 ? 'igual ao registrado' : '⚠️ alterado fora do registro';
    return [`\`${f.path}\``, f.changes, `\`${short(f.sha256, 12)}\``, status];
  }));

out.push('## Subagentes acionados', '');
if (!a.subagents.length) out.push('Nenhum.', '');
else table(['Evento', 'Ferramenta', 'Argumentos (resumo)', 'Decisão'], a.subagents.map((e) => [
  e.seq, e.tool, `\`${cell(shortStrings(e.args).join(' · ').slice(0, 160))}\``, e.decision,
]));

out.push('## Ferramentas externas (MCP)', '');
if (!a.external.length) out.push('Nenhuma.', '');
else table(['Evento', 'Ferramenta', 'Argumentos (resumo)', 'Decisão'], a.external.map((e) => [
  e.seq, `\`${cell(e.tool)}\``, `\`${cell(shortStrings(e.args).join(' · ').slice(0, 160))}\``, e.decision,
]));

out.push('## Comandos executados pela IA', '');
if (!a.commands.length) out.push('Nenhum.', '');
else table(['Evento', 'Comando', 'Erro'], a.commands.map((e) => [
  e.seq, `\`${cell(shortStrings(e.args).join(' ').slice(0, 200))}\``, e.error ? cell(e.error.slice(0, 120)) : '—',
]));

out.push('## Ações bloqueadas pelos hooks', '');
if (!a.denied.length) out.push('Nenhuma.', '');
else table(['Evento', 'Ferramenta', 'Motivo'], a.denied.map((e) => [e.seq, e.tool, cell(e.reason)]));

out.push('## Portão de qualidade', '');
if (!a.gates.length) out.push('Não rodou.', '');
else table(['Evento', 'Comando', 'Resultado', 'Tentativa'], a.gates.map((e) => [
  e.seq, `\`${cell(e.command)}\``, e.passed === null ? '⏳ inconclusivo (tempo ou erro ao rodar)' : e.passed ? '✅ passou' : `❌ falhou (código ${e.exitCode})`, e.retry + 1,
]));

out.push('## Matriz de rastreabilidade (PLAN.md × testes)', '');
if (!requirements.size) out.push('Sem `PLAN.md` com requisitos `REQ-xx`.', '');
else {
  table(['Requisito', 'Descrição', 'Testes', 'Situação'], [...requirements].map(([id, desc]) => {
    const tests = coverage.get(id);
    return [id, cell(desc), tests ? tests.map((t) => `\`${t}\``).join('<br>') : '—', tests ? '✅ coberto' : '❌ sem teste'];
  }));
  if (orphanRefs.length) out.push(`⚠️ Testes citam requisitos que não existem no plano: ${orphanRefs.join(', ')}.`, '');
}

out.push('## Revisão humana', '', `**Situação:** ${a.reviewStatus.text}`, '');
if (a.reviews.length) table(['Evento', 'Data', 'Revisor', 'Decisão', 'Observações'], a.reviews.map((r) => [
  r.seq, r.ts, cell(r.reviewer), r.decision, cell(r.notes || '—'),
]));
out.push('Para registrar: `node .agents/skills/my-task/scripts/audit-review.mjs --revisor "Nome" --decisao aprovado --obs "..."`', '');

if (a.transcripts.length) {
  out.push('## Transcrições arquivadas', '');
  const latest = new Map(a.transcripts.map((e) => [e.transcript.archived, e.transcript.sha256]));
  for (const [file, hash] of latest) out.push(`- \`${file}\` (sha256 \`${short(hash, 12)}\`)`);
  out.push('');
}

fs.writeFileSync(path.join(root, 'AUDIT.md'), out.join('\n'));
console.log(`AUDIT.md gerado. Integridade: ${a.chain.ok ? 'OK' : 'FALHOU'} · arquivos da IA: ${a.files.size} · subagentes: ${a.subagents.length} · bloqueios: ${a.denied.length} · requisitos sem teste: ${requirements.size ? uncovered.length : 'n/a'} · revisão: ${a.reviewStatus.text}`);
