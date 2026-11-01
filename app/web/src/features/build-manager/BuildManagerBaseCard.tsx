import { RotateCcw } from "lucide-react";
import type { AggregateCombiner } from "../../shared/api";
import type { SlotRef } from "../../shared/domain/buildManager";
import type { CombinerPick } from "../../shared/domain/combiner";
import BuildBoard from "./BuildBoard";
import { BaseChip } from "./BuildManagerAtoms";
import type { BuildRow } from "./useBuildDerivations";
import type { PickerEmblem, PickerItem, PickerSpell, PickerTalent } from "./SlotPicker";

/**
 * "Ponto de partida" do quadro (ADR-047): escolhe a base observada, avisa base
 * obsoleta / composição de outro recorte e o estado dos pesos. O quadro é do
 * jogador — a base só entra preenchida. Extraído de `BuildManager.tsx`
 * (ADR-041: teto de 300 linhas).
 */
export default function BuildManagerBaseCard({
  rows,
  visibleBases,
  showAllBases,
  onToggleShowAllBases,
  selectedSignature,
  sameAsBase,
  onResetBase,
  onSelectBase,
  staleBase,
  contextMismatch,
  combiner,
  aggregateLoading,
  aggregateError,
  pick,
  boardItems,
  pickerEmblems,
  pickerTalents,
  pickerSpells,
  onOpenPicker,
  onRemoveSlot,
}: {
  rows: BuildRow[];
  visibleBases: BuildRow[];
  showAllBases: boolean;
  onToggleShowAllBases: () => void;
  selectedSignature: string | undefined;
  sameAsBase: boolean;
  onResetBase: () => void;
  onSelectBase: (signature: string) => void;
  staleBase: boolean;
  contextMismatch: boolean;
  combiner: AggregateCombiner | undefined;
  aggregateLoading: boolean;
  aggregateError: boolean;
  pick: CombinerPick;
  boardItems: (PickerItem & { core: boolean })[];
  pickerEmblems: PickerEmblem[];
  pickerTalents: PickerTalent[];
  pickerSpells: PickerSpell[];
  onOpenPicker: (target: SlotRef) => void;
  onRemoveSlot: (target: SlotRef) => void;
}) {
  return (
    <div className="card p-3.5 bg-panel border-line space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <p className="lbl text-[10px]">Ponto de partida</p>
          <p className="text-xs font-bold text-foam">Base observada</p>
          <p className="text-[10px] text-mist">A build do sistema entra preenchida; o quadro é seu para alterar.</p>
        </div>
        {!sameAsBase ? (
          <button
            type="button"
            onClick={onResetBase}
            className="inline-flex min-h-[32px] items-center gap-1.5 rounded-xl border border-line bg-panel2 px-2.5 text-[10px] font-semibold text-mist hover:border-gold/40 hover:text-foam"
          >
            <RotateCcw size={12} /> Voltar à base
          </button>
        ) : (
          <span className="rounded-full border border-line bg-abyss/50 px-2 py-0.5 text-[10px] text-mist">
            {rows.length} no recorte
          </span>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Escolher build observada como base">
        {visibleBases.map((row) => (
          <BaseChip
            key={`${row.signature || "build"}-${row.position}`}
            row={row}
            selected={selectedSignature === row.signature}
            onSelect={() => onSelectBase(row.signature)}
          />
        ))}
      </div>
      {rows.length > 4 ? (
        <button
          type="button"
          onClick={onToggleShowAllBases}
          className="text-left text-[10px] font-semibold text-gold hover:underline"
        >
          {showAllBases ? "mostrar menos bases" : `ver todas as ${rows.length} bases`}
        </button>
      ) : null}

      {staleBase ? (
        <p className="rounded-xl border border-amber-300/30 bg-amber-300/5 px-2.5 py-1.5 text-[10px] text-amber-100">
          A build de <code>?build=</code> não existe mais neste recorte. A primeira base assumiu o
          quadro; escolha outra acima para corrigir o endereço.
        </p>
      ) : null}
      {contextMismatch ? (
        <p className="rounded-xl border border-amber-300/30 bg-amber-300/5 px-2.5 py-1.5 text-[10px] text-amber-100">
          A composição de <code>?l=</code> é de outro herói/lane/elo/janela. Ela foi ignorada e o
          quadro voltou à base observada.
        </p>
      ) : null}
      {!combiner && aggregateLoading ? (
        <p className="text-[10px] text-mist" role="status">carregando os pesos do recorte…</p>
      ) : null}
      {!combiner && aggregateError ? (
        <p className="rounded-xl border border-amber-300/30 bg-amber-300/5 px-2.5 py-1.5 text-[10px] text-amber-100">
          Os pesos do recorte não carregaram. O quadro e o seletor continuam com o que foi observado
          nas builds; o índice fica em aberto.
        </p>
      ) : null}

      <BuildBoard
        pick={pick}
        items={boardItems}
        emblems={pickerEmblems}
        talents={pickerTalents}
        spells={pickerSpells}
        onOpen={onOpenPicker}
        onRemove={onRemoveSlot}
      />
    </div>
  );
}
