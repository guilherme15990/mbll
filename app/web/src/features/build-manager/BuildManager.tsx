import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { cx } from "../../shared/api";
import { TOTAL_ITEM_SLOTS } from "../../shared/domain/combiner";
import { Empty, ErrBox, GhostNote, Loading, SectionTitle } from "../../shared/ui";
import HeroPicker from "../../shared/ui/patterns/HeroPicker";
import { HeroDataCard } from "../../shared/ui/patterns/HeroDataCard";
import ItemComposer from "../../shared/ui/patterns/ItemComposer";
import { NeedsLane } from "../../shared/ui/patterns/NeedsRankLane";
import { CoreCard } from "./BuildManagerAtoms";
import BuildManagerBaseCard from "./BuildManagerBaseCard";
import CandidateRail from "./CandidateRail";
import CompositionPower from "./CompositionPower";
import RuneCombos from "./RuneCombos";
import SlotPicker from "./SlotPicker";
import { useBuildManagerUrl } from "./useBuildManagerUrl";
import { useBuildManagerData } from "./useBuildManagerData";
import { useBuildDerivations } from "./useBuildDerivations";
import { usePickerCatalogs } from "./usePickerCatalogs";
import { useBuildEditor } from "./useBuildEditor";

/**
 * Build Management (ADR-047) — `/build` e `/build/:id`.
 *
 * A tela é uma superfície de DECISÃO:
 * 1. núcleo observado (descritivo, não ordem de compra);
 * 2. quadro editável de 6 itens + emblema + 3 talentos + feitiço, com o
 *    índice relativo acima das combinações exatas observadas;
 * 3. biblioteca de equipamentos (candidatos com lastro) abaixo do quadro;
 * 4. catálogo de equipamentos em modal: recomendados → categorias → feitiços.
 *
 * Honestidade estrutural:
 * - build observada, núcleo e combinações vêm de `useBuilds`;
 * - pesos e índice vêm de `useBuildsAggregate` → `scoreCombination`;
 * - qualquer peça trocada torna a composição `custom`; win/pick/lift da base
 *   não são herdados;
 * - lift da fonte é fração 0–1 e só aparece em pp via `liftPp`.
 *
 * Este arquivo é o orquestrador. Recorte da URL em `useBuildManagerUrl`, dados
 * em `useBuildManagerData`, derivações em `useBuildDerivations`, catálogos em
 * `usePickerCatalogs`, edição/escrita na URL em `useBuildEditor`; apresentação
 * em `BuildManagerAtoms`/`BuildManagerBaseCard` (ADR-041: teto de 300 linhas).
 */
