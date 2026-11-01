# ADR-067 — Remoção das rotas planas `/confrontos`, `/draft-score` e `/preparar`

- Data: 2026-11-01
- Status: aceita e implementada
- Relaciona-se a: ADR-066 (topo enxuto), ADR-055 (menu horizontal), ADR-054
  (draft-score), ADR-052/053 (`/draft`), ADR-047 (`/build`), ADR-044 (`/preparar`).

## Contexto

As três rotas planas já estavam **fora do menu** desde a ADR-066. O usuário decidiu
que elas saem do **app** de vez (rota + tela + testes), não só do README:

1. **`/confrontos`** — página plana do contexto M6 (`features/matchups/`).
2. **`/draft-score`** — página de **teste** do motor `hero-draft-score-v1`.
   Pedido explícito: *"draft score é para manter na engine apenas por hora"*.
3. **`/preparar`** — tela de loadout endereçável (`features/loadout/`).

## Decisão

### 1. `/confrontos` sai do app

- `features/matchups/` (`Matchups.tsx` + `ConfrontosPanel.tsx`) apagada; o lazy
  loader e a `<Route path="/confrontos">` saem de `app/web/src/app/router.tsx`.
- A aba **"Confrontos" da ficha** (`hero-detail/sections/ConfrontosSection.tsx`) é
  um componente **independente** e permanece — o M6 continua na ficha.
- `HeroDossier`: o link "Confrontos" (M6) passou a apontar para a **aba da ficha**
  (`/hero/:id?tab=confrontos`), como já acontecia com "Draft" (DRF). Nada de link morto.

### 2. `/draft-score` sai (web + API); a engine fica

- Web: apagados `features/draft-management/DraftScorePage.tsx`,
  `DraftScoreTable.tsx`, `shared/api/queries/draftScore.ts` (+ a linha do barrel) e
  `app/web/test/ui/draft-score.test.tsx`.
- API: apagados `routes/draftScore.js`, `application/heroDraftScore.js`, o
  despacho em `http/router.js` e os testes de contrato do endpoint.
- `packages/contracts`: os tipos `HeroDraftScoreRow`/`HeroDraftScoreResponse`
  saíram (o endpoint não existe mais; contrato de fio sem consumidor é lixo).
- **Engine intacta:** `packages/engine/src/matchups/draft-score.js`
  (`scoreHeroDraftScore`) continua exportada, tipada e testada. É a **única**
  superfície que permanece — "por hora", conforme o pedido.

### 3. `/preparar` sai; o domínio do loadout fica

- Apagados `features/loadout/Preparar.tsx` e a `<Route path="/preparar">`.
- `shared/domain/loadout.ts` **fica**: é usado por
  `build-manager/useBuildEditor.ts` (`encodeLoadout`, `LOADOUT_VERSION`) e
  `build-manager/useBuildDerivations.ts` (`decodeLoadout`, `signatureOfPick`).
  Removido apenas o `loadoutHref`, que gerava `/preparar?l=` e **não tinha chamador**.
- A mensagem de erro de `decodeLoadout` deixou de citar a tela removida
  (mudou no teste junto).

### 4. Guardiões e limiares ajustados

- `smoke.mjs`: `src/features/matchups/Matchups.tsx` sai da lista de obrigatórios.
- `guardian-draft-management.mjs`: sai o bloco §8 (rota/hook/tabela do Draft Score);
  as checagens de `/draft` permanecem.
- `guardian-f4a.mjs` e `guardian-f4b.mjs`: limiares `>= 7` rotas lazy / `>= 7`
  contextos → `>= 6` (a remoção é intencional; o limiar é sinal de saúde, não meta).

## Alternativas rejeitadas

1. **Manter as rotas e só tirar as linhas do README.** O pedido era apagar do app.
2. **Apagar a engine do draft-score junto.** O usuário pediu explicitamente para
   mantê-la. Rejeitada.
3. **Apagar o domínio `loadout` junto com `/preparar`.** Quebraria o Build Manager
   (`useBuildEditor`/`useBuildDerivations`). Rejeitada.
4. **Redirecionar `/confrontos` para `/hero/:id?tab=confrontos`.** Não há herói no
   escopo da rota plana; o acesso correto é o link do dossiê. Rejeitada.

## Consequências

- O app fica com **7 rotas de produto** (`/dashboard`, `/hero`, `/hero/:id` + aliases,
  `/draft`, `/builds`, `/build`, `/build/:id`).
- `/preparar` era a única rota de produto **fora da navegação** (v.
  `AGENTS/artefatos/spec/experiencias-ooux.md`). Com a saída, o objeto "carga
  endereçável" fica **sem casa**: a evidência exata do loadout segue acessível via
  `?l=` na ficha/build manager, mas não há mais tela dedicada. Registrar se voltar
  a ter uso.
- O **Draft Score do herói** fica só como **primitiva de engine** (sem UI nem API).

## Verificação

`npm run check:boundaries`, `check:api`, `check:web` e `npm test` verdes —
engine 252 · api 133 · web (smoke OK + 143 node + guardiões OK + vitest 34).
