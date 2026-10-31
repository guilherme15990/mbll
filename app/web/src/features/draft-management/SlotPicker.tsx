import { Search } from "lucide-react";
import { cx, num } from "../../shared/api";
import { Avatar } from "../../shared/ui";
import type { DraftHero, DraftLane } from "./model";
import { LANE_LABEL } from "./labels";

/**
 * Painel de escolha de herói de um slot (ADR-053 D1).
 *
 * Presentacional: a busca e a ordenação vivem no `TeamBoard`; aqui só entram os
 * resultados já filtrados. O ponto colorido é encaixe de rota, não força.
 */
export default function SlotPicker({
  slotIndex,
  lane,
  results,
  query,
  onQuery,
  onPick,
  onClose,
}: {
  slotIndex: number;
  lane: DraftLane;
  results: { hero: DraftHero; fit: boolean | null }[];
  query: string;
  onQuery: (value: string) => void;
  onPick: (heroId: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="rounded-xl border border-line bg-panel2/60 p-2 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] text-mist">
          Slot {slotIndex + 1} · rota <b className="text-foam">{LANE_LABEL[lane]}</b>
        </p>
        <button type="button" onClick={onClose} className="btn-ghost !px-2 !py-1 text-[10px]">
          Fechar
        </button>
      </div>
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mist" />
        <input
          autoFocus
          className="inp w-full !py-1.5 pl-8 text-xs"
          placeholder="Buscar herói por nome…"
          aria-label="Buscar herói para o slot"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onClose();
          }}
        />
      </div>
      <div className="max-h-52 overflow-y-auto grid sm:grid-cols-2 lg:grid-cols-3 gap-1 rounded-lg">
        {results.length === 0 ? (
          <p className="text-[11px] text-mist p-2">Nenhum herói disponível com esse nome.</p>
        ) : (
          results.map(({ hero, fit }) => (
            <button
              key={hero.id}
              type="button"
              onClick={() => onPick(hero.id)}
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-panel text-left transition-colors border border-line/40"
            >
              <Avatar src={hero.head} name={hero.name ?? `Herói #${hero.id}`} size={24} />
              <span className="text-[11px] font-semibold text-foam truncate flex-1">{hero.name}</span>
              <span className="text-[9px] font-mono text-mist">θ̂ {num(hero.wrAdj, 3)}</span>
              <span
                title={fit == null ? "rota sem dado" : fit ? "encaixa na rota" : "fora da rota"}
                aria-label={fit == null ? "rota sem dado" : fit ? "encaixa na rota" : "fora da rota"}
                className={cx(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  fit === true ? "bg-emerald-400" : fit === false ? "bg-amber-400" : "bg-mist/40",
                )}
              />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
