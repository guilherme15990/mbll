import { pct } from "../../../shared/api";
import type {
  AggregateEmblemStat, AggregateItem, AggregateItemShape, AggregateRunePage,
  AggregateSet, AggregateSpell, AggregateTalent, AggregateTriple,
} from "../../../shared/api";
import { AdoptionBar, DeltaValue } from "./chips";
import { deltaStatusOfPp } from "./model";

/**
 * Cards do agregado: item/pacote, emblema, conjunto, trio, página de runas e as
 * linhas de talento/feitiço.
 *
 * Cada card é uma leitura do mesmo payload — nenhum busca dado nem calcula
 * delta (o status vem do contrato; `deltaStatusOfPp` só é usado como fallback
 * no trio, que pode vir sem `delta_status`).
 */

export function TalentRow({ row }: { row: AggregateTalent }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5 border-t border-line/40 first:border-t-0">
      {row.icon ? (
        <img src={row.icon} alt="" title={row.name ?? `Talento #${row.id}`} className="w-7 h-7 rounded border border-line" loading="lazy" />
      ) : (
        <span className="w-7 h-7 rounded border border-line grid place-items-center text-[9px] num text-mist bg-abyss">#{row.id}</span>
      )}
      <div className="min-w-0 flex-1" title={row.desc ?? undefined}>
        <p className="text-xs text-foam truncate">{row.label}</p>
        <AdoptionBar value={row.adoption} />
      </div>
      <div className="text-right shrink-0 w-[74px]">
        <p className="lbl text-[9px]">Vitória mediana</p>
        <p className="num text-[12px] font-bold text-foam">{pct(row.win_median)}</p>
      </div>
      <div className="text-right shrink-0 w-[28px] text-[13px]">
        <DeltaValue value={row.delta_wr_pp_median} status={row.delta_status} compact />
      </div>
    </div>
  );
}

export function SpellRow({ row }: { row: AggregateSpell }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5 border-t border-line/40 first:border-t-0">
      {row.icon ? (
        <img src={row.icon} alt="" title={row.name ?? "feitiço"} className="w-7 h-7 rounded border border-line" loading="lazy" />
      ) : null}
      <div className="min-w-0 flex-1" title={row.desc ?? undefined}>
        <p className="text-xs text-foam truncate">{row.name ?? "—"}</p>
        <AdoptionBar value={row.adoption} />
      </div>
      <div className="text-right shrink-0 w-[74px]">
        <p className="lbl text-[9px]">Vitória mediana</p>
        <p className="num text-[12px] font-bold text-foam">{pct(row.win_median)}</p>
      </div>
      <div className="text-right shrink-0 w-[28px] text-[13px]">
        <DeltaValue value={row.delta_wr_pp_median} status={row.delta_status} compact />
      </div>
    </div>
  );
}

export function ItemIcons({ items, size = 36 }: { items: AggregateItemShape[]; size?: number }) {
  if (!items.length) return <span className="text-[11px] text-mist">sem itens</span>;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {items.map((it, idx) =>
        it.icon ? (
          <img
            key={`${it.id}-${idx}`}
            src={it.icon}
            alt={it.name ?? `Item #${it.id}`}
            title={it.name ?? `Item #${it.id}`}
            className="rounded-lg border border-line object-cover bg-panel2"
            style={{ width: size, height: size }}
            loading="lazy"
          />
        ) : (
          <span
            key={`${it.id}-${idx}`}
            title={it.name ?? `Item #${it.id}`}
            className="rounded-lg border border-line flex items-center justify-center text-[9px] num text-mist bg-abyss"
            style={{ width: size, height: size }}
          >
            #{it.id}
          </span>
        ),
      )}
    </div>
  );
}

export function ItemCard({ row, packageRow = false }: { row: AggregateItem; packageRow?: boolean }) {
  const icons: AggregateItemShape[] = row.items?.length
    ? row.items
    : row.icon
      ? [{ id: row.item_id ?? 0, name: row.name, icon: row.icon }]
      : [];
  const names = icons.map((i) => i.name ?? `#${i.id}`).filter(Boolean);
  const title = packageRow
    ? names.join(" + ") || row.name || "Pacote"
    : row.name ?? `Item #${row.item_id ?? "?"}`;
  return (
    <div className="card p-3.5 bg-panel border-line space-y-2.5">
      <div className="flex items-center gap-3 flex-wrap">
        <ItemIcons items={icons} size={38} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-sm text-foam">{title}</span>
            {packageRow && row.inseparable && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-orange-300/40 bg-orange-400/10 text-orange-200">
                Sempre juntos
              </span>
            )}
            {packageRow && !row.inseparable && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-300/40 bg-amber-400/10 text-amber-200">
                Poucos dados
              </span>
            )}
          </div>
        </div>
        <div className="text-right max-w-[190px]">
          <p className="lbl text-[10px]">Desempenho</p>
          <p className="text-[12px] leading-tight"><DeltaValue value={row.delta_wr_pp_median} status={row.delta_status} /></p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap text-[11px] text-mist">
        <span>Aparece em {pct(row.adoption_builds, 0)} das builds</span>
      </div>
      {packageRow && (
        <p className="text-[11px] text-mist/90">
          {row.inseparable
            ? "Esses itens quase nunca aparecem separados nos dados."
            : "Apareceram juntos, mas ainda há poucos dados para tratar como padrão."}
        </p>
      )}
    </div>
  );
}

