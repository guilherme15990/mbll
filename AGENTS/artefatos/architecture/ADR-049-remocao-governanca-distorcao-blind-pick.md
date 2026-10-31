# ADR-049 — Remoção da sidebar S4/S5, Governança, Distorção e Blind Pick

- **Status:** aceito
- **Data:** 2026-10-27
- **Decisão do usuário (L3):** remover da sidebar o selo do lote, "Ver herói no
  dossiê", Governança, Distorção e Blind Pick. Essas telas podem ser removidas.
- **Relação:** continua ADR-048 (remoção de Força, Confiança, Ranks e Tempo).

## Contexto

A ADR-048 removeu quatro módulos da ficha e as rotas planas correspondentes.
Restaram na sidebar dois streams de contexto (`Draft & Tactical` e `Governança`),
o rodapé S5 com o selo do lote e a seção S4 que só aparecia com `?hero=`.

O usuário pediu uma navegação menor: sem selo do lote, sem o atalho para o
dossiê, sem Governança e sem as telas Distorção e Blind Pick.

O que **não** foi pedido: remover os dados de distorção e blind. A aba Draft da
ficha (`/hero/:id?tab=draft`) continua exibindo as duas leituras.

## Decisão

### Apresentação (`app/web`)

- `app/Sidebar.tsx` mantém apenas:
  - **Visão geral**: Dashboard, Heróis, Builds, Gerenciar build;
  - **Herói em foco** (S0): `HeroPicker` + `MiniDossier`.
- Removidos:
  - **S4** ("Ver herói no dossiê");
  - **S5** ("Selo do lote" + "Fonte / Exposição");
  - stream **Governança** (Exposição);
  - itens **Distorção** e **Blind Pick** do stream de draft, que passa a
    conter só **Confrontos**.
- `app/router.tsx` perde as rotas `/draft`, `/blind` e `/exposicao`; restam 7
  rotas lazy (`/dashboard`, `/hero`, `/confrontos`, `/builds`, `/build`,
  `/build/:id`, `/preparar`) + ficha (`/hero/:id` e aliases).
- Features apagadas: `features/draft`, `features/blind`, `features/exposure`.
- `shared/ui/patterns/SigmaBanCard.tsx` apagado (só era usado pela sidebar e
  pela página de Exposição).
- `FreshLine` permanece exportado, mas não é mais montado pela sidebar; é
  primitiva de freshness e pode ser reutilizada.

### Reapontamento de links

| Origem | Antes | Depois |
|---|---|---|
| `ConfrontosPanel` | `/draft?hero=…` | `/hero/:id?tab=draft` |
| `BuildManager` (próximo passo) | `/draft?hero=…` | `/hero/:id?tab=draft` |
| `DraftSection` | CTA para `/draft` e `/blind` | nenhum CTA para rota plana |
| `HeroDossier` | M6, DRF, BPS, BDL | M6, DRF (aba da ficha), BDL |

`HeroDossier.activeContextId` foi reduzido a `"M6" | "BDL"`; o item DRF é
renderizado via `contextHref`, que aponta para a aba da ficha.

### Dados (`app/api` + `app/web/src/shared/api`)

Nada de dados foi removido nesta passada:

- `/v1/heroes/:id/distortion` e `/v1/heroes/:id/blind` continuam no dispatcher —
  são a fonte da aba Draft da ficha.
- `/v1/modules` continua com EXP, BPS e DRF. O catálogo descreve **módulos de
  análise**, não telas; removê-los apagaria a documentação das leituras que a
  ficha ainda mostra. EXP continua com `endpoint: "/v1/heroes (pickSumCheck)"`.
- `useBlind` e `useDistortion` continuam em `shared/api/queries/insights.ts`.

### Guardiões e documentação

- `test/smoke.mjs` deixou de exigir `Draft.tsx`, `Blind.tsx`, `Exposure.tsx` e
  `SigmaBanCard.tsx`.
- `guardian-f4a`: mínimo de rotas lazy caiu de 10 para 7.
- `guardian-f4b`: mínimo de features caiu de 9 para 7 e o mesmo para rotas lazy.
- `README.md` lista 7 features.
- `heroPanel.ts` não cita mais `features/blind`.

## Consequências

- Sidebar com uma única stream e quatro entradas de visão geral — a navegação
  passa a refletir apenas o que o produto mantém como tela própria.
- Quem tinha `/draft`, `/blind` ou `/exposicao` salvo cai no fallback de rotas
  (nenhum redirect foi criado: eram telas removidas por decisão de produto).
- A aba Draft da ficha é o único caminho de UI para distorção e blind. Se ela
  sair no futuro, os endpoints e os hooks ficam sem consumidor.

## Verificação

- `npm run check:boundaries` — OK.
- `npm run check:web` (tsc) — OK.
- `npm test -w web` — smoke + guardiões + testes de domínio OK.
- `npm test -w api` — OK (contratos ajustados para 6 módulos).
- `npm run build` — executado após esta ADR; resultado registrado no relatório
  da auditoria (Fase 1/2).

## Condições para revisão

- Se distorção/blind voltarem a ter tela própria, a rota e a feature devem ser
  recriadas em `features/`, não dentro de `shared/ui`.
- Se EXP for removido do produto, `/v1/modules` e `pickSumCheck` podem sair
  junto — hoje EXP é a única justificativa do campo.