export default function BuildManager() {
  const { sp, setSp, hero, rank, window, lane, heroId, heroHref } = useBuildManagerUrl();
  const { heroQuery, buildsQuery, aggregateQuery } = useBuildManagerData({ hero, rank, window, lane, sp, setSp });
  const combiner = aggregateQuery.data?.combiner;
  const builds = buildsQuery.data?.data;

  const der = useBuildDerivations({ builds, combiner, sp, setSp, heroId, lane, rank, window });
  const catalogs = usePickerCatalogs(combiner, builds, der.totalBuilds);
  const editor = useBuildEditor({ sp, setSp, pick: der.pick, selected: der.selected, combiner, heroId, lane, rank, window });

  const [showAllBases, setShowAllBases] = useState(false);
  const boardItems = useMemo(
    () => catalogs.pickerItems.map((item) => ({ ...item, core: der.coreIds.has(item.id) })),
    [catalogs.pickerItems, der.coreIds],
  );

  const heroData = heroQuery.data?.data;
  const heroName = heroData?.name ?? (hero ? `Herói #${hero}` : "—");
  const visibleBases = showAllBases ? der.rows : der.rows.slice(0, 4);

  return (
    <section className="space-y-5 animate-fadeIn motion-reduce:animate-none" data-testid="build-manager">
      {!hero ? (
        <>
          <SectionTitle
            kicker="Build Management"
            title="Escolha um herói para começar"
            subtitle="A tela recebe o herói do cabeçalho (Herói em foco) ou da URL. Sem herói, nada de build é buscado."
          />
          <Empty
            title="Nenhum herói em foco"
            hint="Selecione um herói abaixo (ou use a busca do cabeçalho). Depois escolha a lane: o núcleo, as builds e as sugestões mudam com o recorte."
          />
          <HeroPicker hero={null} onPick={editor.pickHero} />
        </>
      ) : (
        <>
          <HeroDataCard
            name={heroName}
            head={heroData?.head ?? null}
            tier={heroData?.tier ?? null}
            metrics={heroData ?? null}
            window={window}
            loading={heroQuery.isLoading && !heroData}
            titleAs="h1"
            aside={
              <Link
                to={heroHref}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-line bg-panel2 text-xs font-semibold text-mist hover:text-foam transition-colors min-h-[44px]"
              >
                Abrir ficha <ArrowRight size={13} />
              </Link>
            }
          />

          {!lane ? (
            <NeedsLane onPick={editor.pickLane} />
          ) : (
            <>
              {buildsQuery.isLoading && <Loading rows={5} />}

              {buildsQuery.isError && (
                <ErrBox
                  onRetry={() => buildsQuery.refetch()}
                  message={`Não foi possível carregar as builds de ${heroName} na lane ${lane.toUpperCase()} agora.`}
                />
              )}

              {!buildsQuery.isLoading && !buildsQuery.isError && builds != null && (
                <>
                  {builds.length === 0 ? (
                    <Empty
                      title="Nenhuma build observada neste recorte"
                      hint={`Sem volume para ${heroName} + ${lane.toUpperCase()} + ${rank.toUpperCase()}. Experimente outra lane ou outro elo.`}
                    />
                  ) : (
                    <>
                      <SectionTitle
                        title={der.stableCore ? `Núcleo de ${heroName} na ${lane.toUpperCase()}` : "Itens mais frequentes"}
                        subtitle="Itens que mais se repetem nas builds observadas. Presença é descritiva; não é ordem de compra nem prova de causa."
                      />
                      <div className="card p-3.5 bg-panel border-line space-y-2.5">
                        {der.core.length ? (
                          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {der.core.map((item) => <CoreCard key={item.id} item={item} total={der.totalBuilds} />)}
                          </div>
                        ) : (
                          <GhostNote>As builds deste recorte não trazem id de item — não há núcleo para contar.</GhostNote>
                        )}
                      </div>

                      <SectionTitle
                        title="Quadro para montar e testar"
                        subtitle="Comece pela base observada ou pelo núcleo. Clique em qualquer slot para abrir o seletor; o poder relativo muda ao vivo."
                      />

                      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
                        <BuildManagerBaseCard
                          rows={der.rows}
                          visibleBases={visibleBases}
                          showAllBases={showAllBases}
                          onToggleShowAllBases={() => setShowAllBases((value) => !value)}
                          selectedSignature={der.selected?.signature}
                          sameAsBase={der.sameAsBase}
                          onResetBase={editor.resetBase}
                          onSelectBase={editor.selectBase}
                          staleBase={der.staleBase}
                          contextMismatch={der.contextMismatch}
                          combiner={combiner}
                          aggregateLoading={aggregateQuery.isLoading}
                          aggregateError={aggregateQuery.isError}
                          pick={der.pick}
                          boardItems={boardItems}
                          pickerEmblems={catalogs.pickerEmblems}
                          pickerTalents={catalogs.pickerTalents}
                          pickerSpells={catalogs.pickerSpells}
                          onOpenPicker={editor.openPicker}
                          onRemoveSlot={editor.removeBoardSlot}
                        />

                        <div className="space-y-2.5">
                          <CompositionPower
                            score={der.score}
                            baseScore={der.baseScore}
                          />
                          <RuneCombos
                            combos={der.combos}
                            pick={der.pick}
                            onApply={editor.applyRuneCombo}
                          />
                        </div>
                      </div>

                      <SectionTitle
                        kicker="3 · Biblioteca de equipamentos"
                        title="Complete a composição"
                        subtitle="Abaixo do quadro e dos talentos: sugestões com o mesmo lastro do recorte. Clique para preencher o primeiro slot livre ou abra o catálogo para escolher outro item."
                        right={<span className={cx(
                          "text-[11px] font-bold px-2 py-0.5 rounded-full border",
                          der.full ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-line bg-abyss/50 text-mist",
                        )}>
                          {der.pick.itemIds.length}/{TOTAL_ITEM_SLOTS} itens
                        </span>}
                      />

                      <div className="card p-3.5 bg-panel border-line">
                        <CandidateRail
                          suggestions={der.suggestions}
                          coreIds={der.coreIds}
                          full={der.full}
                          error={editor.actionError}
                          onPick={editor.addSuggestion}
                          onOpenCatalog={() => editor.openPicker({ kind: "item", index: der.full ? 0 : der.pick.itemIds.length })}
                        />
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}

      <ItemComposer
        variant="modal"
        open={editor.itemTarget != null}
        onClose={editor.closeItemComposer}
        title={editor.itemTarget != null ? `Montar equipamento · slot ${editor.itemTarget + 1}` : "Montar equipamento"}
        targetIndex={editor.itemTarget ?? 0}
        items={catalogs.pickerItems}
        recommended={der.suggestions}
        value={der.pick.itemIds}
        onPick={editor.applyItemAt}
        onRemove={editor.removeItemAt}
        max={TOTAL_ITEM_SLOTS}
        blockReason={editor.itemBlockReason}
        spells={catalogs.pickerSpells}
        spell={der.pick.spellName}
        onPickSpell={editor.applySpell}
        spellBlockReason={editor.spellBlockReason}
      />

      <SlotPicker
        open={editor.pickerTarget}
        pick={der.pick}
        items={catalogs.pickerItems}
        emblems={catalogs.pickerEmblems}
        talents={catalogs.pickerTalents}
        spells={catalogs.pickerSpells}
        error={editor.pickerError}
        blocked={editor.blockedForPicker}
        onApply={editor.applyToSlot}
        onRemove={editor.removeFromSlot}
        onClose={editor.closePicker}
      />
    </section>
  );
}
