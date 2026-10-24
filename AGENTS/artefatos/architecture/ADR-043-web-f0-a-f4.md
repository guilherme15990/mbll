# ADR-043 — Web: F0–F4 da estrutura alvo (providers, router, shared/{api,domain,ui,idd})

- Data: 2026-10-24
- Status: aceita e implementada (F0, F1, F2, F3, F4)
- Base: ADR-041 (estrutura alvo), ADR-040 (camada de dados), ADR-042 (raiz `app/`)
- Escopo: `app/web/src` + 4 guardiões + `tools/check-boundaries.mjs`. Zero
  mudança de comportamento de produto.

## Contexto

A ADR-041 ficou como **proposta**. A auditoria externa (template com
`shared/{hooks,utils,types,constants}`, `packages/shared-contracts`, três
arquivos de router) foi avaliada e rejeitada em 8 de 12 itens. Este documento
registra o que foi **adotado** dela, o que foi adotado da ADR-041 e onde a
execução divergiu do texto original — com motivo.

## F0 — adotado do template (3 arquivos, sem mover pasta)

| Arquivo | Por quê |
|---|---|
| `app/providers/QueryProvider.tsx` | O `QueryClient` vivia inline no `main.tsx`. Agora o `main.tsx` é só o mount e a política de retry tem um dono |
| `app/router.tsx` | As 12 rotas lazy saíram do `App.tsx` (224 → ~120 linhas de shell). **1** arquivo, não `router/{index,routes,lazy-routes}` |
| `lib/errors.ts` (hoje `shared/api/errors.ts`) | Taxonomia real: `ApiError` (status + `isClientError`), `NetworkError` (fetch rejeitou) e `shouldRetry` — 4xx não repete, o resto tenta 2× |

Rejeitado do template: `apps/` (reverte ADR-042), `shared/{hooks,utils,types,
constants}` (organização por tipo técnico — não gera regra verificável),
`packages/shared-contracts` (duplica o `index.d.ts` protegido por 2 regras),
`public/` (sem asset), `app/config/env.ts` (não existe `import.meta.env` no
código), `layouts/DashboardLayout.tsx` (segundo layout inventado) e
`pnpm-workspace.yaml` (o repo é npm + lockfile).

## F1 — `lib/` dissolveu em `shared/{api,domain}`

| Antes | Depois |
|---|---|
| `lib/http.ts`, `lib/errors.ts` | `shared/api/{http,errors}.ts` |
| `lib/api/{filters,heroes,builds,matchups,insights}.ts` | `shared/api/queries/*.ts` |
| `lib/api.ts` (barrel) | `shared/api/index.ts` |
| `lib/{combiner,itemsets,buildLabel,present}.ts` | `shared/domain/*.ts` |

`lib/` deixou de existir e o gate proíbe recriá-la (`web: sem src/lib`). A
fronteira fica: **`shared/api` consome rede; `shared/domain` é lógica pura.**

O barrel continua sendo o único import de dados (`~40` call sites não mudaram de
specifier além do prefixo), o que preserva a decisão da ADR-040 de não explodir
hooks para dentro das features (violaria as regras 5/6).

**Desvio 1 — `shared/domain` pode importar `type` de `shared/api`.**
A regra 12 da ADR-041 dizia "só motor + `shared/format`". `combiner.ts` precisa
de `AggregateCombiner*`/`AggregateTopBuild`, que são o **contrato da API**.
Mover esses tipos para `domain` seria duplicar o contrato — exatamente o que a
ADR-038 já rejeitou. A regra executável passa a ser: **nenhum import de runtime
fora de motor + `shared/format`**; `import type` é apagado no build e não cria
ciclo real. `buildLabel.ts` reexportava `type { Build }` de `./api` sem nenhum
consumidor — removido, não virou exceção.

**Desvio 2 — `ui/primitives` pode importar `shared/format` e
`shared/domain/present`.** A regra 11 original proibia `domain` inteiro.
`num`, `ago`, `dir`, `dirWord` e `cx` são puros (zero React, zero fetch);
proibi-los forçaria copiar formatação para dentro de cada átomo. A regra
executável é: **primitives não importam `shared/api`, `shared/idd`,
`shared/ui/patterns` nem `features`.** Provado com probe negativo (ver
Evidência).

## F2 — `shared/ui.tsx` (493 linhas) → 20 primitivas + 6 patterns

`primitives/` com 1 componente por arquivo e o nome do arquivo (regra 14
executável): `Avatar`, `TierBadge`, `ClassSeal`, `CtxSeal`, `CtxBar`,
`StatusSeal`, `DomainStateBadge`, `TrustSeal`, `EvidenceQualityBadge`, `Delta`,
`ThetaBar`, `FreshLine`, `Loading`, `Empty`, `ErrBox`, `SectionTitle`,
`GhostNote`, `AnchorNumber`, `StateStrip`, `HeroBanner`.

`patterns/`: `HeroPicker`, `HeroDossier`, `PickVerdict`, `BuildLoadout`,
`heroPanel.ts`, `charts.tsx`.

