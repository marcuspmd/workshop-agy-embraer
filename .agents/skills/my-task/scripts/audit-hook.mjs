#!/usr/bin/env node
// Hook de auditoria e política da skill my-task. Chamado pelo Antigravity via .agents/hooks.json.
// Uso: node audit-hook.mjs <SessionStart|PreToolUse|PostToolUse|PostInvocation|Stop>  (payload JSON no stdin)
// Grava cada evento em .audit/log.jsonl (cadeia de hashes), aplica a política e roda o portão de qualidade.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  appendEntry, auditDir, fileFingerprint, readEntries, readState, redact, resolveRoot, sha256,
  shortStrings, standardsSnapshot, summarize, writeState,
} from './audit-lib.mjs';
import { loadConfig } from './config.mjs';
import { listTasks, listTestFiles, traceability } from './audit-analyze.mjs';

if (process.argv.includes('--help')) {
  console.log('Hook do Antigravity: node audit-hook.mjs <Evento> < payload.json\nEventos: SessionStart, PreToolUse, PostToolUse, PostInvocation, Stop.\nNão rode à mão: é chamado pelos hooks instalados por init.mjs.');
  process.exit(0);
}

const WRITE_TOOLS = /^(write_to_file|replace_file_content|multi_replace_file_content)$/;
const SUBAGENT_TOOLS = /^(invoke_subagent|define_subagent)$/;

// Proteções fixas: não dá para desligar pelo config. A IA não muda as regras do jogo durante o jogo.
const PROTECTED_PATH = /(^|[\/\\])(\.audit|\.agents)([\/\\]|$)|(^|[\/\\])\.ai[\/\\]my-task\.json$/;
const PROTECTED_MENTION = /\.audit|\.agents|my-task\.json/;
const SHELL_WRITES = /(>>?|\btee\b|\brm\b|\bmv\b|\bcp\b|\bsed\s+-i|\btruncate\b|\bchmod\b|\bln\b|\btouch\b)[^;&|]*(\.audit|\.agents|my-task\.json)/;
const READ_ONLY_COMMAND = /^(cat|head|tail|grep|wc|less|jq|ls)\b|^node\s+"?[^\s"]*my-task[\/\\]scripts[\/\\](status|audit-report|audit-verify|config|new-task)\.mjs\b/;
const FIXED_BLOCKS = [
  [/audit-review/, 'A revisão humana só pode ser registrada por uma pessoa, no terminal dela.'],
  [/my-task[\/\\]scripts[\/\\]init\.mjs/, 'A my-task já está instalada. Reinstalar ou reconfigurar é feito por uma pessoa, no terminal.'],
  [/conectar-painel/, 'Ligar ou mudar a telemetria do painel é feito por uma pessoa, no terminal.'],
];
const DEPENDENCY_INSTALL = /\b(npm\s+(install|i|add)|yarn\s+add|pnpm\s+(add|install|i)|uv\s+(add|pip\s+install)|pip3?\s+install)\b(\s+-\S+)*\s+[^-\s]/;

function readPayload() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const respond = (obj) => process.stdout.write(JSON.stringify(obj));

function policyFor(toolCall, config) {
  const name = toolCall?.name ?? '';
  const strings = shortStrings(toolCall?.args ?? {});

  if (WRITE_TOOLS.test(name) && strings.some((s) => PROTECTED_PATH.test(s.trim()))) {
    return { decision: 'deny', reason: 'Auditoria, configuração, skill, rules, agentes e hooks são protegidos contra alteração pela IA. Mudanças nos padrões são feitas por uma pessoa.' };
  }
  if (SUBAGENT_TOOLS.test(name) && config.agents?.enabled === false) {
    return { decision: 'deny', reason: 'Subagentes estão desligados no config (agents.enabled = false).' };
  }
  for (const rule of config.policy?.blocked_tools ?? []) {
    try {
      if (new RegExp(rule.pattern).test(name)) return { decision: 'deny', reason: rule.reason ?? `Ferramenta bloqueada pela política: ${rule.pattern}` };
    } catch {
      // padrão inválido no config: ignora esse item
    }
  }
  if (name !== 'run_command') return { decision: 'allow' };

  const command = strings.join(' ');
  for (const [re, reason] of FIXED_BLOCKS) if (re.test(command)) return { decision: 'deny', reason };
  if (SHELL_WRITES.test(command) || (PROTECTED_MENTION.test(command) && !READ_ONLY_COMMAND.test(command.trim()))) {
    return { decision: 'deny', reason: 'Comando alteraria auditoria, configuração ou arquivos da skill.' };
  }
  if (config.standards?.allow_dependencies === false && DEPENDENCY_INSTALL.test(command)) {
    return { decision: 'deny', reason: 'Dependências externas não são permitidas (standards.allow_dependencies = false no config).' };
  }
  for (const rule of config.policy?.blocked_commands ?? []) {
    try {
      if (new RegExp(rule.pattern).test(command)) return { decision: 'deny', reason: rule.reason ?? `Bloqueado pela política: ${rule.pattern}` };
    } catch {
      // padrão inválido no config: ignora esse item, os outros continuam valendo
    }
  }
  return { decision: 'allow' };
}

