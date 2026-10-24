import { LANES, RANKS } from "../../lib/api";
import { Empty } from "../ui";

/**
 * IDD C3 — NeedsRank / NeedsLane · vazios orientados (P0-1/P0-5, INV4-024/027).
 * Montar este bloco SUBSTITUI o bloco de dados — nenhum fetch dispara sob estes estados.
 */

export function NeedsRank({
  capId = "CAP-BPS-01",
  title = "Selecione o rank",
  hint = "Proxy exige elo explícito — all não gera número (INV4-024).",
  onPick,
}: {
  capId?: string;
  title?: string;
  hint?: string;
  onPick: (rank: string) => void;
}) {
  const ranks = (RANKS as readonly string[]).filter((r) => r !== "all");
  return (
    <div data-testid="needs-rank" data-capid={capId}>
      <Empty title={title} hint={hint} />
      <div className="card p-3.5 bg-panel border-line flex items-center gap-2 flex-wrap mt-3">
        {ranks.map((r) => (
          <button
            key={r}
            onClick={() => onPick(r)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold uppercase bg-abyss/60 text-mist hover:text-foam border border-line hover:border-gold/40 transition-all"
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}

export function NeedsLane({
  capId = "CAP-BDL-01",
  allowedFrom422,
  onPick,
}: {
  capId?: string;
  allowedFrom422?: string[];
  onPick: (lane: string) => void;
}) {
  const lanes = allowedFrom422?.length ? allowedFrom422 : ([...LANES] as string[]);
  return (
    <div data-testid="needs-lane" data-capid={capId}>
      <Empty
        title="Escolha a lane"
        hint="Sem lane, sem lift (INV4-027). Lane é parâmetro obrigatório — sem default silencioso."
      />
      <div className="card p-3.5 bg-panel border-line flex items-center gap-2 flex-wrap mt-3">
        {lanes.map((l) => (
          <button
            key={l}
            onClick={() => onPick(l)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold uppercase bg-abyss/60 text-mist hover:text-foam border border-line hover:border-gold/40 transition-all"
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}
