import { BookOpen, Check, Plus, Wrench } from "lucide-react";
import { cx, pct } from "../../shared/api";
import type { CompletionSuggestion } from "../../shared/domain/buildManager";
import { evidenceLabel, valueText } from "../../shared/domain/combiner";

type Props = {
  suggestions: readonly CompletionSuggestion[];
  coreIds: ReadonlySet<number>;
  full: boolean;
  error?: string | null;
  onPick: (id: number) => void;
  onOpenCatalog: () => void;
};

/**
 * Candidatos de item. A sugestão nasce de `completionSuggestions` (peso por
 * contraste), mas o jogador também pode abrir o catálogo completo no modal.
 */
export default function CandidateRail({ suggestions, coreIds, full, error, onPick, onOpenCatalog }: Props) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] text-mist">
          {full ? "Build cheia: clique em uma sugestão para escolher o slot que sai." : "Clique para preencher o primeiro slot livre."}
        </span>
        <button
          type="button"
          onClick={onOpenCatalog}
          className="ml-auto inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-line bg-panel2 px-3 text-[11px] font-semibold text-mist hover:border-gold/40 hover:text-foam"
        >
          <BookOpen size={13} /> Ver catálogo de itens
        </button>
      </div>

      {error ? (
        <p className="rounded-xl border border-amber-300/30 bg-amber-300/5 px-2.5 py-1.5 text-[11px] text-amber-100">
          {error}
        </p>
      ) : null}

      {suggestions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-abyss/30 px-2.5 py-2 text-[11px] text-mist">
          Nenhum item com contraste suficiente para sugerir neste recorte. Sem contraste não vira sugestão — e sem dado
          não vira zero. O catálogo abre mesmo assim para você testar.
        </p>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {suggestions.map((item, index) => {
            const core = coreIds.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onPick(item.id)}
                className="flex min-h-[56px] items-center gap-2.5 rounded-xl border border-line bg-abyss/40 px-2.5 py-2 text-left transition-colors hover:border-gold/40"
                aria-label={`${full ? "Trocar slot por" : "Adicionar"} ${item.name ?? `item #${item.id}`}`}
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-line bg-panel2 text-[10px] font-bold text-mist">
                  {index + 1}
                </span>
                {item.icon ? (
                  <img src={item.icon} alt="" className="h-8 w-8 shrink-0 rounded-lg border border-line bg-panel2 object-cover" loading="lazy" />
                ) : (
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-abyss text-[9px] font-bold text-mist">
                    #{item.id}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-semibold text-foam">{item.name ?? `Item #${item.id}`}</span>
                    {core ? (
                      <span className="shrink-0 rounded-full border border-gold/35 bg-gold/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-gold">
                        core
                      </span>
                    ) : null}
                    <span
                      className={cx(
                        "shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] font-bold",
                        item.evidence === "observed"
                          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                          : "border-amber-300/30 bg-amber-300/10 text-amber-200",
                      )}
                    >
                      {evidenceLabel(item.evidence)}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] text-mist">
                    {item.archetypeLabel} · {pct(item.adoption, 0)} das builds ·{" "}
                    {valueText(item.evidence, item.valuePp, item.valuePpEst)} de peso
                  </span>
                </span>
                {full ? <Wrench size={14} className="shrink-0 text-mist" /> : <Plus size={14} className="shrink-0 text-mist" />}
              </button>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-mist/70">
        Sugestões são candidatos com lastro no recorte, não recomendação. A ordem é peso → adoção → builds; o jogador
        decide o que entra. {suggestions.length ? <><Check size={10} className="inline" /> pré-selecionadas acima.</> : null}
      </p>
    </div>
  );
}
