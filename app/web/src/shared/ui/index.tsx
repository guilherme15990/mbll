/**
 * Fachada da camada visual compartilhada (ADR-043/F2 da ADR-041).
 *
 * Duas camadas, com regra executável no gate:
 *
 * - `primitives/` — 1 componente por arquivo. Zero fetch, zero contexto, zero
 *   domínio: só `shared/format` (num/percentual/data) e `shared/domain/present`
 *   (`cx`). Se um átomo precisar de hook, ele é pattern.
 * - `patterns/` — composições do produto (HeroPicker, HeroDossier, charts…).
 *   Podem consumir `shared/api`. Importados por caminho, **não** por este
 *   barrel: quem usa `HeroPicker` deve saber que está puxando dados.
 *
 * `IddZone`/`IddTraceBadge` moram em `shared/idd` (dependem do contexto IDD) e
 * são reexportados aqui só para a UI continuar com uma fachada única.
 */

export { Avatar } from "./primitives/Avatar";
export { TierBadge } from "./primitives/TierBadge";
export { ClassSeal } from "./primitives/ClassSeal";
export { CtxSeal } from "./primitives/CtxSeal";
export { CtxBar } from "./primitives/CtxBar";
export { StatusSeal } from "./primitives/StatusSeal";
export { DomainStateBadge, type TrustLevel } from "./primitives/DomainStateBadge";
export { TrustSeal } from "./primitives/TrustSeal";
export { EvidenceQualityBadge } from "./primitives/EvidenceQualityBadge";
export { Delta } from "./primitives/Delta";
export { ThetaBar } from "./primitives/ThetaBar";
export { FreshLine } from "./primitives/FreshLine";
export { Loading } from "./primitives/Loading";
export { Empty } from "./primitives/Empty";
export { ErrBox } from "./primitives/ErrBox";
export { SectionTitle } from "./primitives/SectionTitle";
export { GhostNote } from "./primitives/GhostNote";
export { AnchorNumber } from "./primitives/AnchorNumber";
export { StateStrip, type StateStripTone } from "./primitives/StateStrip";
export { HeroBanner, type HeroBannerTone } from "./primitives/HeroBanner";

export { IddZone } from "../idd/IddZone";
export { IddTraceBadge } from "../idd/IddTraceBadge";
