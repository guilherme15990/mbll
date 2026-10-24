import { ListChecks, ShieldCheck, Swords, TriangleAlert, Users } from "lucide-react";
import { cx, pct, type Pair } from "../../../lib/api";
import { Avatar } from "../../../components/ui";
import { signed } from "../../../shared/format";

/**
 * Átomos de confronto compartilhados pela aba Confrontos e pela prévia da
 * visão geral. Sem fetch e sem estado: só leitura de `Pair`.
 * δ é associação em p.p. — nunca probabilidade, nunca somar entre inimigos.
 */

export type MatchupTone = "threat" | "synergy" | "warning" | "advantage" | "neutral";

export const MATCHUP_TONE_TEXT: Record<MatchupTone, string> = {
  threat: "text-rose-300",
  synergy: "text-emerald-300",
  warning: "text-amber-300",
  advantage: "text-teal-300",
  neutral: "text-gold",
};

export const MATCHUP_TONE_BORDER: Record<MatchupTone, string> = {
  threat: "border-rose-400/20",
  synergy: "border-emerald-400/20",
  warning: "border-amber-300/20",
  advantage: "border-teal-400/20",
  neutral: "border-line",
};

export const MATCHUP_TONE_SURFACE: Record<MatchupTone, string> = {
  threat: "bg-rose-500/[0.04]",
  synergy: "bg-emerald-500/[0.04]",
  warning: "bg-amber-300/[0.04]",
  advantage: "bg-teal-400/[0.04]",
  neutral: "bg-abyss/25",
};

export function MatchupToneIcon({ tone, size = 14 }: { tone: MatchupTone; size?: number }) {
  const cls = cx("shrink-0", MATCHUP_TONE_TEXT[tone]);
  if (tone === "threat") return <Swords size={size} className={cls} aria-hidden="true" />;
  if (tone === "synergy") return <Users size={size} className={cls} aria-hidden="true" />;
  if (tone === "warning") return <TriangleAlert size={size} className={cls} aria-hidden="true" />;
  if (tone === "advantage") return <ShieldCheck size={size} className={cls} aria-hidden="true" />;
  return <ListChecks size={size} className={cls} aria-hidden="true" />;
}

export function fmtDelta(d: number | null | undefined): string {
  return signed(d, 3);
}

export function profileLabel(profile: string | undefined): string {
  if (profile === "snowball") return "early game";
  if (profile === "scaling") return "late game";
  if (profile === "uniforme") return "uniforme";
  if (profile === "insufficient_data") return "sem curva";
  return profile ?? "—";
}

function deltaPill(d: number | null | undefined): string {
  if (d == null || !Number.isFinite(d)) return "text-mist border-line bg-abyss/60";
  return d >= 0
    ? "text-emerald-300 border-emerald-400/30 bg-emerald-400/10"
    : "text-rose-300 border-rose-400/30 bg-rose-400/10";
}

/** δ do par: 3 casas, sinal explícito e tooltip de honestidade. */
export function MatchupDeltaChip({ delta }: { delta: number | null | undefined }) {
  return (
    <span
      className={cx("num text-[11px] font-bold px-2 py-0.5 rounded-full border shrink-0", deltaPill(delta))}
      title="δ em pontos percentuais — associação, não probabilidade; não somar entre inimigos"
    >
      <span className="opacity-60">δ</span> {fmtDelta(delta)}
    </span>
  );
}

/** Linha de par: avatar + nome + WR/perfil (+ pick opcional) + δ. */
export function MatchupPairRow({
  pair,
  showPick = true,
  avatarSize = 30,
}: {
  pair: Pair;
  showPick?: boolean;
  avatarSize?: number;
}) {
  const hasPick = pair.pick != null && Number.isFinite(pair.pick);
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <Avatar src={pair.head} name={pair.name} size={avatarSize} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-foam truncate">{pair.name}</p>
        <p className="text-[10px] text-mist truncate">
          WR {pct(pair.win, 0)}
          {showPick && hasPick ? ` · pick ${pct(pair.pick, 1)}` : ""}
          {` · ${profileLabel(pair.profile)}`}
        </p>
      </div>
      <MatchupDeltaChip delta={pair.delta} />
    </div>
  );
}
