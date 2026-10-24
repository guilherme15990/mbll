import { cx } from "../../domain/present";

export function EvidenceQualityBadge({
  quality,
  reasons = [],
}: {
  quality: string | undefined;
  reasons?: string[];
}) {
  const q = (quality || "").toLowerCase();
  // V2 §1/§8.2: "robusto" legado mapeia p/ "Consistente" descritivo — selo de confiança
  // público ("Robusto") exige denominador validado e mora no TrustSeal, nunca aqui.
  const label =
    q === "robusto" || q === "solid" || q === "consistente"
      ? "Consistente"
      : q === "dependente-de-contexto" || q === "rank-dependent"
      ? "Dependente de Contexto"
      : q === "limitado" || q === "thin"
      ? "Limitado"
      : "Inconclusivo";

  const color =
    label === "Consistente"
      ? "text-teal-200 border-teal-400/30 bg-teal-400/10"
      : label === "Dependente de Contexto"
      ? "text-amber-300 border-amber-400/30 bg-amber-400/10"
      : label === "Limitado"
      ? "text-sky-300 border-sky-400/30 bg-sky-400/10"
      : "text-mist border-line bg-abyss/60";

  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      <span className={cx("text-[10px] font-semibold px-2 py-0.5 rounded-full border", color)}>
        {label}
      </span>
      {reasons.slice(0, 2).map((r) => (
        <span key={r} className="text-[9px] px-1.5 py-0.2 rounded border border-line text-mist/80 bg-abyss/40 font-mono">
          #{r}
        </span>
      ))}
    </div>
  );
}
