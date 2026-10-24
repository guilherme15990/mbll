import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Ghost, HelpCircle, Inbox, Info, RotateCcw, ShieldCheck, Sparkles, Compass, TriangleAlert } from "lucide-react";
import { ago, cx, dir, dirWord, num } from "../lib/api";
import { useIdd, IDD_ZONES } from "./idd";

export function IddZone({
  zone,
  capId,
  className,
  children,
  ...rest
}: {
  zone: "identity" | "state" | "data" | "primary" | "secondary" | "risk";
  capId?: string;
  className?: string;
  children: React.ReactNode;
  [k: string]: unknown;
}) {
  const { inspectorEnabled } = useIdd();
  const config = IDD_ZONES[zone];
  const testId = (rest["data-testid"] as string | undefined) ?? `idd-zone-${zone}`;

  if (!inspectorEnabled) {
    return (
      <div className={className} data-testid={testId}>
        {children}
      </div>
    );
  }

  return (
    <div data-testid={testId} className={cx("relative rounded-xl border transition-all duration-200", config?.colorBorder, config?.colorBg, className)}>
      <div className="absolute -top-2.5 right-2 z-10 flex items-center gap-1 pointer-events-none">
        <span className={cx("text-[9px] font-mono px-1.5 py-0.2 rounded-full border shadow-sm font-semibold", config?.colorBadge)}>
          {config?.name}
        </span>
        {capId && (
          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-abyss text-gold border border-gold/40">
            {capId}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export function IddTraceBadge({ capId, step }: { capId: string; step?: string }) {
  const { inspectorEnabled } = useIdd();
  if (!inspectorEnabled) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-abyss/90 border border-gold/40 text-gold shadow-sm animate-fadeIn">
      <Compass size={11} className="text-gold" />
      <span>IDD: {capId}</span>
      {step && <span className="text-mist">({step})</span>}
    </span>
  );
}

export type TrustLevel = "Robusto" | "Situacional" | "Inconclusivo";

export function DomainStateBadge({
  status,
  label,
  icon,
}: {
  status: "solid" | "warning" | "inconclusive" | "neutral" | "gem" | "rank_state" | "temporal" | "safety" | "build" | "draft" | "robusto" | "situacional" | "inconclusivo";
  label: string;
  icon?: React.ReactNode;
}) {
  const styles: Record<string, string> = {
    solid: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    robusto: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    warning: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    situacional: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    inconclusive: "bg-slate-500/10 text-slate-300 border-slate-500/30",
    inconclusivo: "bg-slate-500/10 text-slate-300 border-slate-500/30",
    neutral: "bg-panel2 text-mist border-line",
    gem: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30 shadow-[0_0_12px_rgba(34,211,238,0.15)]",
    rank_state: "bg-indigo-500/10 text-indigo-300 border-indigo-500/30",
    temporal: "bg-sky-500/10 text-sky-300 border-sky-500/30",
    safety: "bg-rose-500/10 text-rose-300 border-rose-500/30",
    build: "bg-orange-500/10 text-orange-300 border-orange-500/30",
    draft: "bg-violet-500/10 text-violet-300 border-violet-500/30",
  };
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border", styles[status] ?? styles.neutral)}>
      {icon}
      <span>{label}</span>
    </span>
  );
}

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

export function Avatar({ src, name, size = 40 }: { src: string | null; name: string; size?: number }) {
  if (src) return <img src={src} alt={name} width={size} height={size} loading="lazy" className="rounded-xl border border-line object-cover shadow-sm" style={{ width: size, height: size }} />;
  return (
    <div className="rounded-xl border border-line bg-panel2 flex items-center justify-center font-bold text-gold shadow-sm" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {(name || "?").slice(0, 1)}
    </div>
  );
}

const TIER_STYLE: Record<string, string> = {
  S: "border-gold/70 text-gold bg-gold/15 shadow-[0_0_12px_rgba(240,180,41,0.2)]",
  A: "border-violet-400/60 text-violet-300 bg-violet-400/15 shadow-[0_0_12px_rgba(167,139,250,0.15)]",
  B: "border-sky-400/50 text-sky-300 bg-sky-400/10",
  C: "border-line text-mist bg-abyss/60",
  D: "border-line text-mist/60 bg-abyss/60",
  "?": "border-line text-mist bg-abyss/60",
};

export function TierBadge({ tier }: { tier: string }) {
  return <span className={cx("text-[11px] font-bold px-2 py-0.5 rounded-md border", TIER_STYLE[tier] ?? TIER_STYLE["?"])}>{tier}</span>;
}

const CLASS_STYLE: Record<string, string> = {
  Forte: "border-gold/60 text-gold bg-gold/10",
  Fraco: "border-mist/40 text-mist bg-abyss/40",
  Joia: "border-cyan-300/60 text-cyan-200 bg-cyan-400/10 shadow-[0_0_12px_rgba(34,211,238,0.2)]",
  "Na media": "border-line text-mist bg-abyss/40",
  "Amostra pequena": "border-line text-mist/70 italic bg-abyss/40",
};

export function ClassSeal({ cls }: { cls: string | null | undefined }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cx("text-[11px] font-medium px-2 py-0.5 rounded-full border", (cls != null && CLASS_STYLE[cls]) ?? CLASS_STYLE["Na media"])}>{cls ?? "Na media"}</span>
    </span>
  );
}

