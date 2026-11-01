import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { cx } from "../../domain/present";
import { num, pct } from "../../format";
import { Avatar } from "../primitives/Avatar";
import { TierBadge } from "../primitives/TierBadge";

/**
 * Card de dados do herói — identidade + métricas no MESMO bloco.
 *
 * Fonte única para a ficha (`/hero/:id`) e para o Build Management (`/build`):
 * avatar, nome, tier, θ̂/WR/pick/ban/B e o aviso de amostra escassa. O card é
 * apresentacional: não busca dado, recebe o herói já carregado e delega os
 * slots de contexto (`aside`, `children`) para a tela.
 *
 * Regra de honestidade: métrica ausente vira "—" (nunca 0) via `shared/format`.
 */

export type HeroDataCardMetrics = {
  wrAdj?: number | null;
  win?: number | null;
  pick?: number | null;
  ban?: number | null;
  B?: number | null;
};

/** Métrica compacta do card — metadata junto da identidade, sem seção separada. */
function HeroMetric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wider text-mist">{label}</dt>
      <dd className="font-mono tabular-nums text-sm font-bold text-foam leading-tight truncate">{value}</dd>
      {hint ? <dd className="text-[10px] text-mist/60 leading-tight truncate">{hint}</dd> : null}
    </div>
  );
}

export type HeroDataCardProps = {
  name: string;
  head?: string | null;
  tier?: string | null;
  /** Dados do herói no recorte; ausente/inválido vira "—" em cada métrica. */
  metrics?: HeroDataCardMetrics | null;
  /** Janela do recorte, usada só no hint do WR observado. */
  window?: string | number;
  /** Herói ainda carregando: mostra esqueletos no tier e nas métricas. */
  loading?: boolean;
  /** Amostra pequena/degenerada: aviso de número puxado à média. */
  scarce?: boolean;
  /** Nível do título: `h1` em página, `p` quando embutido em outra superfície. */
  titleAs?: "h1" | "p";
  /** Selos extras ao lado do tier (ex.: pílula do módulo). */
  badges?: ReactNode;
  /** Slot à direita da identidade (lanes, ação primária). */
  aside?: ReactNode;
  /** Conteúdo abaixo das métricas (troca de herói, seletor de lane). */
  children?: ReactNode;
  className?: string;
};

export function HeroDataCard({
  name,
  head = null,
  tier = null,
  metrics = null,
  window,
  loading = false,
  scarce = false,
  titleAs = "p",
  badges,
  aside,
  children,
  className,
}: HeroDataCardProps) {
  const Title = titleAs;
  const hasMetrics = !loading && metrics != null;

  return (
    <div className={cx("rounded-2xl border border-line bg-panel p-4 md:p-5", className)}>
      <div className="flex items-center gap-4 flex-wrap">
        <Avatar src={head} name={name} size={64} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Title className="text-[22px] md:text-[28px] leading-tight font-extrabold tracking-tight text-foam font-sans">
              {name}
            </Title>
            {loading ? (
              <div className="flex items-center gap-2" role="status" aria-label="carregando selos do herói">
                <span className="h-6 w-14 rounded-full bg-panel2/60 animate-pulse motion-reduce:animate-none" />
                <span className="h-6 w-20 rounded-full bg-panel2/60 animate-pulse motion-reduce:animate-none" />
                <span className="h-6 w-24 rounded-full bg-panel2/60 animate-pulse motion-reduce:animate-none" />
              </div>
            ) : tier ? (
              <TierBadge tier={tier} />
            ) : null}
            {badges}
          </div>
        </div>

        {aside}
      </div>

      {loading ? (
        <div
          className="mt-4 pt-3 border-t border-line grid grid-cols-2 sm:grid-cols-5 gap-2"
          role="status"
          aria-label="carregando métricas do herói"
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className="h-9 rounded-lg bg-panel2/50 animate-pulse motion-reduce:animate-none" />
          ))}
        </div>
      ) : hasMetrics ? (
        <>
          <dl className="mt-4 pt-3 border-t border-line grid grid-cols-2 sm:grid-cols-5 gap-x-4 gap-y-2">
            <HeroMetric label="Força θ̂" value={num(metrics.wrAdj, 3)} hint="ajustada" />
            <HeroMetric label="WR obs" value={num(metrics.win, 3)} hint={window != null ? `janela ${window}d` : undefined} />
            <HeroMetric label="Pick" value={pct(metrics.pick)} hint="slot share" />
            <HeroMetric label="Ban" value={pct(metrics.ban)} hint="fração" />
            <HeroMetric label="Shrinkage B" value={num(metrics.B, 2)} hint="peso do dado" />
          </dl>
          {scarce ? (
            <div className="mt-2 flex items-start justify-between gap-2 flex-wrap">
              <p className="text-[11px] text-amber-200 flex items-center gap-1.5 flex-wrap">
                <TriangleAlert size={12} aria-hidden="true" className="shrink-0" />
                Amostra escassa — número puxado à média.
              </p>
            </div>
          ) : null}
        </>
      ) : null}

      {children ? <div className="mt-3 space-y-3">{children}</div> : null}
    </div>
  );
}
