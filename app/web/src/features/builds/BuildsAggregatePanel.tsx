import { AlertTriangle, Info, Layers, Package, Sparkles, Swords } from "lucide-react";
import { useBuildsAggregate, type AggregateSpell } from "../../shared/api";
import { useFilters } from "../../app/filters";
import { Empty, ErrBox, Loading, SectionTitle } from "../../shared/ui";
import { EmblemCard, ItemCard, RunePageCard, SetCard, SpellRow, TalentRow, TripleCard } from "./aggregate/cards";
import { groupItems, groupSets, groupTalentsByTier } from "./aggregate/model";

/**
 * Builds — visão do sistema.
 *
 * O recorte NÃO vive mais na página: a rota é UMA das rotas marcadas no filtro
 * global do topo (?lanes=) e a profundidade é sempre a máxima — todos os heróis
 * com dados na rota, sem top-10/20 (ADR-056). Sem exatamente uma rota marcada,
 * a tela pede a escolha em vez de inventar um recorte.
 *
 * Sem cartão de contexto/cobertura (B0): a página abre direto nas seções. Só o
 * aviso de carga parcial permanece — uma célula em erro não pode ser escondida.
 *
 * As peças de leitura moram em `./aggregate`: `model.ts` (derivações puras),
 * `chips.tsx` (selos) e `cards.tsx` (cards). Este arquivo decide o que mostrar
 * em cada estado.
 */
export default function BuildsAggregatePanel({ rank, window }: { rank: string; window: string }) {
  const { lanes } = useFilters();
  const lane = lanes.length === 1 ? lanes[0] : "";
  const q = useBuildsAggregate(rank, lane, window, "all");

  const body = q.data;
  const okPackages = body?.packages ?? [];
  const provisionalPackages = body?.packages_provisional ?? [];
  const { groups: itemGroups, others: otherItems } = groupItems(body?.items ?? []);
  const { groups: setGroups, others: otherSets } = groupSets(body?.sets ?? []);
  const emblemRows = body?.emblems ?? [];
  const emblemInsufficient = body?.emblems_insufficient ?? [];
  const talentGroups = groupTalentsByTier(body?.talents ?? []);

  return (
    <section className="space-y-5">
      {!lane && (
        <Empty
          title="Escolha uma rota no topo"
          hint={lanes.length > 1
            ? "O agregado é por rota e há mais de uma marcada. Escolha UMA rota no filtro global (topo) para ver o sistema dela."
            : "O agregado é por rota. Marque uma rota no filtro global (topo) para ver o sistema inteiro dela — todos os heróis com dados, sem top-N."}
        />
      )}

      {lane && q.isLoading && (
        <div className="space-y-3">
          <p className="text-xs text-mist flex items-center gap-1.5">
            <Info size={13} /> Carregando as builds de todos os heróis com dados na rota. Na primeira vez pode levar alguns segundos.
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

      {lane && body && (
        <>
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

          {/* descobertas */}
          <SectionTitle
            title="Itens que aparecem juntos"
            subtitle="Trios e conjuntos que se repetem entre heróis. A seta mostra se a combinação vence mais ou menos que o normal do herói."
          />
          <div className="space-y-2.5">
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