export function CtxSeal({ children }: { children: React.ReactNode }) {
  return <span className="ctx-seal">{children}</span>;
}

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

export function StatusSeal({ ok, good, bad }: { ok: boolean; good: string; bad: string }) {
  return ok
    ? <span className="text-[11px] px-2 py-0.5 rounded-full border text-emerald-300 border-emerald-400/30 bg-emerald-400/10">{good}</span>
    : <span className="text-[11px] px-2 py-0.5 rounded-full border text-amber-200 border-amber-300/30 bg-amber-300/10">{bad}</span>;
}

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

export function Delta({ z }: { z: unknown }) {
  return (
    <span className="num text-xs text-mist" title={typeof z === "number" ? `d=${num(z)} (${dirWord(z)})` : "sem dado"}>
      {dir(z)} {typeof z === "number" && Number.isFinite(z) ? num(z) : ""}
    </span>
  );
}

/** Barra de evidência: θ̂ com marcador, escala 0.35–0.65. */
export function ThetaBar({ value, median = 0.5 }: { value: number; median?: number }) {
  const lo = 0.35, hi = 0.65;
  const pos = (v: number) => Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100));
  const label = `theta estimado ${num(value, 3)} · mediana ${num(median, 3)} · escala 0,35 a 0,65`;
  return (
    <div
      role="img"
      aria-label={label}
      title={`θ̂ ${num(value, 3)} · mediana ${num(median, 3)}`}
      className="relative h-1.5 rounded-full bg-abyss border border-line min-w-[90px]"
    >
      <div className="absolute top-0 bottom-0 w-px bg-mist/60" style={{ left: `${pos(median)}%` }} />
      <div className="absolute w-2 h-2 rounded-full bg-gold -top-[3px] shadow-glow" style={{ left: `calc(${pos(value)}% - 4px)` }} />
    </div>
  );
}

export function FreshLine({ stale, ageMs, postPatch }: { stale?: boolean; ageMs?: number; postPatch?: boolean }) {
  return (
    <p className="text-xs text-mist flex items-center gap-2 flex-wrap">
      <span className={cx("inline-block w-1.5 h-1.5 rounded-full", stale ? "bg-amber-400" : "bg-emerald-400")} />
      {stale ? `dados de ${ago(ageMs)} (fonte instável, último válido)` : `atualizado ${ago(ageMs)}`}
      {postPatch && <CtxSeal>janela pós-patch</CtxSeal>}
    </p>
  );
}

export function Loading({ rows = 6 }: { rows?: number }) {
  return (
    <div className="grid gap-2.5" aria-label="carregando">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 rounded-2xl bg-panel border border-line animate-pulse" />
      ))}
    </div>
  );
}

export function Empty({
  title = "Nada por aqui",
  hint,
  to,
  action,
}: {
  title?: string;
  hint: string;
  to?: string;
  action?: string;
}) {
  return (
    <div className="card p-8 text-center grid place-items-center gap-2.5">
      <span className="p-3 rounded-2xl bg-panel2 text-mist border border-line">
        <Inbox size={24} />
      </span>
      <h3 className="font-bold text-base text-foam">{title}</h3>
      <p className="text-xs text-mist max-w-md leading-relaxed">{hint}</p>
      {to && action && (
        <Link to={to} className="btn-ghost mt-2 inline-flex items-center gap-1.5 text-xs">
          {action} →
        </Link>
      )}
    </div>
  );
}

export function ErrBox({ onRetry, message }: { onRetry?: () => void; message?: string }) {
  return (
    <div className="card p-6 border-amber-300/40 bg-amber-400/5 text-center grid place-items-center gap-2.5">
      <span className="p-2.5 rounded-xl bg-amber-400/10 text-amber-300 border border-amber-400/30">
        <AlertTriangle size={22} />
      </span>
      <h3 className="font-bold text-sm text-foam">Falha na consulta da API</h3>
      <p className="text-xs text-mist max-w-md leading-relaxed">
        {message ?? "Não foi possível carregar os dados deste contexto. Pode ser uma indisponibilidade temporária da API comunitária Rone Arena ou parâmetros de consulta incompatíveis."}
      </p>
      {onRetry && (
        <button onClick={onRetry} className="btn-ghost mt-2 inline-flex items-center gap-1.5 text-xs">
          <RotateCcw size={14} /> Tentar novamente
        </button>
      )}
    </div>
  );
}

export function SectionTitle({
  kicker,
  title,
  right,
  subtitle,
}: {
  kicker?: string;
  title: string;
  right?: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        {kicker && <p className="lbl mb-0.5">{kicker}</p>}
        <h2 className="text-lg md:text-xl font-bold tracking-tight text-foam">{title}</h2>
        {subtitle && <p className="text-xs text-mist mt-0.5">{subtitle}</p>}
      </div>
      {right && <div className="self-center">{right}</div>}
    </div>
  );
}

