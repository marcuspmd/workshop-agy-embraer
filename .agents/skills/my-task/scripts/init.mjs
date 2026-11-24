#!/usr/bin/env node
// Instala a my-task no workspace atual: config, hooks, rules, agentes e auditoria.
// Rode na raiz do workspace (a pasta que contém .agents/skills/my-task/).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendEntry, fileFingerprint } from './audit-lib.mjs';
import { DEFAULT_FILE, SKILL_DIR, loadConfig, merge, projectFile } from './config.mjs';

const HELP = `Uso: node .agents/skills/my-task/scripts/init.mjs [opções]

Instala a my-task no workspace atual:
  .ai/my-task.json          configuração do projeto (ajustes finos)
  .agents/hooks.json        hooks de auditoria, política e portão de qualidade
  .agents/rules/my-task-*   rules geradas a partir do config
  .agents/agents/my-task-*  subagentes (explorer, test-writer, implementer, verifier)
  .audit/log.jsonl          registro auditável (cadeia de hashes)

Opções:
  --language <código>     idioma dos relatórios (padrão: pt-BR)
  --stack <nome>          linguagem principal: python, node ou auto (padrão: auto, detecta pelo repositório)
  --test-cmd "<comando>"  comando que roda os testes do projeto (usado pelo portão de qualidade)
  --max-parallel <n>      máximo de subagentes ao mesmo tempo (padrão: 2)
  --no-agents             não instala subagentes
  --no-quality-gate       não roda os testes quando o agente tenta encerrar
  --no-deps               exige aprovação humana para dependências novas
  --criteria "<texto>"    critério extra de pronto em toda tarefa (pode repetir)

Diretrizes do time (viram a rule my-task-padroes e critérios do verificador):
  --architecture <estilo>        seguir-o-projeto | camadas | hexagonal | clean | mvc | "texto livre"
  --architecture-notes "<texto>" observações de arquitetura (pastas, limites entre camadas, proibições)
  --test-types <lista>           tipos de teste exigidos, separados por vírgula: unitario,integracao,e2e
  --min-coverage <n>             cobertura mínima em % (0 = sem mínimo)
  --coverage-cmd "<comando>"     comando que mede a cobertura e falha abaixo do mínimo
  --convention "<texto>"         convenção do time (pode repetir)
  --force                 reescreve .ai/my-task.json mesmo se já existir
  --refresh               regenera hooks, rules e agentes a partir do config atual, sem mexer nele
  --dry-run               mostra o que faria, sem gravar nada
  --help                  esta ajuda

Depois de instalar ou atualizar, abra uma sessão NOVA do agy: /exit e depois agy.`;

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const values = (flag) => argv.flatMap((a, i) => (a === flag && argv[i + 1] ? [argv[i + 1]] : []));
const value = (flag) => values(flag)[0];

if (has('--help') || has('-h')) {
  console.log(HELP);
  process.exit(0);
}

const root = process.cwd();
const dryRun = has('--dry-run');
const refresh = has('--refresh');

if (!fs.existsSync(path.join(root, '.agents', 'skills', 'my-task'))) {
  console.error('Rode na raiz do workspace: a pasta que contém .agents/skills/my-task/.');
  process.exit(1);
}
const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor < 20) console.warn(`⚠️  Node ${process.versions.node} detectado. A my-task pede Node 20 ou mais recente.`);

