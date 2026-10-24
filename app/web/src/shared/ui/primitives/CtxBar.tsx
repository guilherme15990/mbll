import { Info } from "lucide-react";
import { cx } from "../../domain/present";

const CONTEXT_STREAM_MAP: Record<string, { stream: string; color: string }> = {
  SHR: { stream: "Inferência & Força", color: "text-gold border-gold/40 bg-gold/10" },
  CNF: { stream: "Inferência & Incerteza", color: "text-cyan-300 border-cyan-400/40 bg-cyan-400/10" },
  RNK: { stream: "Inferência & Ranks", color: "text-indigo-300 border-indigo-400/40 bg-indigo-400/10" },
  TMP: { stream: "Inferência & Tempo", color: "text-purple-300 border-purple-400/40 bg-purple-400/10" },
  M6: { stream: "Draft & Sinergias", color: "text-emerald-300 border-emerald-400/40 bg-emerald-400/10" },
  DRF: { stream: "Draft & Pressão", color: "text-amber-300 border-amber-400/40 bg-amber-400/10" },
  BPS: { stream: "Draft & Blind Pick", color: "text-rose-300 border-rose-400/40 bg-rose-400/10" },
  BDL: { stream: "Draft & Builds", color: "text-orange-300 border-orange-400/40 bg-orange-400/10" },
  EXP: { stream: "Governança de Dados", color: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10" },
};

/** Faixa de identidade do Bounded Context (DDD) alinhado rigorosamente aos PRDs. */
export function CtxBar({
  id,
  name,
  question,
  status,
  formula,
  prdRef,
}: {
  id: string;
  name: string;
  question: string;
  status: string;
  formula?: string;
  prdRef?: string;
}) {
  const streamInfo = CONTEXT_STREAM_MAP[id] ?? { stream: "Domínio", color: "text-mist border-line bg-panel2" };

  return (
    <div className="card p-3 bg-panel2/50 border-line flex items-center justify-between gap-3 flex-wrap text-xs">
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className={cx("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border", streamInfo.color)}>
          {streamInfo.stream}
        </span>
        <span className="font-mono font-bold text-gold">CTX-{id}</span>
        <span className="font-semibold text-foam">{name}</span>
        <span className="text-mist hidden md:inline">—</span>
        <span className="text-mist font-normal hidden md:inline italic">{question}</span>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {prdRef && (
          <span className="text-[11px] text-mist/70 hidden lg:inline" title="Base PRD">{prdRef}</span>
        )}
        <span className="px-2 py-0.5 rounded-full text-[11px] font-mono border border-line bg-abyss/60 text-foam">
          Status: <b className="text-gold">{status}</b>
        </span>
        {formula && (
          <span
            className="cursor-help p-1 rounded-md text-mist hover:text-gold hover:bg-abyss/60 transition-colors"
            title={`Formulação Matemática / Hipótese:\n${formula}`}
          >
            <Info size={14} />
          </span>
        )}
      </div>
    </div>
  );
}
