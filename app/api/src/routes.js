// Shim de compatibilidade da F1.
//
// O monolito de 1066 linhas foi fatiado em:
//   http/        dispatcher e servidor (sem regra de negócio)
//   routes/      handlers verticais por contexto (fio HTTP)
//   application/ coleta, pontuação, catálogos e agregados (sem HTTP)
//
// Este arquivo NÃO tem lógica: só reexporta a superfície que já era pública
// (app/web/vite.config.ts, app/api/src/index.js e os testes importam daqui).
// Remover o shim só depois de atualizar esses três consumidores.
export { router } from "./http/router.js";
export { score, scoreLot, paginate } from "./application/scoring.js";
export { aggCacheKey } from "./application/buildsAggregate.js";
export { lastVerifiedPosterior, ROAD_SORT_TO_LANE, lanesFromRoadsort } from "./application/rankLot.js";
