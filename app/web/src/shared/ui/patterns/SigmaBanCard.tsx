import { Sigma } from "lucide-react";
import { num } from "../../format";

/**
 * SigmaBanCard · casa /exposicao (Snapshot) + selo compacto /forca.
 * Σ pick e Σ ban em unidades próprias — NUNCA somados (INV4-003 no tipo: sem prop combinada).
 */
export function SigmaBanCard({
  sigmaBanSum,
  sigmaPickSum,
  sigmaAlert,
  pickFonte,
  ageMs,
  stale,
}: {
  sigmaBanSum: number | null;
  sigmaPickSum: number | null;
  sigmaAlert: boolean;
  pickFonte: "appearance" | "pick" | "appearance==pick" | null;
  ageMs?: number;
  stale?: boolean;
}) {
  return (
    <div className="card p-4 bg-panel border-line space-y-2.5" data-testid="sigma-ban-card">
      <div className="flex items-center gap-2">
        <Sigma size={14} className="text-gold" aria-hidden="true" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-foam">Conservação do lote</h3>
        {stale ? (
          <span className="text-[10px] font-mono text-amber-300 border border-amber-400/40 rounded px-1.5 py-0.5">
            há {ageMs != null ? `${Math.max(1, Math.round(ageMs / 3600e3))}h` : "—"}
          </span>
        ) : null}
      </div>
      <div className="grid sm:grid-cols-2 gap-2.5">
        <div className="p-2.5 rounded-xl bg-abyss/60 border border-line">
          <p className="text-[11px] text-mist">Σ pick ≈ 1</p>
          <p className="num text-lg font-bold text-foam">
            {num(sigmaPickSum, 4)}{" "}
            <span className="text-[10px] font-mono text-mist border border-line rounded px-1 py-0.5 align-middle">
              slot_share · unvalidated
            </span>
          </p>
          {pickFonte ? <p className="text-[10px] font-mono text-mist/70">fonte {pickFonte}</p> : null}
        </div>
        <div className="p-2.5 rounded-xl bg-abyss/60 border border-line">
          <p className="text-[11px] text-mist">Σ ban (unidade própria)</p>
          <p className="num text-lg font-bold text-foam">
            {num(sigmaBanSum, 4)}{" "}
            <span className="text-[10px] font-mono text-mist border border-line rounded px-1 py-0.5 align-middle">
              slot_share · unvalidated
            </span>
          </p>
          <p className="text-[10px] text-mist/70">faixa descritiva 7,6–8,9 · nunca somar com pick</p>
        </div>
      </div>
      {sigmaAlert ? (
        <p className="text-[11px] font-semibold text-amber-300 border border-dashed border-amber-400/50 rounded-xl px-2.5 py-1.5" role="status">
          Alerta de conservação — leitura mantida (|Σ pick − 1| &gt; 0,005). O lote segue legível.
        </p>
      ) : null}
    </div>
  );
}
