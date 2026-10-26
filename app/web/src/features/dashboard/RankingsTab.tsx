import { Link } from "react-router-dom";
import { num, pct, useGems, useHeroes, type Hero } from "../../shared/api";
import { withLanes } from "../../app/filters";
import { Avatar, Empty, ErrBox, Loading, TierBadge } from "../../shared/ui";

type RankRow = { id: number; name: string; head: string | null; tier: string };
type GemRow = Hero & { reason: string };

/** Lista top-5 de rankings: 1 request pequeno (size=5) por lista, erro isolado por bloco. */
function TopList({ title, note, pending, failed, onRetry, items, value, rank, window, lanes }: {
  title: string; note: string;
  pending: boolean; failed: boolean; onRetry: () => void;
  items: RankRow[]; value: (h: RankRow) => string;
  rank: string; window: string; lanes: string[];
}) {
  return (
    <div className="card p-4 bg-panel border-line space-y-2.5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-foam">{title}</h3>
        <span className="text-[10px] font-mono text-mist" title={note}>top 5 · faixa</span>
      </div>
      {pending ? (
        <Loading rows={3} />
      ) : failed ? (
        <ErrBox onRetry={onRetry} />
      ) : !items.length ? (
        <Empty title="Sem leitura" hint="Sem heróis neste recorte." />
      ) : (
        <ul className="space-y-1.5">
          {items.map((h, i) => (
            <li key={h.id}>
              <Link
                to={withLanes(`/hero/${h.id}?rank=${rank}&window=${window}`, lanes)}
                className="flex items-center gap-2.5 p-2 rounded-xl bg-abyss/60 border border-line hover:border-gold/40 transition-colors"
                aria-label={`${i + 1}º ${title}: abrir ficha de ${h.name}`}
              >
                <span className="text-[11px] font-mono text-gold w-4 shrink-0">{i + 1}</span>
                <Avatar src={h.head} name={h.name} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-foam truncate">{h.name}</span>
                  <span className="block text-[11px] text-mist font-mono">{value(h)}</span>
                </span>
                <TierBadge tier={h.tier} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Aba Rankings do /dashboard — código separado da grade de heróis.
 * 4 requests pequenos (size=5, pág 1 = top global do sort), SÓ com a aba ativa
 * (`enabled`). Joias reutiliza a key ["gems",…] já buscada pelo dashboard.
 */
export default function RankingsTab({ rank, window, active, lanes }: { rank: string; window: string; active: boolean; lanes: string[] }) {
  const topFortes = useHeroes(rank, window, "sort=win&order=desc", 1, 5, active);
  const topFracos = useHeroes(rank, window, "sort=win&order=asc", 1, 5, active);
  const topBanidos = useHeroes(rank, window, "sort=ban&order=desc", 1, 5, active);
  const topPopulares = useHeroes(rank, window, "sort=pick&order=desc", 1, 5, active);
  const gemsQuery = useGems(rank, window);
  const gems = ((gemsQuery.data as unknown as { data?: GemRow[] } | undefined)?.data ?? []).slice(0, 5);

  return (
    <div
      className="grid gap-3 md:grid-cols-2"
      role="tabpanel"
      id="panel-rankings"
      aria-labelledby="tab-rankings"
    >
      <TopList
        title="Top 5 fortes" note="θ̂ estimado (shrinkage), ordem do servidor"
        pending={topFortes.isLoading} failed={topFortes.isError}
        onRetry={() => topFortes.refetch()} items={topFortes.data?.data ?? []}
        value={(h) => `θ̂ ${num((h as Hero).wrAdj, 3)}`} rank={rank} window={window} lanes={lanes}
      />
      <TopList
        title="Top 5 fracos" note="θ̂ estimado (shrinkage), ordem ascendente do servidor"
        pending={topFracos.isLoading} failed={topFracos.isError}
        onRetry={() => topFracos.refetch()} items={topFracos.data?.data ?? []}
        value={(h) => `θ̂ ${num((h as Hero).wrAdj, 3)}`} rank={rank} window={window} lanes={lanes}
      />
      <TopList
        title="Top 5 banidos" note="taxa de ban (fração de partidas), ordem do servidor"
        pending={topBanidos.isLoading} failed={topBanidos.isError}
        onRetry={() => topBanidos.refetch()} items={topBanidos.data?.data ?? []}
        value={(h) => `ban ${pct((h as Hero).ban, 1)}`} rank={rank} window={window} lanes={lanes}
      />
      <TopList
        title="Top 5 populares" note="pick = participação nos slots de herói da partida (slot_share), ordem do servidor"
        pending={topPopulares.isLoading} failed={topPopulares.isError}
        onRetry={() => topPopulares.refetch()} items={topPopulares.data?.data ?? []}
        value={(h) => `pick ${pct((h as Hero).pick, 1)}`} rank={rank} window={window} lanes={lanes}
      />
      <TopList
        title="Joias em destaque" note="candidatos com motivo; rótulo exige persistência"
        pending={gemsQuery.isLoading} failed={gemsQuery.isError}
        onRetry={() => gemsQuery.refetch()} items={gems}
        value={(h) => (h as GemRow).reason ?? `θ̂ ${num((h as Hero).wrAdj, 3)}`} rank={rank} window={window} lanes={lanes}
      />
    </div>
  );
}