function touchedFiles(root, toolCall) {
  if (!WRITE_TOOLS.test(toolCall?.name ?? '')) return [];
  const seen = new Set();
  return shortStrings(toolCall.args ?? {})
    .map((s) => fileFingerprint(root, s.trim()))
    .filter((f) => f && !seen.has(f.path) && seen.add(f.path));
}

function archiveTranscript(root, payload, config) {
  const src = payload.transcriptPath;
  if (config.audit?.archive_transcripts === false || typeof src !== 'string' || !src) return null;
  try {
    if (!fs.statSync(src).isFile()) return { source: src, archived: false };
    const dir = path.join(auditDir(root), 'transcripts');
    fs.mkdirSync(dir, { recursive: true });
    const name = `${payload.conversationId ?? 'sem-id'}${path.extname(src)}`;
    const dest = path.join(dir, name);
    fs.copyFileSync(src, dest);
    return { source: src, archived: `.audit/transcripts/${name}`, sha256: sha256(fs.readFileSync(dest)) };
  } catch {
    return { source: src, archived: false };
  }
}

function runQualityGate(root, config) {
  const gate = config.quality_gate ?? {};
  const command = gate.command || config.commands?.test;
  if (gate.enabled === false || !command) return null;
  const markers = gate.when_exists ?? [];
  if (markers.length && !markers.some((m) => fs.existsSync(path.join(root, m)))) return null; // ainda não há código para testar
  if (!markers.length && !listTestFiles(root).length) return null; // nenhum arquivo de teste no workspace ainda
  const result = spawnSync(command, { cwd: root, encoding: 'utf8', shell: true, timeout: (gate.timeout_seconds ?? 120) * 1000 });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (result.error || result.status === null) {
    // estourou o tempo ou não rodou: registra como inconclusivo, sem prender o agente
    return { command, passed: null, exitCode: null, output: redact(`${result.error?.message ?? 'tempo esgotado'}\n${output.slice(-1000)}`) };
  }
  return { command, passed: result.status === 0, exitCode: result.status, output: redact(output.slice(-1500)) };
}

// Execução automática (execution.auto_start): enquanto um plano aprovado estiver "em execução", o Stop faz o papel
// do /goal e não deixa o agente encerrar antes dos critérios de pronto.
function goalPending(root, config, conversationId, gate) {
  if (config.execution?.auto_start === false) return null;
  const active = listTasks(root).filter((t) => t.status === 'em execucao');
  if (!active.length) return null;
  const missing = [];
  if (gate?.passed === false) missing.push(`os testes falham (${gate.command})`);
  const { uncovered } = traceability(root);
  for (const t of active) {
    if (!fs.existsSync(t.plan)) missing.push(`${t.rel}/PLAN.md não existe`);
    const prefix = t.project === '.' ? '' : `${t.project}/`;
    const ids = uncovered.filter((id) => (prefix ? id.startsWith(prefix) : !id.includes('/')));
    if (ids.length) missing.push(`requisitos sem teste com o REQ no nome: ${ids.join(', ')}`);
  }
  if (config.agents?.enabled !== false && config.agents?.independent_verifier !== false) {
    const logFile = path.join(auditDir(root), 'log.jsonl');
    const called = fs.existsSync(logFile) && readEntries(logFile).some((e) =>
      e.event === 'PreToolUse' && e.tool === 'invoke_subagent' && e.decision !== 'deny'
      && (!conversationId || e.conversationId === conversationId)
      && JSON.stringify(e.args ?? {}).includes('my-task-verifier'));
    if (!called) missing.push('o my-task-verifier ainda não foi acionado');
  }
  const coverage = runCoverage(root, config, gate);
  if (coverage?.passed === false) missing.push(`cobertura abaixo de ${config.standards.coverage.min}% (${coverage.command}): ${coverage.output.slice(-300)}`);
  const plans = active.map((t) => t.rel).join(', ');
  return { plans, missing, coverage };
}

// Cobertura mínima (standards.coverage): só roda quando os testes já passam. O comando deve falhar abaixo do mínimo.
function runCoverage(root, config, gate) {
  const { min, command } = config.standards?.coverage ?? {};
  if (!Number(min) || !command || gate?.passed === false) return null;
  const result = spawnSync(command, { cwd: root, encoding: 'utf8', shell: true, timeout: (config.quality_gate?.timeout_seconds ?? 120) * 1000 });
  const output = redact(`${result.stdout ?? ''}${result.stderr ?? ''}`.slice(-1500));
  if (result.error || result.status === null) return { command, passed: null, output };
  return { command, passed: result.status === 0, output };
}

