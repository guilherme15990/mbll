import { type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, Info, Layers, Package, Sparkles, Swords } from "lucide-react";
import {
  LANES, cx, pct, useBuildsAggregate,
  type AggregateDeltaStatus, type AggregateEmblemStat, type AggregateItem, type AggregateItemShape,
  type AggregateRunePage, type AggregateSet, type AggregateSpell,
  type AggregateTalent, type AggregateTriple,
  type DiscoveryStatus, type PatternScope,
} from "../../lib/api";
import {
  CtxBar, Empty, ErrBox, FreshLine, Loading, SectionTitle,
} from "../../components/ui";
import { pp } from "../../shared/format";

const ARCHETYPES: { key: string; label: string }[] = [
  { key: "physical_attack", label: "Ataque físico" },
  { key: "magic_attack", label: "Ataque mágico" },
  { key: "physical_defense", label: "Defesa física" },
  { key: "magic_defense", label: "Defesa mágica" },
];

// Categorias separadas exigidas na revisão: híbridos, utilitários e não
// classificados não entram nos quatro blocos principais. O que não for um dos
// quatro arquétipos principais cai no bloco "outros" — nunca é descartado.

function deltaStatusOfPp(deltapp: number | null | undefined): AggregateDeltaStatus {
  if (deltapp == null || !Number.isFinite(deltapp)) return "insufficient";
  if (Math.abs(deltapp) < 2) return "no_practical_difference";
  return deltapp > 0 ? "positive" : "negative";
}

function DeltaValue({ value, status, detailed = false, compact = false }: {
  value: number | null | undefined;
  status: AggregateDeltaStatus;
  detailed?: boolean;
  compact?: boolean;
}) {
  if (status === "insufficient" || value == null || !Number.isFinite(value)) {
    return <span className="text-mist">Poucos dados</span>;
  }
  if (status === "no_practical_difference") {
    if (compact) return <span className="text-mist" title="Sem diferença relevante">—</span>;
    return detailed ? <span className="text-mist">Sem diferença relevante</span> : null;
  }
  const positive = value > 0;
  if (compact) {
    return (
      <span
        title={positive ? "Vence mais que o normal do herói" : "Vence menos que o normal do herói"}
        className={cx("font-bold", positive ? "text-emerald-300" : "text-rose-300")}
      >
        {positive ? "▲" : "▼"}
      </span>
    );
  }
  if (detailed) {
    return (
      <span className={cx("font-mono font-bold", positive ? "text-emerald-300" : "text-rose-300")}>
        {pp(value)}
      </span>
    );
  }
  return (
    <span className={cx("font-semibold", positive ? "text-emerald-300" : "text-rose-300")}>
      {positive ? "▲" : "▼"} {positive ? "Vence mais que o normal" : "Vence menos que o normal"}
    </span>
  );
}

const SCOPE_LABELS: Record<PatternScope, string> = {
  cross_hero: "Vários heróis",
  two_heroes: "2 heróis",
  single_hero: "Um herói só",
};

const DISCOVERY_LABELS: Record<DiscoveryStatus, string> = {
  consolidated: "Padrão recorrente",
  emerging: "Joia escondida",
  local: "Só naquele herói",
  provisional: "Poucos dados",
};

function ScopeChip({ scope }: { scope?: PatternScope }) {
  if (!scope) return null;
  return (
    <span
      title="Mostra se a combinação aparece em vários heróis ou só em um."
      className={cx(
        "text-[10px] px-2 py-0.5 rounded-full border",
        scope === "cross_hero"
          ? "text-emerald-200 border-emerald-400/30 bg-emerald-400/10"
          : scope === "two_heroes"
            ? "text-sky-200 border-sky-400/30 bg-sky-400/10"
            : "text-mist border-line bg-abyss/60",
      )}
    >
      {SCOPE_LABELS[scope]}
    </span>
  );
}

function DiscoveryChip({ status }: { status?: DiscoveryStatus }) {
  if (!status) return null;
  return (
    <span
      className={cx(
        "text-[10px] px-2 py-0.5 rounded-full border",
        status === "consolidated"
          ? "text-emerald-200 border-emerald-400/30 bg-emerald-400/10"
          : status === "emerging"
            ? "text-sky-200 border-sky-400/30 bg-sky-400/10"
            : status === "local"
              ? "text-mist border-line bg-abyss/60"
              : "text-amber-200 border-amber-300/30 bg-amber-300/10",
      )}
    >
      {DISCOVERY_LABELS[status]}
    </span>
  );
}

