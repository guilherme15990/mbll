/**
 * Superfície pública da camada de dados da web.
 *
 * Fronteira única de `shared/api`: `http.ts` (transporte + taxonomia de erro),
 * `queries/` (17 hooks + tipos, 1 domínio por arquivo) e os reexports de
 * formatação/higiene que a UI consome junto dos hooks.
 *
 * O arquivo era um monólito de ~520 linhas com 18 hooks e 40 tipos de 12
 * domínios. Agora é só o barrel — a superfície exportada é idêntica e os ~40
 * call sites importam daqui.
 *
 * Por que os hooks não foram para pastas `api/` dentro de cada feature (como a
 * auditoria sugeriu): `shared/ui/patterns/HeroPicker` e `shared/ui/patterns/HeroDossier`
 * consomem `useHero`, `useHeroes`, `useCatalog` e `useMeta`, e as seções de
 * `features/builds` consomem `useBuilds` de builds. Mover os hooks para
 * dentro das features violaria duas regras do `tools/check-boundaries.mjs`
 * ("app|shared não importam features" e "features não importam outras
 * features"). A camada de dados é transversal ao produto; o firewall continua
 * valendo. Ver ADR-040 e ADR-043.
 */

export { ago, num, pct } from "../format";

export * from "./http";
export * from "../domain/present";

export * from "./queries/filters";
export * from "./queries/heroes";
export * from "./queries/builds";
export * from "./queries/matchups";
export * from "./queries/insights";
