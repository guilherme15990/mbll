import { X } from "lucide-react";
import type { CombinerPick } from "../../shared/domain/combiner";
import { TOTAL_ITEM_SLOTS } from "../../shared/domain/combiner";
import type { SlotRef } from "../../shared/domain/buildManager";
import SlotShell from "./SlotShell";

export type BoardItemMeta = { id: number; name: string | null; icon: string | null; core?: boolean };
export type BoardEmblemMeta = { id: number; name: string | null; icon: string | null };
export type BoardTalentMeta = { id: number; name: string | null; tier: number | null; icon: string | null; desc?: string | null };
export type BoardSpellMeta = { name: string; icon: string | null };

type Props = {
  pick: CombinerPick;
  items: readonly BoardItemMeta[];
  emblems: readonly BoardEmblemMeta[];
  talents: readonly BoardTalentMeta[];
  spells: readonly BoardSpellMeta[];
  onOpen: (slot: SlotRef) => void;
  onRemove?: (slot: SlotRef) => void;
};

/**
 * Quadro de composição: 6 itens + emblema + 3 talentos por tier + feitiço.
 * O quadro é só a superfície de leitura/entrada; a regra de encaixe vive no
 * domínio (`applyCandidate`).
 */
export default function BuildBoard({ pick, items, emblems, talents, spells, onOpen, onRemove }: Props) {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const emblemById = new Map(emblems.map((emblem) => [emblem.id, emblem]));
  const talentById = new Map(talents.map((talent) => [talent.id, talent]));
  const spellByName = new Map(spells.map((spell) => [spell.name.trim().toLowerCase(), spell]));

  const emblem = pick.emblemId == null ? null : emblemById.get(pick.emblemId) ?? null;
  const spellKey = (pick.spellName ?? "").trim().toLowerCase();
  const spell = spellKey ? spellByName.get(spellKey) ?? null : null;

  return (
    <div className="space-y-3" data-testid="build-board">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="lbl text-[10px]">Itens</span>
          <span className="text-[10px] text-mist">{pick.itemIds.length}/{TOTAL_ITEM_SLOTS} · clique para trocar</span>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {Array.from({ length: TOTAL_ITEM_SLOTS }).map((_, index) => {
            const id = pick.itemIds[index];
            const item = id == null ? null : itemById.get(id) ?? null;
            return (
              <div key={`item-${index}`} className="relative h-full">
                <SlotShell
                  label={`Item ${index + 1}`}
                  hint={item?.core ? "core" : undefined}
                  icon={item?.icon}
                  name={item?.name ?? (id == null ? null : `Item #${id}`)}
                  empty={id == null}
                  badge={item?.core ? "core" : null}
                  onClick={() => onOpen({ kind: "item", index })}
                  ariaLabel={
                    id == null
                      ? `Slot de item ${index + 1} vazio — escolher item`
                      : `Item ${index + 1}: ${item?.name ?? `#${id}`} — trocar`
                  }
                />
                {id != null && onRemove ? (
                  <button
                    type="button"
                    onClick={() => onRemove({ kind: "item", index })}
                    aria-label={`Remover item ${index + 1} do quadro`}
                    className="absolute -right-1.5 -top-1.5 z-10 grid h-5 w-5 place-items-center rounded-full border border-line bg-panel text-mist transition-colors hover:border-rose-300/50 hover:text-rose-200"
                  >
                    <X size={11} />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <SlotShell
          label="Emblema"
          hint="descritivo · não soma"
          icon={emblem?.icon}
          name={emblem?.name ?? (pick.emblemId != null ? `Emblema #${pick.emblemId}` : null)}
          empty={pick.emblemId == null}
          onClick={() => onOpen({ kind: "emblem" })}
          ariaLabel={
            emblem
              ? `Emblema: ${emblem.name ?? `#${emblem.id}`} — trocar. Descritivo, não soma no índice.`
              : "Slot de emblema vazio — escolher emblema"
          }
          tone="emblem"
        />

        {[1, 2, 3].map((tier) => {
          const id = pick.talentIds.find((talentId) => talentById.get(talentId)?.tier === tier) ?? null;
          const talent = id == null ? null : talentById.get(id) ?? null;
          return (
            <SlotShell
              key={`talent-${tier}`}
              label={`Talento T${tier}`}
              hint={talent ? "observado/estimado" : undefined}
              icon={talent?.icon}
              name={talent?.name ?? (id == null ? null : `Talento #${id}`)}
              empty={id == null}
              badge={`T${tier}`}
              onClick={() => onOpen({ kind: "talent", tier })}
              ariaLabel={
                id == null
                  ? `Slot de talento T${tier} vazio — escolher talento`
                  : `Talento T${tier}: ${talent?.name ?? `#${id}`} — trocar`
              }
              tone="talent"
            />
          );
        })}

        <SlotShell
          label="Feitiço"
          icon={spell?.icon}
          name={pick.spellName ?? null}
          empty={!pick.spellName}
          onClick={() => onOpen({ kind: "spell" })}
          ariaLabel={
            pick.spellName
              ? `Feitiço: ${pick.spellName} — trocar`
              : "Slot de feitiço vazio — escolher feitiço"
          }
          tone="spell"
        />
      </div>
    </div>
  );
}