`shared/ui/index.tsx` é a **fachada** (reexporta as primitivas) para os ~25
imports `from "../shared/ui"` continuarem valendo. Patterns **não** entram no
barrel: quem importa `HeroPicker` deve ver que está puxando dados/fetch.

## F3 — features em EN/kebab

`hero` → `hero-detail`, `heroes` → `hero-list`, `forca` → `strength`,
`confianca` → `confidence`, `tempo` → `temporal`, `confrontos` → `matchups`,
`exposicao` → `exposure`. A entrada de cada contexto acompanha o nome da pasta
(`Herois.tsx` → `HeroList.tsx`, `HeroDetails.tsx` → `HeroDetail.tsx`, etc.).

Fim do par `hero/` × `heroes/` — um erro de uma letra que custava caro em
qualquer import novo. Os arquivos internos de cada feature (`ForcaPanel.tsx`,
`ConfiancaPanel.tsx`, `ConfrontosPanel.tsx`, `TempoPanel.tsx`,
`*Section.tsx`) continuam em PT: são privados do contexto e renomeá-los é
churn sem ganho de fronteira. Fica registrado como follow-up cosmético.

## F4 — `app/IddModal.tsx` → `shared/idd/`

```
shared/idd/
├── index.tsx           ex-shared/idd.tsx (contexto + tabelas)
├── IddModal.tsx        ex-app/IddModal.tsx (463)
├── IddZone.tsx         ex-shared/ui.tsx
├── IddTraceBadge.tsx   ex-shared/ui.tsx
└── cards/              ex-shared/idd/{NeedsRankLane,PrimaryAction,SigmaBanCard}
```

**Desvio 3 — `idd.tsx` virou `index.tsx`.** Mantém `from "./shared/idd"`
resolvendo sem tocar nos consumidores e é a convenção do resto do repo
(`shared/api/index.ts`, `shared/ui/index.tsx`).

**Desvio 4 — `IddZone`/`IddTraceBadge` foram para `shared/idd`, não para
`primitives/`.** Os dois usam `useIdd()`: são contexto, não átomo (regra 11).
`shared/ui/index.tsx` os reexporta para a UI não precisar de dois imports; as
cards do idd importam direto de `../IddZone`.

## Gates alterados

| Gate | Mudança |
|---|---|
| `check-boundaries.mjs` | zona `lib` removida; nova regra `shared/domain puro`; novas regras `ui/primitives` (dependências + 1 componente/arquivo); nova regra `sem src/lib` |
| `check-boundaries.mjs` (F0) | `app/router.tsx` passa a ser loader legítimo de features (`App.tsx` + `app/router.tsx`) |
| `guardian-f4a.mjs` | passa a ler `src/app/router.tsx` e `src/shared/api/index.ts` (barrel reexporta `../format`) |
| `guardian-f4b.mjs` | zona `lib` removida; loader `app/router.tsx` com prefixo `../features/`; `heroPanel.ts` agora em `shared/ui/patterns/` |
| `guardian-builds-global.mjs` / `guardian-hero-confrontos.mjs` | leem `src/shared/api/queries/*` e o novo barril |
| `smoke.mjs` | lista de arquivos obrigatórios atualizada (12 features, idd, ui) |

Cada regra nova foi validada com **probe negativo** (violação plantada):

```
shared/ui/primitives/Avatar.tsx → shared/api/index.ts   → FAIL (regra primitives)
shared/domain/present.ts → shared/api/index.ts          → FAIL (regra domain puro)
```

## Evidência

- `npm run verify` → **exit 0** (boundaries + typecheck api/web + motor + API 124
  + web: smoke, 2 testes e 4 guardiões)
- `npm run build` → **exit 0**, `api-ok`, 36 chunks em `app/web/dist`
  (31 antes: a fachada `shared/ui` virou ponto de encontro de 20 módulos, o que
  cria mais chunks compartilhados — custo aceito, sem mudança de payload
  funcional)
- Maior arquivo da web hoje: `features/builds/BuildsAggregatePanel.tsx` (806).
  `shared/ui.tsx` (493) e `app/IddModal.tsx` (463) deixaram de existir como
  monólitos.

## O que **não** foi feito

- **F5** (`data/` → `var/`, ADRs para `docs/adr/`): mexe em caminho de runtime e
  em documentação; merece commit próprio.
- **F6/F7** (API `modules/` + `platform/`, injeção no composition root): blast
  radius maior; F7 segue opcional pela própria ADR-041.
- Renomear os painéis internos das features para EN (ver F3).
- Decompor os 3 painéis de builds (806/581/531 linhas) — o próximo monólito real
  da web não é mais o `ui.tsx`.

## Consequências

`lib` × `shared` deixou de ser uma escolha: `shared/api` é o que fala rede,
`shared/domain` é o que não fala, `shared/ui/primitives` não conhece dado e
`shared/ui/patterns` conhece. As quatro regras são verificáveis e falham com
probe plantado — o que a organização por "tipo técnico" (`utils/`, `hooks/`)
nunca conseguiria.