const written = [];
function write(rel, content) {
  const abs = path.join(root, rel);
  if (dryRun) {
    console.log(`[dry-run] gravaria ${rel}`);
    return;
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  written.push(rel);
}
function remove(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return;
  if (dryRun) return console.log(`[dry-run] removeria ${rel}`);
  fs.rmSync(abs);
  written.push(`${rel} (removido)`);
}

// 1. Configuração do projeto
const cfgFile = projectFile(root);
const cfgRel = path.relative(root, cfgFile);
if (!refresh && (!fs.existsSync(cfgFile) || has('--force'))) {
  const overrides = {};
  if (value('--language')) overrides.language = value('--language');
  if (value('--stack')) overrides.standards = { stack: value('--stack') };
  if (value('--test-cmd')) overrides.commands = { test: value('--test-cmd') };
  if (value('--max-parallel')) overrides.agents = { max_parallel: Math.max(1, Number(value('--max-parallel')) || 1) };
  if (has('--no-agents')) overrides.agents = { ...overrides.agents, enabled: false };
  if (has('--no-quality-gate')) overrides.quality_gate = { enabled: false };
  if (has('--no-deps')) overrides.standards = { ...overrides.standards, allow_dependencies: false };
  if (values('--criteria').length) overrides.always_criteria = values('--criteria');
  const std = (patch) => { overrides.standards = { ...overrides.standards, ...patch }; };
  if (value('--architecture') || value('--architecture-notes')) {
    std({ architecture: { ...(value('--architecture') ? { style: value('--architecture') } : {}), ...(value('--architecture-notes') ? { notes: value('--architecture-notes') } : {}) } });
  }
  if (value('--test-types')) std({ test_types: value('--test-types').split(',').map((t) => t.trim()).filter(Boolean) });
  if (value('--min-coverage') || value('--coverage-cmd')) {
    std({ coverage: { ...(value('--min-coverage') ? { min: Math.max(0, Math.min(100, Number(value('--min-coverage')) || 0)) } : {}), ...(value('--coverage-cmd') ? { command: value('--coverage-cmd') } : {}) } });
  }
  if (values('--convention').length) std({ conventions: values('--convention') });
  const base = JSON.parse(fs.readFileSync(DEFAULT_FILE, 'utf8'));
  const full = { _doc: 'Ajustes finos da my-task. Guia: .agents/skills/my-task/references/config-guide.md', ...merge(base, overrides) };
  write(cfgRel, `${JSON.stringify(full, null, 2)}\n`);
} else if (!refresh) {
  console.log(`${cfgRel} já existe: mantido (use --force para reescrever).`);
}

const { config, sha256: configSha } = loadConfig(root);

// 2. Hooks
const hookScript = path.join(SKILL_DIR, 'scripts', 'audit-hook.mjs');
const handler = (event, timeout = 10) => ({ type: 'command', command: `node "${hookScript}" ${event}`, timeout });
const hooksRel = path.join('.agents', 'hooks.json');
let hooks = {};
try {
  hooks = JSON.parse(fs.readFileSync(path.join(root, hooksRel), 'utf8'));
} catch {
  hooks = {};
}
hooks['my-task'] = {
  SessionStart: [handler('SessionStart')],
  PreToolUse: [{ matcher: '*', hooks: [handler('PreToolUse')] }],
  PostToolUse: [{ matcher: '*', hooks: [handler('PostToolUse')] }],
  PostInvocation: [handler('PostInvocation')],
  Stop: [handler('Stop', (config.quality_gate?.timeout_seconds ?? 45) + 15)],
};
write(hooksRel, `${JSON.stringify(hooks, null, 2)}\n`);

// 3. Rules e agentes a partir dos templates
function detectStack() {
  const wanted = config.standards?.stack ?? 'auto';
  if (wanted && wanted !== 'auto') return wanted;
  const found = (names) => names.some((n) => fs.existsSync(path.join(root, n)));
  if (found(['pyproject.toml', 'requirements.txt', 'setup.py'])) return 'python';
  if (found(['package.json'])) return 'node';
  return null;
}
const stack = detectStack();
const STACKS = {
  python: { manager: '`pyproject.toml` (`uv add`)', test_example: 'def test_req_03_recusa_entrada_vazia():' },
  node: { manager: '`package.json` (`npm install`)', test_example: "test('REQ-03 recusa entrada vazia', ...)" },
};
const stackInfo = STACKS[stack] ?? { manager: 'o gerenciador de dependências do projeto', test_example: 'test_req_03_recusa_entrada_vazia' };
const testCmd = config.commands?.test || 'o comando de testes definido no PLAN.md';
const ARCHITECTURES = {
  'seguir-o-projeto': 'Siga a arquitetura que o projeto já usa (rules do projeto e código existente). Não introduza um padrão novo.',
  camadas: 'Arquitetura em camadas: entrada (rotas ou controllers) → serviços (regras de negócio) → repositórios (acesso a dados). Cada camada só chama a de baixo.',
  hexagonal: 'Hexagonal (ports & adapters): o domínio não importa framework nem banco; entradas e saídas passam por portas (interfaces) implementadas por adaptadores.',
  clean: 'Clean Architecture: entidades e casos de uso no centro, sem depender de framework; controllers, gateways e banco ficam nas camadas de fora; as dependências apontam para dentro.',
  mvc: 'MVC: models com dados e regras, views só com apresentação, controllers orquestram. Nenhuma regra de negócio na view.',
};
const TEST_TYPES = { unitario: 'unitários', integracao: 'de integração', e2e: 'ponta a ponta (e2e)' };
const arch = config.standards?.architecture ?? {};
const archStyle = arch.style || 'seguir-o-projeto';
const coverage = config.standards?.coverage ?? {};
const minCoverage = Number(coverage.min) || 0;
const coverageRule = !minCoverage
  ? 'Sem cobertura mínima definida: cubra todos os requisitos e os casos de borda do plano.'
  : coverage.command
    ? `Cobertura mínima de ${minCoverage}%, medida por \`${coverage.command}\`. A task não encerra abaixo disso.`
    : `Cobertura mínima de ${minCoverage}%. Defina no plano o comando que mede a cobertura e avise que uma pessoa precisa gravá-lo em standards.coverage.command.`;
const testTypes = (config.standards?.test_types ?? ['unitario']).map((t) => TEST_TYPES[t] ?? t).join(', ');
const conventions = config.standards?.conventions ?? [];
const vars = {
  language: config.language,
  deps_rule: config.standards?.allow_dependencies === false
    ? `Não adicione dependências novas em ${stackInfo.manager} sem aprovação de uma pessoa.`
    : `Dependências novas entram por ${stackInfo.manager} e são justificadas no README.`,
  req_rule: config.standards?.require_req_in_test_names === false
    ? 'Quando possível, cite no nome do teste o requisito (`REQ-xx`) que ele cobre.'
    : `O nome de todo teste cita o requisito que ele cobre, por exemplo \`${stackInfo.test_example}\`.`,
  max_function_lines: config.standards?.max_function_lines ?? 40,
  architecture_rule: ARCHITECTURES[archStyle] ?? `Arquitetura definida pelo time: ${archStyle}.`,
  architecture_notes: arch.notes ? `- ${arch.notes}` : '',
  test_types: testTypes,
  coverage_rule: coverageRule,
  conventions: conventions.map((c) => `- ${c}`).join('\n') || '- (nenhuma além das rules do projeto)',
  test_cmd: testCmd,
  always_criteria: (config.always_criteria ?? []).map((c) => `   - ${c}`).join('\n') || '   - (nenhum)',
  max_parallel: config.agents?.max_parallel ?? 2,
  model_explore: config.agents?.models?.explore ?? 'inherit',
  model_test_writer: config.agents?.models?.test_writer ?? 'inherit',
  model_implement: config.agents?.models?.implement ?? 'inherit',
  model_verifier: config.agents?.models?.verifier ?? 'inherit',
};
const render = (text) => text.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? String(vars[k]) : m));

