---
trigger: glob
globs: "*.js, *.mjs, *.cjs, *.ts"
description: Padrões de código JavaScript e TypeScript do time (my-task).
---

# Padrões de código JavaScript e TypeScript (my-task)

- {{deps_rule}}
- Módulos ES (`import`/`export`) e `const` por padrão.
- Funções pequenas (até {{max_function_lines}} linhas), com nomes descritivos e uma responsabilidade cada.
- Configuração vem de variáveis de ambiente, nunca escrita no código.
- Nunca coloque segredos, chaves ou tokens no código nem no repositório.
- Nada de código morto nem comentário que repete o código.
