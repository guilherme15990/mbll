# ADR-028 — IA final da tela Builds: o que fica, o que sai, o que entra

- Data: 2026-10-21 · Autor: saas-lead
- Status: **aceito** (decisão L2, baseada em ADR-026 e ADR-027)

## Contexto

Revisão da tela `/builds` após três correções de premissa, todas verificadas no payload real
(cache da API, 21,7 h, 10 heróis mythic/gold):

1. A fonte entrega **3 builds de 3 itens** por herói+lane+rank — não 6 slots.
2. As 3 builds somam **~10% de pick** (`coverage.pick_sum_per_hero`) → é top-3 curado.
3. Substituição 5/6 é impossível (0 pares em 30 builds); 2/3 existe em 3 pares, 1 herói.

Inventário atual: 3 abas (`Sistema`, `Combinações`, `Por herói`), overview com 7 seções,
explorador com índice "Força" (`hero × build × emblem`).

## Decisão

### Fica como está

| Item | Por quê |
|---|---|
| B0 contexto/cobertura (rank, lane, top, parcial, cache) | correto, inclusive o rótulo "3 a 4 builds por herói na fonte" |
| Seção 1 — trios recorrentes + pacotes (ok/provisórios) | melhor análise global: `k/m/h` entre heróis, com gate de suporte |
| Seção 2 — itens por arquétipo + lista de insuficientes | associação marginal honesta, com `support` visível |
| Seção 4 — runas, talentos, feitiços | `rune_pages` já combina os três |
| `BuildsPanel` (herói): win, pick, lift vs mais-usada/média, tags, itens, emblema, feitiço | já entrega o comparativo correto |

### Sai

| Item | Motivo |
|---|---|
| **Seção 3 "O que muda quando o setup muda"** (variantes) | removida por decisão do usuário (2026-10-21): com 3 builds/3 itens, o bloco virava leitura de duplicata |
| **Seção 3b "As mais usadas em cada herói"** (top builds) | removida por decisão do usuário (2026-10-21): a ficha do herói já é o lugar dessa lista |
| Número **"Força"** (`combination_strength_index`) e ordenação por ele | matematicamente redundante: com herói+emblema fixos, ordenar pelo produto ≡ ordenar por WR da build (demonstração no ADR-027) |
| Aba **"Combinações"** como destino próprio | é o mesmo payload com filtros; duplicava a lista por herói. Página volta a 2 abas: `Sistema` e `Por herói` |
| Selo/grupos **`order_only`** ("Só muda a ordem") | com 3 itens e sem ordem de compra, é duplicata da fonte, não achado. Agrupamento permanece no motor |
| Seção **2b "Combinações de itens"** como bloco separado | fundida em "Itens que aparecem juntos" (trios + pacotes + pares), como sub-bloco |
| Textos com "6 slots", "build completa", "ordem de compra" | não correspondem ao payload |
| Substituição 5/6 em qualquer tela | 0 pares observados |

### Entra

| Item | Onde | Como |
|---|---|---|
| **Winrate por emblema na rota** | Seção 3 (ex-2c) | `win_median` exibido como "Vitória na rota {LANE}", ao lado da aparição e do delta vs normal do herói |

### Adiado (não entrou neste recorte)

- Diff 2 fixos + 1 rotativo no herói.
- Cobertura da amostra (`pick_sum_per_hero`) no B0.
- Consistência por item no herói ("3 de 3 builds listadas").
- Emblema por build com WR do recorte da rota.

### Não entra (agora)

- Itens vs ameaças (curadoria editorial): precisa de dono e taxonomia aprovada.
- Compositor/projeção de builds sintéticas: sem dado observado.
- Builds salvas / comunidade: sem storage.
- Paginação de builds: sonda bloqueada por 429 — se confirmar >3 builds por herói, reabrir substituição observada.

## Efeito no Dashboard

`components/dashboard/BuildsTab.tsx` mantém apenas "3 itens mais associados + força da rota"
e link para `/builds`. Sem trios completos, para não competir com a seção 1.

## Consequências

- A página perde o "número grande" e ganha rastreabilidade (delta + suporte por linha).
- Menos abas e menos scroll; cada seção passa a responder uma pergunta distinta.
- O eixo de comparação deixa de ser inventado (índice) e passa a ser observado (delta vs modal).
- Dívida assumida: sem paginação, o herói mostra 3 builds e mais nada — e a UI diz isso.