function syncTemplates(kind, targetDir, wanted) {
  const srcDir = path.join(SKILL_DIR, 'assets', kind);
  const available = fs.readdirSync(srcDir).filter((n) => n.endsWith('.md')).map((n) => n.replace(/\.md$/, ''));
  for (const name of available) {
    const rel = path.join(targetDir, `my-task-${name}.md`);
    if (wanted.includes(name)) write(rel, render(fs.readFileSync(path.join(srcDir, `${name}.md`), 'utf8')));
    else remove(rel);
  }
  const unknown = wanted.filter((n) => !available.includes(n));
  if (unknown.length) console.warn(`⚠️  ${kind} desconhecidos no config, ignorados: ${unknown.join(', ')}`);
}
const ruleNames = [...new Set([...(config.rules?.install ?? ['auditoria', 'testes', 'padroes']), ...(stack && STACKS[stack] ? [stack] : [])])];
syncTemplates('rules', path.join('.agents', 'rules'), ruleNames);
syncTemplates('agents', path.join('.agents', 'agents'), config.agents?.enabled === false ? [] : ['explorer', 'test-writer', 'implementer', 'verifier']);

// 4. Registro da instalação na própria trilha de auditoria
if (!dryRun) {
  appendEntry(root, {
    event: refresh ? 'StandardsRefreshed' : 'AuditInstalled',
    actor: 'human',
    osUser: os.userInfo().username,
    configSha256: configSha,
    files: written.filter((f) => !f.endsWith('(removido)')).map((f) => fileFingerprint(root, f)).filter(Boolean),
    removed: written.filter((f) => f.endsWith('(removido)')).map((f) => f.replace(' (removido)', '')),
  });
}

console.log(`\n✅ my-task ${refresh ? 'atualizada' : 'instalada'}${dryRun ? ' (simulação)' : ''}.`);
written.forEach((f) => console.log(`   ${f}`));
console.log(`\nLinguagem: ${stack ?? 'não detectada (use --stack python|node)'} · Testes: ${config.commands?.test ?? 'sem comando (use --test-cmd)'}`);
console.log(`Subagentes: ${config.agents?.enabled === false ? 'desligados' : `ligados, até ${vars.max_parallel} em paralelo`} · Portão de qualidade: ${config.quality_gate?.enabled === false ? 'desligado' : (config.quality_gate?.command || config.commands?.test) ? 'ligado' : 'ligado, mas sem comando de testes'} · Bloqueios no config: ${(config.policy?.blocked_commands ?? []).length} comandos, ${(config.policy?.blocked_tools ?? []).length} ferramentas`);
console.log(`Arquitetura: ${archStyle} · Testes exigidos: ${testTypes} · Cobertura mínima: ${minCoverage ? `${minCoverage}%${coverage.command ? '' : ' (sem comando)'}` : 'nenhuma'} · Convenções: ${conventions.length}`);
console.log('\n👉 Abra uma sessão NOVA do agy para hooks, rules e agentes valerem: /exit e depois agy.');
