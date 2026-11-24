# Plano — <título curto>

<!-- O status da task fica em STATE.md; o pedido literal, em REQUEST.md; os critérios de pronto, em DONE.md. -->

## Objetivo

<uma frase>

## Fora do escopo

- <o que não será feito>

## Requisitos

- **REQ-01**: <descrição verificável>
- **REQ-02**: <descrição verificável>

## Estrutura de arquivos

```text
<pasta>/
├── <arquivo>        # <o que é, com os nomes públicos: módulos, funções, classes>
└── <testes>/        # <onde ficam os testes>
```

## Casos de teste

| Teste | Cobre | Tipo | O que confere | Resultado esperado |
|---|---|---|---|---|
| REQ-01: <nome> | REQ-01 | unitário | <o que> | <resultado> |

## Divisão para os subagentes

| Agente | Tarefa | Arquivos |
|---|---|---|
| my-task-test-writer | Escrever os testes da tabela acima | `<pasta de testes>/` |
| my-task-implementer | Implementar o código | `<pastas e arquivos de código>` |

## Diretrizes aplicadas

- Arquitetura: <estilo da rule my-task-padroes e como ele se aplica aqui>
- Tipos de teste: <unitário, integração, e2e — quais casos de teste cobrem cada tipo>
- Cobertura mínima: <n% e comando, ou "nenhuma">
- Convenções: <as que afetam esta task>

## Critérios de pronto

Em `DONE.md`.