function SupportChip({ status, k, m, h }: { status: "ok" | "insufficient"; k: number; m: number; h: number }) {
  return (
    <span
      title={`${k} contextos · ${m} builds · ${h} heróis`}
      className={cx(
        "text-[10px] px-2 py-0.5 rounded-full border",
        status === "ok"
          ? "text-emerald-200 border-emerald-400/30 bg-emerald-400/10"
          : "text-amber-200 border-amber-300/30 bg-amber-300/10",
      )}
    >
      {status === "ok" ? `Usada por ${h} herói${h === 1 ? "" : "s"}` : "Poucos dados"}
    </span>
  );
}

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-abyss/40 px-3 py-2" title={hint}>
      <p className="lbl text-[10px]">{label}</p>
      <p className="num text-base font-bold text-foam">{value}</p>
    </div>
  );
}

function AdoptionBar({ value }: { value: number | null | undefined }) {
  const v = value == null || !Number.isFinite(value) ? null : Math.max(0, Math.min(1, value));
  return (
    <div className="flex items-center gap-2 min-w-[120px] flex-1">
      <div className="h-1.5 flex-1 rounded-full bg-abyss overflow-hidden" aria-hidden="true">
        <div className="h-full rounded-full bg-gold/70" style={{ width: `${(v ?? 0) * 100}%` }} />
      </div>
      <span className="num text-[11px] text-foam w-10 text-right">{v == null ? "—" : pct(v, 0)}</span>
    </div>
  );
}