export function EmblemCard({ row, lane }: { row: AggregateEmblemStat; lane?: string }) {
  return (
    <div className="card p-3.5 bg-panel border-line space-y-2.5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          {row.icon ? (
            <img src={row.icon} alt={row.name ?? `Emblema #${row.emblem_id}`} title={row.name ?? `#${row.emblem_id}`} className="w-9 h-9 rounded-lg border border-line" />
          ) : (
            <span className="w-9 h-9 rounded-lg border border-line grid place-items-center text-[10px] num text-mist bg-abyss">
              #{row.emblem_id}
            </span>
          )}
          <div>
            <p className="lbl text-[10px]">Emblema</p>
            <p className="text-sm font-semibold text-foam">{row.name ?? `#${row.emblem_id}`}</p>
          </div>
        </div>
        <div className="ml-auto text-right max-w-[200px] space-y-1">
          <div>
            <p className="lbl text-[10px]">Vitória na rota {lane ? lane.toUpperCase() : "selecionada"}</p>
            <p className="text-[13px] leading-tight font-bold text-foam">{pct(row.win_median)}</p>
          </div>
          <div>
            <p className="lbl text-[10px]">vs normal do herói</p>
            <p className="text-[12px] leading-tight"><DeltaValue value={row.delta_wr_pp_median} status={row.delta_status} /></p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap text-[11px] text-mist">
        <span>Aparece em {pct(row.adoption_builds, 0)} das builds</span>
      </div>
    </div>
  );
}

export function SetCard({ row }: { row: AggregateSet }) {
  return (
    <div className="card p-3 bg-panel border-line space-y-2">
      <div className="flex items-center gap-2.5 flex-wrap">
        <ItemIcons items={row.items} size={32} />
        <div className="ml-auto text-right max-w-[190px]">
          <p className="lbl text-[10px]">Desempenho</p>
          <p className="text-[12px] leading-tight"><DeltaValue value={row.delta_wr_pp_median} status={row.delta_status} /></p>
        </div>
      </div>
    </div>
  );
}

export function TripleCard({ row }: { row: AggregateTriple }) {
  const status = row.delta_status ?? deltaStatusOfPp(row.delta_wr_pp_max);
  return (
    <div className="card p-3 bg-panel border-line space-y-2">
      <div className="flex items-center gap-2.5 flex-wrap">
        <ItemIcons items={row.items} size={32} />
        <div className="ml-auto text-right max-w-[190px]">
          <p className="lbl text-[10px]">Desempenho</p>
          <p className="text-[12px] leading-tight"><DeltaValue value={row.delta_wr_pp_max} status={status} /></p>
        </div>
      </div>
    </div>
  );
}

export function RunePageCard({ page }: { page: AggregateRunePage }) {
  return (
    <div className="card p-3.5 bg-panel border-line space-y-2.5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          {page.emblem.icon ? (
            <img src={page.emblem.icon} alt={page.emblem.label} title={page.emblem.label} className="w-9 h-9 rounded-lg border border-line" />
          ) : (
            <span className="w-9 h-9 rounded-lg border border-line grid place-items-center text-[10px] num text-mist bg-abyss">
              {page.emblem.id != null ? `#${page.emblem.id}` : "—"}
            </span>
          )}
          <div>
            <p className="lbl text-[10px]">Emblema</p>
            <p className="text-sm font-semibold text-foam">{page.emblem.label}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {page.talents.map((t) => (
            <span key={t.id} title={t.desc ?? ""} className="text-[10px] px-2 py-0.5 rounded-full border border-line bg-abyss/60 text-mist">
              {t.name ?? `#${t.id}`}{t.tier != null ? ` · T${t.tier}` : ""}
            </span>
          ))}
        </div>
        {page.spell && (
          <div className="flex items-center gap-1.5 ml-auto">
            {page.spell.icon ? (
              <img src={page.spell.icon} alt={page.spell.name} title={page.spell.name} className="w-8 h-8 rounded-lg border border-line" />
            ) : null}
            <div>
              <p className="lbl text-[10px]">Feitiço</p>
              <p className="text-xs text-foam">{page.spell.name}</p>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap text-[11px] text-mist">
        <span>Vitória mediana <b className="num text-foam">{pct(page.win_median)}</b></span>
        <span>Aparece em {pct(page.adoption, 0)} das builds</span>
        <span>· <DeltaValue value={page.delta_wr_pp_median} status={page.delta_status} /></span>
      </div>
    </div>
  );
}
