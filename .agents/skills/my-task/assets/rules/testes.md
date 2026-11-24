---
trigger: glob
globs: "test_*.py, *_test.py, *.test.*, *.spec.*"
description: Padrões de testes do time (my-task).
---

# Padrões de testes (my-task)

- Todo requisito do `PLAN.md` da task (`<projeto>/.my-task/<task>/PLAN.md`) tem pelo menos um teste automatizado.
- {{req_rule}}
- Testes unitários não chamam serviços externos nem modelos de IA: são rápidos, repetíveis e sem custo.
- Cubra o caminho feliz e os casos de borda do `PLAN.md`: entrada vazia, entrada inválida, dependência que falha.
- Nunca afrouxe, apague ou pule um teste para ele passar. Nunca faça mock da própria coisa que está sendo testada.
- O comando de testes do projeto é {{test_cmd}}. Ele precisa terminar sem falhas.
- Tipos de teste exigidos: {{test_types}}. {{coverage_rule}}
