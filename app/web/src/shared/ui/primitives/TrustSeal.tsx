import { CheckCircle2, HelpCircle, TriangleAlert } from "lucide-react";
import { DomainStateBadge, type TrustLevel } from "./DomainStateBadge";

/**
 * Selo de confiança em 3 níveis (leitura de apresentação, sem métrica nova).
 * Robusto / Situacional / Inconclusivo + motivo curto. Percentual único proibido:
 * este componente nunca renderiza `%` sozinho — o motivo é textual (n, banda-c, série).
 */
export function TrustSeal({ level, motive }: { level: TrustLevel; motive: string }) {
  const status = level === "Robusto" ? "robusto" : level === "Situacional" ? "situacional" : "inconclusivo";
  const icon =
    level === "Robusto" ? <CheckCircle2 size={12} aria-hidden="true" /> :
    level === "Situacional" ? <TriangleAlert size={12} aria-hidden="true" /> :
    <HelpCircle size={12} aria-hidden="true" />;
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      <DomainStateBadge status={status} label={level} icon={icon} />
      <span className="text-[11px] text-mist font-mono" title="Motivo do selo de confiança">{motive}</span>
    </span>
  );
}