export function GhostNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-mist/80 italic flex items-center gap-1.5">
      <Ghost size={13} className="shrink-0 text-mist/60" />
      <span>{children}</span>
    </p>
  );
}

/* ————————————————————————————————————————————————
 * hero-restyle-v1 §2.6 — átomos novos (sem lógica de dado).
 * AnchorNumber (label + valor + unidade) · StateStrip
 * (faixa full-width de estado) · HeroBanner (kicker + H1
 * display + âncoras + selo + faixa + ver prova).
 * ———————————————————————————————————————————————— */

export function AnchorNumber({
  label,
  value,
  unit,
  title,
}: {
  label: string;
  value: string;
  unit: string;
  title?: string;
}) {
  return (
    <div className="min-w-[110px]">
      <p className="text-[11px] text-mist">{label}</p>
      <p className="font-mono tabular-nums text-lg md:text-xl font-bold text-foam" title={title ?? `${label}: ${value} ${unit}`}>
        {value}
      </p>
      <p className="text-[10px] text-mist/70">{unit}</p>
    </div>
  );
}

export type StateStripTone = "amber" | "slate" | "rose";

const STATE_STRIP_CLASS: Record<StateStripTone, string> = {
  amber: "bg-amber-400/10 border-amber-400/30 text-amber-200",
  slate: "bg-abyss/60 border-line text-mist",
  rose: "bg-rose-500/10 border-rose-400/30 text-rose-200",
};

export function StateStrip({
  tone,
  bleed = "banner",
  children,
}: {
  tone: StateStripTone;
  /** banner = dentro de HeroBanner (p-4/md:p-6) · capa = dentro da capa home (p-5/md:p-8). */
  bleed?: "banner" | "capa";
  children: ReactNode;
}) {
  return (
    <div
      role="status"
      className={`px-4 md:px-6 py-2 text-xs font-semibold border-y flex items-center gap-2 flex-wrap ${bleed === "capa" ? "-mx-5 md:-mx-8" : "-mx-4 md:-mx-6"} ${STATE_STRIP_CLASS[tone]}`}
    >
      {children}
    </div>
  );
}

export type HeroBannerTone =
  | "gold" | "rose" | "emerald" | "amber" | "slate" | "cyan" | "sky" | "violet";

const HERO_BANNER_BORDER: Record<HeroBannerTone, string> = {
  gold: "border-l-gold/60",
  rose: "border-l-rose-400/60",
  emerald: "border-l-emerald-400/60",
  amber: "border-l-amber-400/60",
  slate: "border-l-slate-500/50",
  cyan: "border-l-cyan-400/60",
  sky: "border-l-sky-400/60",
  violet: "border-l-violet-400/60",
};

export function HeroBanner({
  kicker,
  title,
  subtitle,
  anchors,
  seal,
  stamp,
  strip,
  proofId,
  proofLabel = "ver prova ↓",
  tone = "gold",
  editorial = false,
  bare = false,
  className,
}: {
  kicker: string;
  title: string;
  subtitle?: ReactNode;
  anchors?: ReactNode;
  seal?: ReactNode;
  stamp?: string;
  strip?: ReactNode;
  proofId: string;
  proofLabel?: string;
  tone?: HeroBannerTone;
  editorial?: boolean;
  /** bare = sem caixa própria (vive dentro de uma capa maior). */
  bare?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        bare
          ? "space-y-2.5 motion-reduce:animate-none"
          : "rounded-2xl border border-line border-l-4 p-4 md:p-6 space-y-2.5 min-h-[148px] motion-reduce:animate-none",
        !bare && HERO_BANNER_BORDER[tone],
        !bare && (editorial ? "bg-gradient-to-br from-panel via-panel2/80 to-abyss" : "bg-panel"),
        className,
      )}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-mist">{kicker}</p>
      <h1 className="text-[26px] leading-[1.15] md:text-[34px] font-extrabold tracking-tight text-foam break-words">
        {title}
      </h1>
      {subtitle ? (
        <p className="text-[13px] md:text-sm leading-relaxed text-foam/90">{subtitle}</p>
      ) : null}
      {anchors ? <div className="flex gap-4 md:gap-6 flex-wrap">{anchors}</div> : null}
      {seal || stamp ? (
        <div className="flex gap-2 flex-wrap items-center">
          {seal}
          {stamp ? (
            <span className="text-[10px] font-mono text-mist/70" title="Carimbo de recorte do veredito">
              {stamp}
            </span>
          ) : null}
        </div>
      ) : null}
      {strip}
      <a
        href={`#${proofId}`}
        aria-label={`${proofLabel} — rolar para a prova`}
        className="inline-flex items-center gap-1 text-[11px] font-bold text-gold hover:underline underline-offset-2 min-h-[44px]"
      >
        {proofLabel}
      </a>
    </div>
  );
}


