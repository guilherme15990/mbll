# ADR-068 — Documentação da config da API no `config.js` (sem `.env.example`)

- Data: 2026-11-01
- Status: aceita e implementada
- Relaciona-se a: ADR-034 (config fail-fast), ADR-032 (versionar só o essencial).

## Contexto

A configuração da API já vive em `app/api/src/infra/config.js` (defaults + validação
fail-fast). Havia um segundo lugar documentando as **mesmas** variáveis: o
`.env.example` — duas fontes para a mesma verdade, que podiam divergir.

Detalhe que confundia: **não existe loader de `.env`**. Os scripts são
`node src/index.js` (sem `--env-file`), e `.env`/`.env.*` são gitignored. Ou seja,
um `.env` criado à mão seria ignorado; o `.env.example` era só um espelho-comentário
do que o `config.js` já declara.

## Decisão

- **Fonte única:** o bloco de comentário no topo de `app/api/src/infra/config.js`
  passa a documentar **cada variável** (default + efeito). É o lugar onde o default
  realmente está — impossível divergir do código.
- **`.env.example` removido.** O `.gitignore` perde a exceção `!.env.example`;
  `.env` e `.env.*` seguem ignorados (segredos locais).
- **README** aponta para o `config.js` em vez do `.env.example`.
- Nenhum código, teste ou gate lia o `.env.example` (verificado antes de remover).

## Alternativas rejeitadas

1. **Manter os dois** (`config.js` + `.env.example`): duplicação que diverge com o
   tempo e some ao mudar um default.
2. **Criar um `.env` real + `--env-file`:** desnecessário — não há segredo, e a
   operação (porta, caminho de dados, host) já é naturalmente por ambiente.

## Consequências

- Quem procura "quais variáveis existem" abre **um** arquivo: `config.js`, junto do
  default e da validação.
- A afirmação da **ADR-032** (".env.example é o único arquivo de configuração
  versionado") fica **superada** neste ponto.

## Verificação

`npm run check:api` e `npm test -w api` verdes (nenhum teste lia o `.env.example`).
