// Dispatcher HTTP da API interna (/v1/*). Sem framework, sem estado próprio:
// só mapeia path -> handler de rota. A ordem preserva a do routes.js original.
import { heroesRoute } from "../routes/heroes.js";
import {
  heroRoute, distortionRoute, trendsRoute,
} from "../routes/heroDetails.js";
import { viewsRoute } from "../routes/views.js";
import { gemsRoute } from "../routes/gems.js";
import { heroCatalogRoute, equipmentRoute, heroLanesRoute } from "../routes/catalog.js";
import { matchupsRoute, blindRoute } from "../routes/matchups.js";
import { heroDraftScoreRoute } from "../routes/draftScore.js";
import { aggregateRoute, heroBuildsRoute } from "../routes/builds.js";
import { modulesRoute, statusRoute } from "../routes/meta.js";

const HERO = /^\/heroes\/(\d+)$/;
const MATCHUPS = /^\/heroes\/(\d+)\/matchups$/;
const BUILDS = /^\/heroes\/(\d+)\/builds$/;
const DISTORTION = /^\/heroes\/(\d+)\/distortion$/;
const BLIND = /^\/heroes\/(\d+)\/blind$/;
const TRENDS = /^\/heroes\/(\d+)\/trends$/;

export async function router(path, sp) {
  let m;
  if (path === "/heroes") return heroesRoute(sp);
  if ((m = HERO.exec(path))) return heroRoute(sp, Number(m[1]));
  if (path.startsWith("/views/")) return viewsRoute(path, sp);
  if (path === "/gems") return gemsRoute(sp);
  if (path === "/catalog") return heroCatalogRoute();
  if (path === "/equipment") return equipmentRoute();
  if (path === "/heroes/lanes") return heroLanesRoute(sp);
  if (path === "/heroes/draft-score") return heroDraftScoreRoute(sp);
  if ((m = MATCHUPS.exec(path))) return matchupsRoute(sp, Number(m[1]));
  if (path === "/builds/aggregate") return aggregateRoute(sp);
  if ((m = BUILDS.exec(path))) return heroBuildsRoute(sp, Number(m[1]));
  if ((m = DISTORTION.exec(path))) return distortionRoute(sp, Number(m[1]));
  if ((m = BLIND.exec(path))) return blindRoute(sp, Number(m[1]));
  if ((m = TRENDS.exec(path))) return trendsRoute(sp, Number(m[1]));
  if (path === "/modules") return modulesRoute();
  if (path === "/meta/status") return statusRoute();
  return { status: 404, body: { error: "not_found", message: "Not found" } };
}
