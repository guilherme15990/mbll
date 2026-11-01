# ADR-059 — Pacote do motor renomeado: `@radar/proprietary-engine` → `@radar/engine`

- Data: 2026-10-31 · Autor: saas-lead
- Status: **aceito e executado**
- Relação: **supersede a ADR-025** (que fixou a fronteira em `@radar/proprietary-engine`).
  **Paga a ADR-041 §"o que eu não faria" item 6** (rename registrado e não pago).
  Compatível com a ADR-039 (motor público por hora) — o nome finalmente corresponde
  ao que o pacote é.

## Contexto

A ADR-025 unificou a fronteira do motor em `@radar/proprietary-engine` e **removeu**
`packages/engine/` (as primitivas genéricas). O nome `proprietary` nunca
descreveu o pacote: ele **é** o motor público, versionado por hora (ADR-039), e a
web o declara como dependência normal (`@radar/engine` já era lido no `tsc` por
apelido em vários pontos). A ADR-041 registrou o rename como desejável, mas o
classificou como "registrado, não pago" por tocar 64 imports e o gate.

O que a ADR-025 removeu **continua removido**: não existe "pacote de primitivas"
separado. Este rename **não** ressuscita a duplicata de fronteira — só dá ao
pacote proprietário o nome que ele sempre teve.

## Decisão

- `"name": "@radar/proprietary-engine"` → `"name": "@radar/engine"`.
- Pasta: `packages/proprietary-engine/` → `packages/engine/`.
- Barrel preservado por inteiro: **nenhum importador mudou de nome, só de `from`**
  (mesma garantia da ADR-025). `packages/engine/src/index.js` + `index.d.ts`
  mantêm a superfície pública.
- Dependências em `app/api/package.json` e `app/web/package.json`:
  `@radar/proprietary-engine` → `@radar/engine`; workspace relinkado em
  `node_modules/@radar/engine`.

## Rewire executado

| Ponto | Antes | Depois |
|---|---|---|
| Pacote | `@radar/proprietary-engine` | `@radar/engine` |
| Pasta | `packages/proprietary-engine/` | `packages/engine/` |
| Teste do pacote | `test/proprietary.test.js` | `test/engine.test.js` |
| `build` echo | `proprietary-ok` | `engine-ok` |
| Gate (F2) | exigia `packages/proprietary-engine/src/index.d.ts` | exige `packages/engine/src/index.d.ts` |
| Guardiões | `guardian-builds-global.mjs:80`, `smoke.mjs`, `itemsets.test.mjs` | caminho `packages/engine` |

36 arquivos trocaram o `from`. Scripts da raiz (`build`, `test`) seguem chamando o
workspace por `-w engine`.

## Gate

- **Removida** a regra que proibia importar de `@radar/engine` (era o que a ADR-025
  tinha imposto ao banir o nome antigo e adotar `proprietary-engine`).
- **Mantidas** as duas regras que importam de fato:
  1. todo nome importado de `@radar/engine` tem declaração em `index.d.ts`;
  2. ninguém importa o interior do pacote (`/^@radar\/engine\//`) — o motor
     entra pela raiz.

## Consequências

- O nome do pacote, do import e da pasta agora é único: `engine`. A ambiguidade
  "duas fronteiras para um dono só" que motivou a ADR-025 não volta — volta só o
  **nome**, não a duplicata.
- Qualquer referência remanescente a `proprietary-engine` fica restrita ao
  **histórico** (ADRs anteriores a esta); código, scripts, gate e guardiões usam
  `engine`.
- A ADR-025 fica superada **no ponto do nome** (`@radar/engine` removido); o
  restante da ADR-025 (primitivas sob um dono só) continua válido.
