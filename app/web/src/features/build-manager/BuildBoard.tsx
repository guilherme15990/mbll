import { Plus } from "lucide-react";
import { cx } from "../../shared/api";
import type { CombinerPick } from "../../shared/domain/combiner";
import { TOTAL_ITEM_SLOTS } from "../../shared/domain/combiner";
import type { SlotRef } from "../../shared/domain/buildManager";

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
};

function SlotShell({
  label,
  hint,
  icon,
  name,
  empty,
  badge,
  onClick,
  ariaLabel,
  tone = "item",
}: {
  label: string;
  hint?: string;
  icon?: string | null;
  name?: string | null;
  empty: boolean;
  badge?: string | null;
  onClick: () => void;
  ariaLabel: string;
  tone?: "item" | "emblem" | "talent" | "spell";
}) {
  const toneClass =
    tone === "emblem"
      ? "border-amber-300/25 bg-amber-300/5"
      : tone === "talent"
        ? "border-emerald-400/25 bg-emerald-400/5"
        : tone === "spell"
          ? "border-sky-400/25 bg-sky-400/5"
          : "border-line bg-abyss/40";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cx(
        "group relative flex min-h-[78px] flex-col items-center justify-center gap-1 rounded-2xl border px-1.5 py-2 text-center transition-colors",
        "hover:border-gold/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40",
        empty ? "border-dashed border-line/80 bg-panel2/20" : toneClass,
      )}
    >
      {badge ? (
        <span className="absolute left-1.5 top-1.5 rounded border border-line bg-panel/90 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-mist">
          {badge}
        </span>
      ) : null}
      {!empty && icon ? (
        <img
          src={icon}
          alt=""
          className="h-9 w-9 rounded-lg border border-line bg-panel2 object-cover"
          loading="lazy"
        />
      ) : !empty && name ? (
        <span className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-panel2 text-[10px] font-bold text-mist">
          {name.slice(0, 2).toUpperCase()}
        </span>
      ) : (
        <span className="grid h-9 w-9 place-items-center rounded-lg border border-dashed border-line/70 bg-panel2/20 text-mist/60">
          <Plus size={15} aria-hidden="true" />
        </span>
      )}
      <span className={cx("w-full truncate text-[10px]", empty ? "text-mist/70" : "text-foam")}>
        {empty ? label : (name ?? label)}
      </span>
      {hint ? <span className="w-full truncate text-[9px] text-mist/70">{hint}</span> : null}
    </button>
  );
}

/**
 * Quadro de composição: 6 itens + emblema + 3 talentos por tier + feitiço.
 * O quadro é só a superfície de leitura/entrada; a regra de encaixe vive no
 * domínio (`applyCandidate`).
 */
export default function BuildBoard({ pick, items, emblems, talents, spells, onOpen }: Props) {
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
              <SlotShell
                key={`item-${index}`}
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
