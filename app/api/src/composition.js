// Composition root da API (Problema 3 da auditoria).
//
// É o ÚNICO módulo que liga `providers/` (Arena) e `infra/` (cache) aos casos
// de uso. Os casos de uso recebem suas dependências por parâmetro (fábricas) e
// não importam infraestrutura diretamente; as rotas consomem as instâncias já
// ligadas daqui. Sem framework de DI: o grafo é explícito e montado uma vez no
// carregamento do processo.
import * as arena from "./providers/arena/index.js";
import * as cacheStore from "./infra/cacheStore.js";
import * as versions from "./application/versions.js";
import * as scoring from "./application/scoring.js";
import * as canonical from "./application/canonical.js";
import * as catalogs from "./application/catalogs.js";
import * as engine from "@radar/engine";
import { createSingleFlight } from "./application/singleFlight.js";
import { createRankLot } from "./application/rankLot.js";
import { createBuildsAggregate } from "./application/buildsAggregate.js";
import { createHeroBuilds } from "./application/heroBuilds.js";

// Lote de heróis por rank/janela (porta fina para a Arena + cache).
export const rankLot = createRankLot({ arena, cacheStore, versions });

// Agregado de builds (B0–B5): fan-out serializado + cache derivado + SWR.
export const buildsAggregate = createBuildsAggregate({
  arena,
  cacheStore,
  singleFlight: createSingleFlight(),
  scoring,
  rankLot,
  versions,
  canonical,
  engine,
});

// Builds de um herói por lane/rank (orquestração + normalização do payload).
export const heroBuilds = createHeroBuilds({ arena, cacheStore, catalogs });
