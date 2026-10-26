import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Boxes, HelpCircle } from "lucide-react";
import { LANES, pct, useBuilds, useHero, type Build } from "../../shared/api";
import { useFilters } from "../../app/filters";
import {
  decodeLoadout, freeCompositionItems, matchLoadout, observedEvidence,
  type Loadout,
} from "../../shared/domain/loadout";
import { signed } from "../../shared/format";
import BuildLoadout from "../../shared/ui/patterns/BuildLoadout";
import { CtxBar, Empty, ErrBox, GhostNote, Loading, SectionTitle } from "../../shared/ui";
import { PrimaryAction } from "../../shared/ui/patterns/PrimaryAction";

/**
 * Preparação (ADR-044) — a carga endereçável de `/preparar?l=`.
 *
 * Esta tela existe para responder três perguntas, nesta ordem:
 * 1. **O que estou levando?** (composição decodificada da URL)
 * 2. **De onde veio?** (fork de build observada ou composição livre)
 * 3. **O que dela é evidência?** (só quando coincide com build observada)
 *
 * Honoridade é estrutural: `observedEvidence` devolve `null` fora de match
 * exato, então esta tela não tem como exibir win rate de composição editada.
 */

type Catalog = {
  items: Map<number, { id: number; name: string | null; icon: string | null }>;
  emblems: Map<number, { id: number; name: string | null; icon: string | null }>;
  talents: Map<number, { id: number; name: string | null; tier: number | null; icon: string | null }>;
  spells: Map<string, { name: string; icon: string | null }>;
};

/** Nomes e ícones vêm do mesmo payload que a ficha já carregou (cache hit, 0 request extra). */
function buildCatalog(rows: Build[] | undefined): Catalog {
  const items: Catalog["items"] = new Map();
  const emblems: Catalog["emblems"] = new Map();
  const talents: Catalog["talents"] = new Map();
  const spells: Catalog["spells"] = new Map();

  for (const build of rows ?? []) {
    for (const item of build.items ?? []) {
      if (item.id != null && !items.has(item.id)) items.set(item.id, { id: item.id, name: item.name, icon: item.icon });
    }
    if (build.emblem?.id != null && !emblems.has(build.emblem.id)) {
      emblems.set(build.emblem.id, { id: build.emblem.id, name: build.emblem.name, icon: build.emblem.icon });
    }
    for (const talent of build.talents ?? []) {
      if (!talents.has(talent.id)) {
        talents.set(talent.id, { id: talent.id, name: talent.name, tier: talent.tier, icon: talent.icon });
      }
    }
    const spellName = build.spell?.name;
    if (spellName && !spells.has(spellName.toLowerCase())) {
      spells.set(spellName.toLowerCase(), { name: spellName, icon: build.spell?.icon ?? null });
    }
  }

  return { items, emblems, talents, spells };
}

function ContextChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel px-3 py-2 space-y-0.5">
      <p className="text-[10px] uppercase tracking-wider text-mist">{label}</p>
      <p className="text-sm font-bold text-foam leading-tight">{value}</p>
    </div>
  );
}

function EvidenceKpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel px-3 py-2.5 space-y-0.5">
      <p className="text-[11px] text-mist">{label}</p>
      <p className="num text-base font-bold text-foam leading-tight">{value}</p>
      <p className="text-[10px] text-mist/70">{hint}</p>
    </div>
  );
}

