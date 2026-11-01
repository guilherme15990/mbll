# ADR-058 — Lote de heróis completo, paginado pelo `total` (sem tamanho fixo)

**Data:** 2026-10-31 · **Status:** aceito · **Contexto:** o tamanho do lote de heróis estava **fixado em código** (`size=133`) em duas telas; um herói novo (ou um lote que cresça além do teto) ficaria invisível sem ninguém mexer no código.
**Relação:** preserva "zero endpoint novo". Ajusta a fonte `/heroes` em ADR-052 D4 / ADR-053 D8 e a lista de entrada `/hero` (ADR-055).

## Contexto

O lote do recorte (`GET /v1/heroes`) é paginado no servidor:

- `qHeroes` (`app/api/src/application/scoring.js:13`) clampa `size` em `Math.min(133, …)`, default 50 — **133 é teto de request, não tamanho de lote**;
- `paginate` fatia o lote já avaliado e devolve `total = lote inteiro` (+ `truncated`/`totalFonte` da **origem**).

Duas telas pediam "o lote inteiro" num único request com número mágico:

- `/hero` (`HeroList`) usava o default `PAGE_SIZE = 50` → mostrava só 50 (e sem paginação na UI);
- o draft (`useDraftData`) usava `size=133`.

Nos dois casos, um lote maior que o número esconderia heróis silenciosamente.

## Decisão

### D1 · Um hook de lote completo em `shared/api`
`useAllHeroes(rank, window, extra?, enabled?)` (`src/shared/api/queries/heroes.ts`):

1. busca a **página 1** com `size = HEROES_PAGE_CAP` (o teto do servidor);
2. lê `total` e calcula as páginas restantes com `ceil(total / itensDaPágina1)` — **nenhum número de lote**;
3. busca as páginas extras por `index` via `useQueries` (mesma query key do `useHeroes` → cache compartilhado);
4. concatena e devolve `{ data, isLoading, isError, isSuccess, refetch }`.

`HEROES_PAGE_CAP = 133` fica **declarado como teto de request do servidor**, com o motivo escrito ao lado — não como tamanho de lote.

- `truncated` só marca verdade quando a **origem** cortou (`fetched.truncated`) ou quando, com todas as páginas carregadas, ainda faltar linha do `total` — nunca por página em voo.

### D2 · Consumidores usam o lote completo
- `/hero` (`HeroList`) → `useAllHeroes`; a grade segue ordenada por **nome** no cliente (por isso não se usa o pager do servidor, que ordena por θ̂); a contagem (`role="status"`) declara `N de M` e o truncamento da fonte.
- draft (`useDraftData`) → `useAllHeroes` (antes `size=133`).

### D3 · Modal do draft sem teto de lote
`heroOptions` deixa de cortar em `OPTION_LIMIT` (200): devolve **todo** o pool disponível. O modal é uma lista rolável, então não há motivo para esconder o excedente — a contagem continua no cabeçalho.

## Consequências

- Um herói novo aparece sozinho: lote ≤ teto = 1 request (custo atual idêntico); lote > teto = páginas extras **só quando necessário**.
- `BuildsPanel` (top 6), `RankingsTab` (top 5), `Dashboard` (pager real) e `useLaneBuilds` (sample de 25) **permanecem** em `useHeroes` de 1 página — são recortes intencionais, não "lote inteiro".
- Guardião novo `test/guardian-hero-lot.mjs`: exige `useAllHeroes` nos dois consumidores, exige o cálculo por `total`, e proíbe `LOT_SIZE`/`size` fixo em feature e URL `/v1` montada na mão.
- Testes: `test/ui/heroes-lot.test.tsx` (1 página no teto; 2 páginas acima do teto; lote vazio) e `test/ui/hero-list.test.tsx` (lote inteiro + ordem + truncamento + filtro de rota).

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Paginação na UI de `/hero` (pager do servidor) | A grade é ordenada por nome no cliente; o servidor não sorta por nome (`sort=d\|win\|pick\|ban\|q`), então paginar quebraria a ordem. |
| Subir o teto no servidor e pedir tudo num request | Não remove a premissa "1 request contém tudo": um lote maior volta a esconder herói. |
| Ler o tamanho do `/catalog` e usar como `size` | O catálogo pode exceder o lote e o servidor seguiria clampando; continua sem cobrir o excedente. |
| Manter `133`/`LOT_SIZE` no cliente e "lembrar de subir" | É exatamente o acoplamento que esta ADR elimina. |
