# ADR-039 — Motor de análise permanece público (decisão adiada)

- Data: 2026-10-24
- Status: aceita e **deliberadamente adiada** — nenhuma mudança de código
- Contexto: auditoria externa apontou que `@radar/proprietary-engine` é
  distribuído ao navegador; a pergunta é se isso é um problema de IP.

## Problema

O pacote `@radar/proprietary-engine` é importado por `apps/api` **e** por
`apps/web`. A auditoria levantou que, se a intenção do nome `proprietary` for
proteger a implementação, a arquitetura atual não garante isso: tudo que a web
importa vai para o bundle, e `apps/web/vite.config.ts:43` compila com
`sourcemap: true`, o que reconstrói o código-fonte original no artefato público.

Medido no repositório (não estimado):

- **20 arquivos** da web importam o pacote (50 ocorrências de import).
- Parte é apresentação: `getBuildTags`, `getRankProfileLabel`, `classOf`,
  `getSignalStateBadge`, `interpretProbBand`, `LANES`, constantes de PRD.
- Parte é **algoritmo de fato**: `scoreRouteItemsets`, `trendOfDated` /
  `trendOf` (Theil–Sen), `trustOf`, `selectTopBuildsByLift`,
  `orderBuildsByLift`, `heroRankPosition`, `sortHeroesByMetric`,
  `selectLevelPopularityCandidates`, `classifyBlindPick` /
  `classifyFirstPick`, `dominantProfileOf`, `resolveTemporalSignal`.
- Ou seja: não é um caso de "só rótulos" — a web executa cálculo de scoring,
  tendência e ordenação no cliente.

## Decisão

**Por ora, nada muda.** O motor continua público, o `sourcemap: true` continua
ligado e a web continua calculando no cliente.

Consequência explícita e aceita: `proprietary` descreve hoje **propriedade do
código**, não **confidencialidade do algoritmo**. Qualquer pessoa com acesso ao
bundle publicado pode ler os modelos. Isso é uma decisão de produto, não um
defeito a ser corrigido por engenharia.

## Alternativas avaliadas (não executadas agora)

1. **Split seletivo (recomendada quando a decisão voltar).** Mover só o núcleo
   de cálculo (`scoreRouteItemsets`, `trendOf*`, `trustOf`, `select*`,
   `heroRankPosition`) para a API e manter na web apenas rótulos, constantes de
   PRD e formatação. Resolve o vazamento real sem reescrever as 20 telas, porque
   a web já recebe `wrAdj`, `z`, `q`, `B`, `tier` e `strength_index` prontos do
   fio — o cálculo client-side é, na maioria dos casos, reordenação do que já
   veio.
2. **Privado total.** Todo o pacote vira server-only. Mais correto para IP, mas
   muda o contrato de várias rotas e ~20 componentes.
3. **Apenas desligar sourcemap.** Reduz o atalho de leitura, não torna o código
   secreto: o que o navegador executa continua lá. Sozinho, é segurança de
   fachada — por isso não foi feito isoladamente.

## Gatilhos para reabrir esta ADR

Reabrir a discussão (e executar a alternativa 1) se qualquer um ocorrer:

1. O motor passar a ser ativo comercial (licenciamento, consultoria, assinatura).
2. Aparecer cópia concorrente do índice/algoritmo — nesse ponto já será tarde.
3. O cálculo client-side começar a divergir do server-side (aí o split deixa de
   ser sobre IP e vira sobre consistência, que é um motivo mais forte).

## Observação de fronteira (registrada, não corrigida)

`apps/web/vite.config.ts:5` importa `../api/src/routes.js` para montar `/v1/*`
no dev server (porta única, por design — o comentário no arquivo explica). Isso
**escapa da app** e mesmo assim `npm run check:boundaries` passa, porque o gate
varre `apps/api/{src,test}`, `apps/web/src` e `packages` — não os arquivos de
configuração da raiz de cada app. A regra "apps: nenhum import relativo escapa
da app" é verdadeira apenas dentro de `src/`.

Não é defeito (o acoplamento é intencional e só existe em dev/build tooling),
mas o gate promete mais do que entrega. Se o acoplamento crescer, estender o
walk do `tools/check-boundaries.mjs` aos `*.config.ts` é a correção barata.

## Consequências

Positivas: nenhum risco introduzido; a decisão fica registrada com evidência, em
vez de virar folclore ("o motor é privado") que o bundle desmente; os gatilhos
de revisão estão escritos antes do problema aparecer.

Custos: o vazamento de IP permanece aberto por decisão consciente; a dívida fica
nomeada, não escondida.