export default function Preparar() {
  const [sp] = useSearchParams();
  const { rank: shellRank, window: shellWindow } = useFilters();
  const code = sp.get("l");
  const decoded = useMemo(() => decodeLoadout(code), [code]);
  const loadout: Loadout | null = decoded.ok ? decoded.loadout : null;

  const lane = loadout?.lane ?? "";
  const laneOk = loadout != null && (LANES as readonly string[]).includes(lane);
  const heroParam = loadout ? String(loadout.heroId) : null;

  const heroQuery = useHero(heroParam, loadout?.rank ?? "all", loadout?.window ?? "7");
  const buildsQuery = useBuilds(heroParam, loadout?.rank ?? "", laneOk ? lane : "");

  const rows = buildsQuery.data?.data;
  const catalog = useMemo(() => buildCatalog(rows), [rows]);
  const match = useMemo(() => (loadout ? matchLoadout(loadout, rows) : null), [loadout, rows]);

  if (!decoded.ok) {
    return (
      <section className="space-y-4" data-testid="preparar-vazio">
        <Empty title="Nenhum loadout nesta URL" hint={decoded.error} />
        <Link
          to="/hero"
          className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-line bg-panel2 text-sm font-semibold text-mist hover:text-foam transition-colors min-h-[44px]"
        >
          <ArrowRight size={14} /> Escolher um herói
        </Link>
      </section>
    );
  }
  if (!loadout || !match) return null;

  const hero = heroQuery.data?.data;
  const heroName = hero?.name ?? `Herói #${loadout.heroId}`;
  const laneLabel = loadout.lane.toUpperCase();
  const evidence = observedEvidence(match);
  const freeItems = freeCompositionItems(loadout);
  const shellMismatch = shellRank !== loadout.rank || shellWindow !== loadout.window;

  const view = {
    items: loadout.pick.itemIds.map((id) => catalog.items.get(id) ?? { id, name: null, icon: null }),
    emblem:
      loadout.pick.emblemId == null
        ? null
        : catalog.emblems.get(loadout.pick.emblemId) ?? { id: loadout.pick.emblemId, name: null, icon: null },
    talents: loadout.pick.talentIds.map(
      (id) => catalog.talents.get(id) ?? { id, name: null, tier: null, icon: null },
    ),
    spell:
      loadout.pick.spellName == null
        ? null
        : catalog.spells.get(loadout.pick.spellName.toLowerCase()) ?? { name: loadout.pick.spellName, icon: null },
  };

  const heroHref = `/hero/${loadout.heroId}?rank=${loadout.rank}&window=${loadout.window}&lane=${loadout.lane}`;
  const flatHref = `/builds?view=hero&hero=${loadout.heroId}&rank=${loadout.rank}&window=${loadout.window}&lane=${loadout.lane}`;
  const combinerHref = `/builds?view=combiner&hero=${loadout.heroId}&rank=${loadout.rank}&window=${loadout.window}&lane=${loadout.lane}&l=${code ?? ""}`;

  return (
    <section className="space-y-4 animate-fadeIn motion-reduce:animate-none" data-testid="preparar">
      <CtxBar
        id="BDL"
        name="Preparação — carga endereçável"
        question="Qual composição o jogador leva para a partida e qual parte dela é observada?"
        status={match.status === "exact" ? "build observada" : "composição livre"}
        formula="loadout = herói + lane + elo + 6 itens + emblema + 3 talentos + feitiço; win rate só quando a composição coincide item a item com build catalogada (ADR-044)"
        prdRef="ADR-044"
      />

      <SectionTitle
        kicker="Preparação · carga na URL"
        title={heroName}
        subtitle={`${laneLabel} · ${loadout.rank.toUpperCase()} · janela ${loadout.window}d · ${loadout.provenance === "observed" ? "fork de build observada" : "composição livre"}`}
      />

      {shellMismatch ? (
        <p className="text-[11px] text-amber-300 leading-relaxed" role="status">
          O filtro global está em {shellRank.toUpperCase()} · {shellWindow}d, mas esta carga é de{" "}
          {loadout.rank.toUpperCase()} · {loadout.window}d. Nesta tela o contexto da carga manda.
        </p>
      ) : null}

      <PrimaryAction
        label="Abrir esta composição no combinador"
        to={combinerHref}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <ContextChip label="Lane" value={laneLabel} />
        <ContextChip label="Elo" value={loadout.rank.toUpperCase()} />
        <ContextChip label="Janela" value={`${loadout.window}d`} />
        <ContextChip
          label="Itens observados"
          value={`${loadout.observedItems}/${loadout.pick.itemIds.length}`}
        />
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-sm font-bold text-foam">Composição</h3>
          <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border border-line bg-panel2 text-mist">
            {loadout.provenance === "observed" ? "fork de build observada" : "composição livre"}
          </span>
        </div>

        <BuildLoadout build={view} />

        {buildsQuery.isLoading ? <Loading rows={1} /> : null}
        {buildsQuery.isError ? <ErrBox onRetry={() => buildsQuery.refetch()} /> : null}
        {!buildsQuery.isLoading && !buildsQuery.isError && rows && rows.length === 0 ? (
          <GhostNote>
            Nenhuma build catalogada neste herói + lane + elo. A composição continua endereçável, mas não há
            base para comparar.
          </GhostNote>
        ) : null}
      </div>

      {evidence ? (
        <div className="card p-4 space-y-3 border-emerald-400/30">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-foam">Evidência da build observada</span>
            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border border-emerald-400/40 bg-emerald-500/10 text-emerald-300">
              composição idêntica
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <EvidenceKpi label="Win rate" value={pct(evidence.win)} hint="da composição observada" />
            <EvidenceKpi label="Pick" value={pct(evidence.pick, 2)} hint="participação no recorte" />
            <EvidenceKpi
              label="Lift vs mais usada"
              value={evidence.liftVsMostUsed != null ? signed(evidence.liftVsMostUsed, 4) : "—"}
              hint="pontos percentuais"
            />
            <EvidenceKpi label="Referência" value={pct(evidence.referenceWin)} hint="win da build mais usada" />
          </div>

          <p className="text-[11px] text-mist leading-relaxed">
            Win e pick são da composição observada. Ela coincide com esta carga em{" "}
            {match.compared.join(", ") || "todos os campos comparáveis"}.
          </p>
        </div>
      ) : (
        <div className="card p-4 space-y-2 border-amber-400/30 bg-amber-400/[0.04]">
          <div className="flex items-center gap-2 flex-wrap">
            <HelpCircle size={15} className="text-amber-300 shrink-0" />
            <span className="text-sm font-bold text-foam">Composição não observada neste recorte</span>
          </div>
          <p className="text-xs text-mist leading-relaxed">
            Nenhum win rate é atribuído a esta combinação. O Radar só exibe estatística observada quando a
            composição coincide item a item com uma build catalogada — trocar um item não herda o resultado da
            build de origem.
          </p>
          {freeItems > 0 ? (
            <p className="text-[11px] text-mist/80">
              {freeItems} de {loadout.pick.itemIds.length} itens não vêm de observação.
            </p>
          ) : null}
          {match.status === "partial" ? (
            <p className="text-[11px] text-amber-200/90">
              A fonte não permite comparar: {match.unknown.join(", ")}. Sem esse id, a igualdade não pode ser
              afirmada.
            </p>
          ) : null}
          {match.mismatched.length > 0 ? (
            <p className="text-[11px] text-mist/80">
              Diverge das builds catalogadas em: {match.mismatched.join(", ")}.
            </p>
          ) : null}
        </div>
      )}

      <footer className="flex items-center gap-2 flex-wrap pt-1">
        <Link
          to={heroHref}
          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-line bg-panel2 text-xs font-semibold text-mist hover:text-foam transition-colors min-h-[44px]"
        >
          <ArrowRight size={13} /> Voltar à ficha
        </Link>
        <Link
          to={flatHref}
          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-line bg-panel2 text-xs font-semibold text-mist hover:text-foam transition-colors min-h-[44px]"
        >
          <Boxes size={13} /> Builds na rota plana
        </Link>
      </footer>
    </section>
  );
}