function TalentRow({ row }: { row: AggregateTalent }) {
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

function SpellRow({ row }: { row: AggregateSpell }) {
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

function ItemIcons({ items, size = 36 }: { items: AggregateItemShape[]; size?: number }) {
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

function ItemCard({ row, packageRow = false }: { row: AggregateItem; packageRow?: boolean }) {
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
            <ScopeChip scope={row.pattern_scope} />
            <DiscoveryChip status={row.discovery_status} />
          </div>
          <p className="text-[11px] text-mist">
            {row.archetype_label}
            {row.tips ? ` · ${row.tips.slice(0, 90)}${row.tips.length > 90 ? "…" : ""}` : ""}
          </p>
        </div>
        <div className="text-right max-w-[190px]">
          <p className="lbl text-[10px]">Desempenho</p>
          <p className="text-[12px] leading-tight"><DeltaValue value={row.delta_wr_pp_median} status={row.delta_status} /></p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap text-[11px] text-mist">
        <SupportChip status={row.support.status} k={row.contexts} m={row.builds} h={row.hero_coverage} />
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

function EmblemCard({ row, lane }: { row: AggregateEmblemStat; lane?: string }) {
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
        <SupportChip status={row.support.status} k={row.contexts} m={row.builds} h={row.hero_coverage} />
        <span>Aparece em {pct(row.adoption_builds, 0)} das builds</span>
        <ScopeChip scope={row.pattern_scope} />
        <DiscoveryChip status={row.discovery_status} />
      </div>
    </div>
  );
}

function SetCard({ row }: { row: AggregateSet }) {
  return (
    <div className="card p-3 bg-panel border-line space-y-2">
      <div className="flex items-center gap-2.5 flex-wrap">
        <ItemIcons items={row.items} size={32} />
        <div className="ml-auto text-right max-w-[190px]">
          <p className="lbl text-[10px]">Desempenho</p>
          <p className="text-[12px] leading-tight"><DeltaValue value={row.delta_wr_pp_median} status={row.delta_status} /></p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap text-[11px] text-mist">
        <SupportChip status={row.support.status} k={row.contexts ?? row.k_heroes} m={row.m_builds} h={row.hero_coverage ?? row.k_heroes} />
        <span>Itens principais · {row.size} ite{row.size === 1 ? "m" : "ns"}</span>
        <ScopeChip scope={row.pattern_scope} />
        <DiscoveryChip status={row.discovery_status} />
      </div>
    </div>
  );
}

function TripleCard({ row }: { row: AggregateTriple }) {
  const status = row.delta_status ?? deltaStatusOfPp(row.delta_wr_pp_max);
  return (
    <div className="card p-3 bg-panel border-line space-y-2">
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-gold/40 bg-gold/10 text-gold">
          Trio
        </span>
        <ItemIcons items={row.items} size={32} />
        <div className="ml-auto text-right max-w-[190px]">
          <p className="lbl text-[10px]">Desempenho</p>
          <p className="text-[12px] leading-tight"><DeltaValue value={row.delta_wr_pp_max} status={status} /></p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap text-[11px] text-mist">
        <SupportChip status="ok" k={row.k_heroes} m={row.m_builds} h={row.k_heroes} />
        <ScopeChip scope={row.pattern_scope} />
        <DiscoveryChip status={row.discovery_status} />
      </div>
      <p className="text-[10px] text-mist/80">Os três itens aparecem juntos na mesma build.</p>
    </div>
  );
}

function RunePageCard({ page }: { page: AggregateRunePage }) {
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
        <SupportChip status={page.support.status} k={page.contexts} m={page.builds} h={page.hero_coverage} />
        <span>Vitória mediana <b className="num text-foam">{pct(page.win_median)}</b></span>
        <span>Aparece em {pct(page.adoption, 0)} das builds</span>
        <span>· <DeltaValue value={page.delta_wr_pp_median} status={page.delta_status} /></span>
        <ScopeChip scope={page.pattern_scope} />
        <DiscoveryChip status={page.discovery_status} />
      </div>
    </div>
  );
}

function LaneControls({ lane, top, onLane, onTop }: {
  lane: string;
  top: number;
  onLane: (l: string) => void;
  onTop: (t: number) => void;
}) {
  return (
    <div className="card p-3.5 bg-panel border-line flex items-center gap-3 flex-wrap">
      <span className="lbl text-xs font-semibold text-foam">Lane (1 por carga):</span>
      <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Escolha a lane do agregado">
        {LANES.map((l) => (
          <button
            key={l}
            onClick={() => onLane(l)}
            aria-pressed={lane === l}
            className={cx(
              "px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all min-h-[40px]",
              lane === l ? "bg-gold text-abyss shadow-sm" : "bg-abyss/60 text-mist hover:text-foam border border-line",
            )}
          >
            {l}
          </button>
        ))}
      </div>
      <span className="lbl text-xs font-semibold text-foam ml-auto">Profundidade:</span>
      <div className="flex items-center gap-1.5" role="group" aria-label="Profundidade do top-N">
        {[10, 20].map((t) => (
          <button
            key={t}
            onClick={() => onTop(t)}
            aria-pressed={top === t}
            className={cx(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all min-h-[40px]",
              top === t ? "bg-gold text-abyss" : "bg-abyss/60 text-mist hover:text-foam border border-line",
            )}
          >
            top-{t}
          </button>
        ))}
      </div>
      <span className="text-[10px] text-mist font-mono">frio: 4 cat. + 3 rank + N builds · quente: 0</span>
    </div>
  );
}

export default function BuildsAggregatePanel({ rank, window }: { rank: string; window: string }) {
  const [sp, setSp] = useSearchParams();
  const laneParam = sp.get("lane");
  const lane = laneParam && (LANES as readonly string[]).includes(laneParam) ? laneParam : "";
  const top = Number(sp.get("top") ?? 10) === 20 ? 20 : 10;

  const q = useBuildsAggregate(rank, lane, window, top);

  const pickLane = (l: string) => {
    const next = new URLSearchParams(sp);
    next.set("lane", l);
    next.set("top", String(top));
    setSp(next);
    try { localStorage.setItem("radar:lane", l); } catch { /* storage privado */ }
  };
  const pickTop = (t: number) => {
    const next = new URLSearchParams(sp);
    next.set("top", String(t));
    setSp(next);
  };

  const body = q.data;
  const ctx = body?.context;
  const okPackages = body?.packages ?? [];
  const provisionalPackages = body?.packages_provisional ?? [];
  const itemGroups = ARCHETYPES.map((a) => ({
    ...a,
    rows: (body?.items ?? []).filter((row) => row.archetype === a.key),
  }));
  const otherItems = (body?.items ?? []).filter((row) => !ARCHETYPES.some((a) => a.key === row.archetype));
  const setGroups = ARCHETYPES.map((a) => ({
    ...a,
    rows: (body?.sets ?? []).filter((row) => row.archetype === a.key).slice(0, 4),
  }));
  const otherSets = (body?.sets ?? []).filter((row) => !ARCHETYPES.some((a) => a.key === row.archetype)).slice(0, 6);
  const emblemRows = body?.emblems ?? [];
  const emblemInsufficient = body?.emblems_insufficient ?? [];
  const talentGroups = (() => {
    const groups = new Map<number | null, AggregateTalent[]>();
    for (const t of body?.talents ?? []) {
      const key = t.tier ?? null;
      const rows = groups.get(key) ?? [];
      rows.push(t);
      groups.set(key, rows);
    }
    return [...groups.entries()]
      .sort((a, b) => (a[0] ?? 99) - (b[0] ?? 99))
      .map(([tier, rows]) => ({ tier, rows }));
  })();

  return (
    <section className="space-y-5">
      <CtxBar
        id="BDL"
        name="Builds — Visão do sistema"
        question="O que aparece junto nas builds e o que se repete entre heróis?"
        status="dados de ranked"
        formula="Mostra o que aparece nos dados; não garante que o item é o motivo da vitória."
        prdRef="PRD Builds Agregadas"
      />

      <LaneControls lane={lane} top={top} onLane={pickLane} onTop={pickTop} />

      {!lane && (
        <Empty
          title="Escolha uma lane para ver o agregado"
          hint="O agregado é calculado por lane, com top-10 ou top-20 heróis. Sem lane não há fan-out — e nenhum número é inventado."
        />
      )}

      {lane && q.isLoading && (
        <div className="space-y-3">
          <p className="text-xs text-mist flex items-center gap-1.5">
            <Info size={13} /> Carregando as builds dos {top} heróis mais usados. Na primeira vez pode levar alguns segundos.
          </p>
          <Loading rows={6} />
        </div>
      )}

      {lane && q.isError && (
        <ErrBox
          onRetry={() => q.refetch()}
          message={`Não foi possível carregar as builds da lane ${lane.toUpperCase()} agora. Tente de novo em instantes.`}
        />
      )}

      {lane && body && ctx && (
        <>
          {/* B0 — contexto e cobertura */}
          <div className="card p-4 bg-panel border-line space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <FreshLine stale={ctx.stale} ageMs={ctx.age_ms} />
              <span className="text-[11px] text-mist">
                {ctx.rank.toUpperCase()} · {ctx.lane.toUpperCase()} · top-{ctx.top}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Stat
                label="Heróis com dados"
                value={`${body.coverage.heroes_with_builds} / ${body.coverage.heroes_in_lane ?? "—"}`}
                hint="quantos heróis da lane têm builds disponíveis"
              />
              <Stat label="Builds" value={body.coverage.builds} hint="3 a 4 builds por herói na fonte" />
              <Stat label="Heróis no top" value={`${body.coverage.heroes_requested} / ${ctx.top}`} />
              <Stat label="Qualidade" value={body.partial ? "Parcial" : "Completa"} hint="uma falha de herói não derruba a página" />
            </div>

            <div className="flex items-center gap-2 flex-wrap text-[11px] text-mist">
              <span className="px-2 py-0.5 rounded-full border border-line bg-abyss/50">Ranked</span>
              <span className="px-2 py-0.5 rounded-full border border-line bg-abyss/50">
                {ctx.rank.toUpperCase()} · {ctx.lane.toUpperCase()} · top-{ctx.top}
              </span>
              {ctx.cache_hit && (
                <span className="px-2 py-0.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-200">
                  Carregado do cache
                </span>
              )}
              {body.coverage.positions_stale && (
                <span className="px-2 py-0.5 rounded-full border border-amber-300/30 bg-amber-300/10 text-amber-200">
                  Dados de heróis podem estar desatualizados
                </span>
              )}
              {body.coverage.catalog_errors?.equipment && (
                <span className="px-2 py-0.5 rounded-full border border-rose-300/30 bg-rose-300/10 text-rose-200">
                  Catálogo de itens indisponível
                </span>
              )}
            </div>

            <p className="text-[11px] text-mist/90">
              A janela de tempo afeta só a ordem dos heróis. As builds vêm da fonte sem recorte de tempo.
            </p>

            {body.partial && (
              <div className="rounded-xl border border-amber-300/40 bg-amber-400/5 p-3 text-[11px] text-amber-100 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle size={14} /> Alguns heróis não carregaram ({body.coverage.cells_error} de {body.coverage.heroes_requested}).
                </p>
                <p className="text-amber-100/80">
                  {body.cells.filter((c) => c.status === "error").slice(0, 4).map((c) => c.hero_name ?? `#${c.hero_id}`).join(", ")}
                  {body.coverage.cells_error > 4 ? "…" : ""} — o restante da página continua válido.
                </p>
              </div>
            )}

            <details className="rounded-xl border border-line bg-abyss/30 px-3 py-2 text-[11px] text-mist">
              <summary className="cursor-pointer select-none text-foam/90">Como isso foi calculado</summary>
              <div className="mt-2 space-y-1.5">
                <p>
                  Cada número mostra a diferença de vitória da combinação contra o normal do próprio herói.
                  A mediana evita que um herói muito popular domine o resultado.
                </p>
                <p>
                  <b className="text-foam/90">Suporte:</b> {body.coverage.contexts} contextos · {body.coverage.builds} builds ·
                  {" "}{body.coverage.heroes_with_builds} heróis. Itens catalogados: {body.coverage.items_cataloged};
                  não classificados: {body.coverage.items_unclassified}.
                </p>
                <p>
                  <b className="text-foam/90">Peso de pick:</b> {body.coverage.weighting_sensitivity_counts?.stable ?? 0} estável ·
                  {" "}{body.coverage.weighting_sensitivity_counts?.large_shift ?? 0} muda com o peso ·
                  {" "}{body.coverage.weighting_sensitivity_counts?.sign_flip ?? 0} inverte com o peso.
                  Combinações instáveis não entram nos destaques.
                </p>
                <p>{body.honesty.join(" · ")}</p>
              </div>
            </details>
          </div>

          {/* 1 — descobertas */}
          <SectionTitle
            kicker="1 · Combinações"
            title="Itens que aparecem juntos"
            subtitle="Trios e conjuntos que se repetem entre heróis. A seta mostra se a combinação vence mais ou menos que o normal do herói."
          />
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 flex-wrap text-[11px] text-mist">
              <span className="px-2 py-0.5 rounded-full border border-gold/40 bg-gold/10 text-gold">
                {body.triples_total} trio{body.triples_total === 1 ? "" : "s"}
              </span>
              <span className="px-2 py-0.5 rounded-full border border-line bg-abyss/60">
                {body.discovery_summary.packages.supported} combinação{body.discovery_summary.packages.supported === 1 ? "" : "ões"} sempre juntas
              </span>
            </div>
            {body.triples.length ? (
              <div className="grid gap-2.5 lg:grid-cols-2">
                {body.triples.map((row) => <TripleCard key={row.item_ids.join("+")} row={row} />)}
              </div>
            ) : (
              <Empty title="Nenhum trio com dados suficientes" hint="A fonte não trouxe três itens aparecendo juntos na mesma build." />
            )}
          </div>

          <div className="space-y-2">
            <p className="text-[11px] text-orange-200 flex items-center gap-1.5">
              <Package size={13} /> {okPackages.length} combinação{okPackages.length === 1 ? "" : "ões"} sempre juntas — esses itens quase nunca aparecem separados.
            </p>
            {okPackages.length ? (
              <div className="grid gap-2.5">
                {okPackages.map((row) => <ItemCard key={row.package_id} row={row} packageRow />)}
              </div>
            ) : (
              <Empty title="Nenhum conjunto sempre junto" hint="Combinações com poucos dados ficam separadas abaixo." />
            )}
            {provisionalPackages.length > 0 && (
              <div className="rounded-xl border border-amber-300/30 bg-amber-400/5 p-3 space-y-2">
                <p className="text-[11px] text-amber-200 flex items-center gap-1.5">
                  <AlertTriangle size={13} /> {provisionalPackages.length} combinação{provisionalPackages.length === 1 ? "" : "ões"} com poucos dados: apareceram juntas, mas ainda não dá para tratar como padrão.
                </p>
                <div className="grid gap-2.5">
                  {provisionalPackages.map((row) => <ItemCard key={row.package_id} row={row} packageRow />)}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-line/60 flex-wrap">
            <Layers size={15} className="text-gold" />
            <h3 className="font-bold text-sm text-foam">Combinações de itens</h3>
            <span className="text-[11px] text-mist">pares e trios que costumam aparecer juntos · botas ficam de fora</span>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {setGroups.map((group) => (
              <div key={group.key} className="card p-3.5 bg-panel border-line space-y-2.5">
                <div className="flex items-center gap-2">
                  <Layers size={15} className="text-gold" />
                  <h3 className="font-bold text-sm text-foam">{group.label}</h3>
                  <span className="ml-auto text-[10px] text-mist">
                    {body.sets_counts[group.key] ?? 0} combinação{ (body.sets_counts[group.key] ?? 0) === 1 ? "" : "ões" }
                  </span>
                </div>
                {group.rows.length ? group.rows.map((row) => <SetCard key={row.set_key} row={row} />) : (
                  <p className="text-[11px] text-mist">Sem combinações com dados suficientes.</p>
                )}
              </div>
            ))}
          </div>
          {otherSets.length > 0 && (
            <div className="card p-3.5 bg-panel border-line space-y-2.5">
              <div className="flex items-center gap-2">
                <Layers size={15} className="text-gold" />
                <h3 className="font-bold text-sm text-foam">Híbridos, utilitários e não classificados</h3>
              </div>
              {otherSets.map((row) => <SetCard key={row.set_key} row={row} />)}
            </div>
          )}
          <p className="text-[11px] text-mist">
            {body.sets_summary.total} combinaç{body.sets_summary.total === 1 ? "ão" : "ões"}: {body.sets_summary.consolidated} padrão{body.sets_summary.consolidated === 1 ? "" : "ões"} recorrente{body.sets_summary.consolidated === 1 ? "" : "s"} ·
            {" "}{body.sets_summary.emerging} joia{body.sets_summary.emerging === 1 ? "" : "s"} escondida{body.sets_summary.emerging === 1 ? "" : "s"} ·
            {" "}{body.sets_summary.local} exclusiva{body.sets_summary.local === 1 ? "" : "s"} de um herói.
          </p>

          {/* 2 — itens e arquétipos */}
          <SectionTitle
            kicker="2 · Itens e arquétipos"
            title="Itens por tipo de build"
            subtitle="Os itens que mais aparecem em cada tipo de build. Híbridos, utilitários e itens sem classificação ficam em um bloco separado."
          />
          <div className="grid gap-3 lg:grid-cols-2">
            {itemGroups.map((group) => (
              <div key={group.key} className="card p-3.5 bg-panel border-line space-y-2.5">
                <div className="flex items-center gap-2">
                  <Layers size={15} className="text-gold" />
                  <h3 className="font-bold text-sm text-foam">{group.label}</h3>
                  <span className="ml-auto text-[10px] text-mist">
                    {group.rows.length} item{group.rows.length === 1 ? "" : "s"}
                  </span>
                </div>
                {group.rows.length ? group.rows.map((row) => <ItemCard key={row.item_id} row={row} />) : (
                  <p className="text-[11px] text-mist">Sem itens com dados suficientes.</p>
                )}
              </div>
            ))}
          </div>
          {otherItems.length > 0 && (
            <div className="card p-3.5 bg-panel border-line space-y-2.5">
              <div className="flex items-center gap-2">
                <Layers size={15} className="text-gold" />
                <h3 className="font-bold text-sm text-foam">Híbridos, utilitários e não classificados</h3>
                <span className="ml-auto text-[10px] text-mist">{otherItems.length} item{otherItems.length === 1 ? "" : "s"}</span>
              </div>
              <div className="grid gap-2.5 md:grid-cols-2">
                {otherItems.map((row) => <ItemCard key={row.item_id} row={row} />)}
              </div>
            </div>
          )}
          {body.items.length === 0 && (
            <Empty title="Nenhum item com dados suficientes" hint="Os itens aparecem em poucas builds ou formam conjuntos sempre juntos." />
          )}
          {body.items_insufficient_count > 0 && (
            <p className="text-[11px] text-mist">
              {body.items_insufficient_count} item{body.items_insufficient_count === 1 ? "" : "s"} com poucos dados ficou de fora:{" "}
              {body.items_insufficient.map((i) => i.name ?? `#${i.item_id}`).join(", ")}
              {body.items_insufficient_count > body.items_insufficient.length ? "…" : ""}.
            </p>
          )}

          {/* 3 — emblemas */}
          <SectionTitle
            kicker="3 · Emblemas"
            title="Winrate por emblema na rota"
            subtitle="Winrate mediano das builds que usam cada emblema nesta rota, com suporte e aparição. A seta compara com o normal do herói. Emblema não é recomendação."
          />
          <div className="grid gap-2.5 lg:grid-cols-2">
            {emblemRows.map((row) => <EmblemCard key={row.emblem_id} row={row} lane={lane} />)}
          </div>
          {emblemRows.length === 0 && (
            <Empty title="Nenhum emblema com dados suficientes" hint="O recorte não trouxe emblemas com o suporte mínimo." />
          )}
          {emblemInsufficient.length > 0 && (
            <p className="text-[11px] text-mist">
              {emblemInsufficient.length} emblema{emblemInsufficient.length === 1 ? "" : "s"} com poucos dados ficou de fora:{" "}
              {emblemInsufficient.map((row) => row.name ?? `#${row.emblem_id}`).join(", ")}.
            </p>
          )}

          {/* 4 — runa */}
          <SectionTitle
            kicker="4 · Runas, talentos e feitiços"
            title="O que costuma acompanhar as builds desta rota"
            subtitle="Três listas separadas — páginas de runa, talentos e feitiços — cada uma com a fatia de builds e a vitória mediana. Não é recomendação: emblema, talento e feitiço são escolhas diferentes e não são somados."
          />
          <div className="space-y-2.5">
            {body.rune_pages.map((page) => <RunePageCard key={page.rune_page_key} page={page} />)}
            {body.rune_pages.length === 0 && (
              <Empty title="Sem runa com dados suficientes" hint="A fonte não trouxe emblema, talentos e feitiço suficientes neste recorte." />
            )}
          </div>
          {body.rune_pages_insufficient > 0 && (
            <p className="text-[11px] text-mist">{body.rune_pages_insufficient} página{body.rune_pages_insufficient === 1 ? "" : "s"} de runa com poucos dados ficou de fora.</p>
          )}

          <div className="card p-3.5 bg-panel border-line space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-sm text-foam flex items-center gap-1.5"><Sparkles size={14} className="text-gold" /> Talentos</h3>
              <span className="text-[10px] text-mist ml-auto">▲ vence mais que o normal do herói</span>
            </div>
            <p className="text-[11px] text-mist/90">
              Cada build usa 1 talento por tier. A porcentagem é a fatia de builds que usam aquele talento
              — por isso ela só é comparável dentro do mesmo tier.
            </p>
            {body.talents.length === 0 ? <p className="text-[11px] text-mist">Sem talento com dados suficientes.</p> : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {talentGroups.map((group) => (
                  <div key={group.tier ?? "sem_tier"} className="rounded-xl border border-line bg-abyss/30 p-2.5">
                    <p className="lbl text-[10px] mb-1">
                      {group.tier == null ? "Sem tier no catálogo" : `Tier ${group.tier}`}
                    </p>
                    {group.rows.map((row) => <TalentRow key={row.id} row={row} />)}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card p-3.5 bg-panel border-line space-y-2">
            <h3 className="font-bold text-sm text-foam flex items-center gap-1.5"><Swords size={14} className="text-gold" /> Feitiços</h3>
            {body.spells.length === 0 ? <p className="text-[11px] text-mist">Sem feitiço com dados suficientes.</p> : (
              <div className="grid gap-x-6 md:grid-cols-2">
                {body.spells.map((s: AggregateSpell) => <SpellRow key={s.name ?? "spell"} row={s} />)}
              </div>
            )}
          </div>

          <div className="card p-3.5 bg-panel2/40 border-line space-y-2">
            <p className="text-[11px] text-mist flex items-center gap-1.5">
              <Info size={13} /> Mostra o que aparece nos dados; não garante que o item é o motivo da vitória.
            </p>
            <details className="text-[11px] text-mist">
              <summary className="cursor-pointer text-foam/90">Orçamento e procedência</summary>
              <div className="mt-2 space-y-1.5">
                <p>{body.note}</p>
                <div className="grid gap-1 font-mono text-[10px]">
                  <span>requests: {JSON.stringify(body.sources.requests ?? {})}</span>
                  <span>budget: {JSON.stringify(body.sources.budget ?? {})}</span>
                  <span>cache: {JSON.stringify(body.sources.cache ?? {})}</span>
                  <span>builds_hash: {String((body.sources.builds_hash as string | undefined)?.slice(0, 16) ?? "—")}…</span>
                  <span>catalogs_hash: {String((body.sources.catalogs_hash as string | undefined)?.slice(0, 16) ?? "—")}…</span>
                </div>
              </div>
            </details>
          </div>
        </>
      )}
    </section>
  );
}
