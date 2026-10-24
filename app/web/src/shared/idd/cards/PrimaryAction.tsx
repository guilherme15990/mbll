import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { IddZone } from "../IddZone";

/**
 * IDD C1 — PrimaryAction · 1 por página (agregado = tela).
 * Renderiza IddZone zone="primary" por construção (grep §4.2 frontend-v4).
 * Operação de LEITURA instrumentada — nunca Comando de domínio (§11).
 */
export type PrimaryContextId = "SHR" | "CNF" | "RNK" | "TMP" | "M6" | "DRF" | "BPS" | "BDL" | "EXP";

export function PrimaryAction({
  contextId,
  capId,
  label,
  to,
  secondaryLabel,
  onSecondary,
  disabledReason,
  disabled,
}: {
  contextId: PrimaryContextId;
  capId: string;
  label: string;
  to: string;
  secondaryLabel?: string;
  onSecondary?: () => void;
  disabledReason?: string | null;
  disabled?: boolean;
}) {
  const blocked = Boolean(disabled) || disabledReason != null;
  void contextId;
  return (
    <IddZone zone="primary" capId={capId} data-testid="idd-zone-primary">
      <div className="card p-3.5 bg-panel border-gold/40 flex items-center gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-mono text-mist uppercase tracking-wider">Ação primária · {capId}</p>
          <p className="text-sm font-bold text-foam">{label}</p>
          {blocked && disabledReason ? (
            <p className="text-[11px] text-amber-300 mt-0.5" role="status">
              {disabledReason}
            </p>
          ) : null}
        </div>
        {blocked ? (
          <button
            disabled
            aria-disabled="true"
            aria-label={`${label} — ${disabledReason ?? "indisponível neste recorte"}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-abyss/60 text-mist border border-line cursor-not-allowed"
          >
            {label}
            <ArrowRight size={14} />
          </button>
        ) : (
          <Link
            to={to}
            aria-label={`${label} — ${capId}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-400/40 hover:bg-emerald-500/25 transition-all"
          >
            {label}
            <ArrowRight size={14} />
          </Link>
        )}
        {secondaryLabel && onSecondary && !blocked ? (
          <button
            onClick={onSecondary}
            className="text-[11px] text-mist hover:text-gold underline underline-offset-2"
          >
            {secondaryLabel}
          </button>
        ) : null}
      </div>
    </IddZone>
  );
}
