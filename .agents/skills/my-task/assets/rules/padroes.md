---
trigger: always_on
description: Diretrizes do time definidas no /my-task init (arquitetura, testes, cobertura e convenções).
---

# Diretrizes do time (my-task)

Definidas por uma pessoa no `/my-task init` e gravadas no `.ai/my-task.json`. Valem para todo plano e são conferidas pelo verificador. As rules do projeto (`.agents/rules/projeto-*`) detalham como cada repositório aplica estas diretrizes; se as duas divergirem, siga a rule do projeto e registre a divergência no relatório.

## Arquitetura

- {{architecture_rule}}
{{architecture_notes}}

## Testes

- Tipos de teste exigidos em todo plano: {{test_types}}.
- {{coverage_rule}}

## Convenções do time

{{conventions}}
