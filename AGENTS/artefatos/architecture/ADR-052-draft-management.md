# ADR-052 — Draft Management: índice de composição com suporte declarado

**Data:** 2026-10-28 · **Status:** aceito · **Contexto:** pedido de tela de draft assistant com poder dos times e seletor de primeiro pick.

## Contexto

O artefato `spec/experiencias-ooux.md` (§2.4/§6) registrou duas decisões anteriores:
1. “Não criar score de composição” porque a API não mede sinergia de time e o código proíbe somar δ entre cinco inimigos;
2. `/preparar?team=` seria a casa da composição.

O produto agora pede explicitamente uma tela de draft com cálculo de poder dos times e seletor de quem picka primeiro. A decisão anterior continua correta no ponto que importa — **não inventar win rate de composição** —, mas não impede um índice relativo com componentes separados e suporte declarado. Esta ADR redefine o escopo e substitui o item 1 apenas na parte que proibia qualquer número de composição.

## Decisão

### D1 · Rota própria `/draft` (não `/preparar?team=`)
O objeto é o **draft dos dois lados** (10 picks + 6 bans + ordem), não a lista de 5 heróis do time. `/preparar` continua sendo carga individual. A tela entra no stream “Inteligência de Draft” da sidebar com selo `DMP`.

### D2 · Índice de poder relativo, não score nem probabilidade
`índice = 50 + 50·tanh(Λ/K)`, `K = 0,05`, com `Λ` = média ponderada de três componentes em logit:

| Componente | Peso | Suporte |
|---|---|---|
| Força média (θ̂ − μ, peso `B`) | 1,0 | heróis com θ̂ |
| Sinergia (média de δ dos pares internos) | 0,5 | pares observados / C(n,2) |
| Confronto (média de ±|δ| contra o outro lado) | 0,5 | pares observados / n·m |

- Componente sem suporte é `null` e sai do denominador — **nunca 0**.
- `K`, os pesos e os cortes do veredito (3 / 8 / 15) são **escala de exibição**, não calibração. Ficam aqui e no código, versionáveis.
- A banda de incerteza usa apenas o IC 95% da força (`seᵢ = largura/3,92`, `seTime = √Σseᵢ²/n`).

**Por que a média por par e não a soma:** somar δ de 25 pares produz um número que cresce com o tamanho do time e não corresponde a uma partida; a média responde “por confronto, quem está melhor” e mantém a unidade (logit).

### D3 · Direção do par vem da lista, não do sinal do δ
`countersDown` = contra nós; `countersUp` = a favor; `synergiesUp/Down` = +/−. O valor absoluto do δ é severidade. Motivo: a semântica de `increase_win_rate` está declarada “em validação” na própria rota (`app/api/src/routes/matchups.js:49`). Se a fonte mudar a semântica, a tela não inverte sozinha.

### D4 · Zero endpoint novo
Reuso de `/heroes` (size 133), `/catalog`, `/heroes/lanes`, `/heroes/:id/matchups`. O fan-out de matchups é limitado a 10 heróis escolhidos e usa `useQueries` sobre a **mesma query key** do hook oficial (`matchupsQuery` de `shared/api/queries/matchups.ts`), então cache e invalidação são compartilhados.

### D5 · URL como store
`?first=us|them&d=hero@lane,...|...&b=id,id,id|...` + filtros globais. F5 e link preservam o draft. Herói/lane inválidos são descartados na leitura (link velho não quebra a tela).

### D6 · Assistente é leitura ordenada, não recomendação
Candidatos e alvos de ban exibem motivo, componentes e suporte. Ordenação: encaixe de rota → soma dos componentes observados → θ̂. Copy obrigatória: “não são recomendação”, “não é probabilidade”.

### D7 · Ordens de draft (MLBB)
Bans `F,S,F,S,F,S`; picks `1-2-2-2-2-1` (primeiro lado: 1,4,5,8,9; segundo: 2,3,6,7,10). A ordem é uma **regra do jogo**, não um dado estatístico; se o formato mudar, muda só a constante.

### D8 · Modelo puro vive na feature, não em `shared/domain`
`features/draft-management/model/` (`common`, `state`, `pairs`, `power`, `firstPick`, `suggestions`, `analyze` + barrel) em vez de `shared/domain/draftManagement.ts`.

Motivos:
- **Só esta tela consome o objeto.** O precedente é `features/builds/aggregate/model.ts` (E3 da auditoria): derivação pura de um domínio que não é transversal vai para a feature.
- **Regra de 300 linhas por arquivo** (`tools/check-boundaries.mjs`). O arquivo único nasceu com 892 linhas; split em `shared/domain` exigiria imports entre arquivos de domínio, que o checker proíbe (`shared/domain` só importa `@radar/proprietary-engine` e `shared/format`).
- Pureza preservada por construção: os módulos importam só irmãos, sem React/rede. O guardião `test/guardian-draft-management.mjs` verifica isso estaticamente.

Imports internos usam extensão `.ts` para `node --test` resolver ESM sem transpilação (`allowImportingTsExtensions: true` já estava no tsconfig).

## Consequências

- A tela responde J5 (composição) e J6 (risco de draft) sem violar a proibição de win rate de composição.
- `experiencias-ooux.md` §2.4/§6 fica superado apenas no ponto “nenhum número de composição”; a proibição de **win rate/probabilidade de composição** permanece.
- Novas fórmulas propostas (θ̂ ajustado por exposição, flex por entropia, timing de time, valor de ban com cobertura) ficam em `research/draft-statistics.md`; nenhuma entra na v1 sem dado/suporte.
- O índice depende de pares observados. Em recortes com matriz esparsa, a tela mostra `parcial` — comportamento esperado, não bug.

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Score único de composição calibrado em win rate | Sem dado de draft real; seria invenção. |
| Reusar `/preparar?team=` | Esconderia o objeto draft e a ordem de picks. |
| Buscar matchups dos 133 heróis na tela | 133 requests; estoura rate limit e tempo. |
| Somar δ dos 5 inimigos | Sem significado de partida; proibido pelo produto. |
| Usar só θ̂ médio como “poder” | Ignora sinergia/confronto e superestima time de picos. |
