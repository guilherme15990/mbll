import { Link } from "react-router-dom";
import { num, pct, type Hero, type LotMeta } from "../../../lib/api";
import {
  Empty, SectionTitle, ThetaBar, TierBadge,
} from "../../../components/ui";

/**
 * Aba Força da ficha isolada — 0 buscas além do herói compartilhado.
 * Prova: ThetaBar + banda-c. Sem tabela global, sem KPIs do meta.
 */
export default function ForcaSection({
  hero,
  rank,
  window,
  meta,
}: {
  hero: Hero | undefined;
  rank: string;
  window: string;
  meta?: LotMeta;
}) {
  if (!hero) {
    return (
      <Empty
        title="Sem dado de força"
        hint="O detalhe do herói ainda não carregou. Aguarde ou volte à visão geral."
      />
    );
  }
  const escasso = (hero.B ?? 1) < 0.25 || hero.smallSample;

  return (
    <section className="space-y-4 animate-fadeIn motion-reduce:animate-none" aria-label="Força do herói">
      <div id="prova-forca" className="space-y-4 scroll-mt-4">
        <SectionTitle kicker="Prova" title="Número-herói + ThetaBar" subtitle={`z ${num(hero.z, 2)} · q ${num(hero.q, 4)} · B ${num(hero.B, 2)}`} />
        <div className="card p-4 bg-panel border-gold/40 space-y-2.5" aria-label={`Destaque de força de ${hero.name}`}>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-base font-bold text-foam font-sans">{hero.name}</p>
              <ThetaBar value={hero.wrAdj} />
              <p className="text-[11px] text-mist font-mono">
                θ̂ {num(hero.wrAdj, 3)} vs obs {num(hero.win, 3)} · pick {pct(hero.pick)} · ban {pct(hero.ban)}
              </p>
            </div>
            <TierBadge tier={hero.tier} />
          </div>
          <p className="text-[11px] font-mono text-mist" title="B = puxada à média; z = distância em erros-padrão; q = taxa de falsa descoberta">
            {hero.B != null && Number.isFinite(hero.B) ? `B ${num(hero.B, 2)} · ` : ""}z {num(hero.z, 2)} · q {num(hero.q, 4)}
            {escasso ? " · amostra escassa (encolhido à média)" : ""}
          </p>
        </div>
      </div>

      <Link
        to={`/forca?rank=${rank}&window=${window}`}
        className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gold text-abyss text-sm font-bold hover:bg-gold-light transition-colors min-h-[44px]"
      >
        Ver panorama de força →
      </Link>

      <p className="text-[11px] text-mist/70">
        Prova: θ̂, B, d, q do próprio herói ·{" "}
        <Link to={`/hero/${hero.id}?tab=confianca&rank=${rank}&window=${window}`} className="underline hover:text-gold min-h-[44px] inline-flex items-center" aria-label="Abrir aba Confiança deste herói">
          checar confiança →
        </Link>
      </p>
    </section>
  );
}