function main() {
  const event = process.argv[2] ?? 'Unknown';
  const payload = readPayload();
  const root = resolveRoot(payload);
  const { config, sources, sha256: configSha } = loadConfig(root);
  const base = {
    event,
    actor: 'ai-agent',
    conversationId: payload.conversationId ?? null,
    model: payload.modelName ?? null,
    osUser: os.userInfo().username,
  };

  switch (event) {
    case 'SessionStart': {
      appendEntry(root, {
        ...base,
        userInput: redact(payload.lastUserInput ?? null),
        workspace: root,
        configSources: sources.map((s) => s.scope),
        standards: standardsSnapshot(root, configSha),
      });
      return respond({});
    }
    case 'PreToolUse': {
      const policy = policyFor(payload.toolCall, config);
      appendEntry(root, {
        ...base,
        stepIdx: payload.stepIdx ?? null,
        tool: payload.toolCall?.name ?? null,
        args: summarize(payload.toolCall?.args ?? {}),
        decision: policy.decision,
        reason: policy.reason ?? null,
      });
      return respond(policy);
    }
    case 'PostToolUse': {
      appendEntry(root, {
        ...base,
        stepIdx: payload.stepIdx ?? null,
        tool: payload.toolCall?.name ?? null,
        args: summarize(payload.toolCall?.args ?? {}),
        error: payload.error ? redact(String(payload.error)).slice(0, 1000) : null,
        files: touchedFiles(root, payload.toolCall),
      });
      return respond({});
    }
    case 'PostInvocation': {
      appendEntry(root, { ...base, invocationNum: payload.invocationNum ?? null, userInput: redact(payload.lastUserInput ?? null) });
      return respond({});
    }
    case 'Stop': {
      appendEntry(root, {
        ...base,
        terminationReason: payload.terminationReason ?? null,
        executionNum: payload.executionNum ?? null,
        fullyIdle: payload.fullyIdle ?? null,
        error: payload.error ? String(payload.error).slice(0, 1000) : null,
        transcript: archiveTranscript(root, payload, config),
      });
      // Só age no fim normal de turno (o agente parou sozinho); cancelamento, erro e limites passam direto.
      if (payload.terminationReason && !['model_stop', 'NO_TOOL_CALL'].includes(payload.terminationReason)) return respond({});

      const gate = runQualityGate(root, config);
      const state = readState(root);
      const key = payload.conversationId ?? 'sem-id';
      if (gate) {
        const maxRetries = config.quality_gate?.max_retries ?? 3;
        const retries = state.qualityRetries?.[key] ?? 0;
        appendEntry(root, { ...base, event: 'QualityGate', ...gate, retry: retries });
        if (gate.passed === false && retries < maxRetries) {
          writeState(root, { ...state, qualityRetries: { ...state.qualityRetries, [key]: retries + 1 } });
          return respond({
            decision: 'continue',
            reason: `O portão de qualidade rodou "${gate.command}" e falhou (tentativa ${retries + 1} de ${maxRetries}). Corrija antes de encerrar. Final da saída:\n${gate.output.slice(-600)}`,
          });
        }
      }

      const goal = goalPending(root, config, payload.conversationId, gate);
      if (!goal) return respond({});
      const maxContinues = config.execution?.max_continues ?? 30;
      const fresh = readState(root);
      const continues = fresh.goalContinues?.[key] ?? 0;
      appendEntry(root, { ...base, event: 'GoalCheck', tasks: goal.plans, missing: goal.missing, coverage: goal.coverage, continues });
      if (continues >= maxContinues) return respond({}); // limite atingido: deixa encerrar, fica registrado
      writeState(root, { ...fresh, goalContinues: { ...fresh.goalContinues, [key]: continues + 1 } });
      const todo = goal.missing.length
        ? `Ainda falta: ${goal.missing.join('; ')}.`
        : 'Os critérios automáticos passaram: rode o audit-report.mjs (Fase 5), preencha DONE.md e REPORT.md e mude o status do STATE.md para "concluído".';
      return respond({
        decision: 'continue',
        reason: `A task ${goal.plans} está "em execução" (execução automática da my-task, ${continues + 1} de ${maxContinues}). Não encerre nem faça perguntas ao usuário: siga as Fases 3 a 5. ${todo} Se um bloqueio impedir de terminar, explique no REPORT.md e mude o status do STATE.md para "bloqueado".`,
      });
    }
    default: {
      appendEntry(root, { ...base, note: 'evento não tratado' });
      return respond({});
    }
  }
}

try {
  main();
} catch (err) {
  // Se a auditoria falhar, a ação não passa em silêncio: pede confirmação humana.
  if (process.argv[2] === 'PreToolUse') {
    respond({ decision: 'ask', reason: `A auditoria falhou ao registrar esta ação (${err.message}). Confirme manualmente.` });
  } else {
    respond({});
  }
  process.stderr.write(`[my-task auditoria] erro: ${err.stack}\n`);
}
