import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Minus, Search, X } from "lucide-react";
import { cx, pct, type AggregateValueSource } from "../../shared/api";
import type { CombinerPick } from "../../shared/domain/combiner";
import { evidenceLabel, valueText } from "../../shared/domain/combiner";
import { APPLY_ERROR_TEXT, type ApplyError, type PickCandidate, type SlotRef } from "../../shared/domain/buildManager";

export type PickerItem = {
  id: number;
  name: string | null;
  icon: string | null;
  archetype?: string;
  archetypeLabel?: string;
  evidence: AggregateValueSource;
  valuePp: number | null;
  valuePpEst: number | null;
  adoption: number | null;
  builds: number;
  reason?: string | null;
};

export type PickerEmblem = {
  id: number;
  name: string | null;
  icon: string | null;
  evidence: AggregateValueSource;
  adoption: number | null;
  builds: number;
};

export type PickerTalent = {
  id: number;
  name: string | null;
  tier: number | null;
  icon: string | null;
  desc?: string | null;
  evidence: AggregateValueSource;
  valuePp: number | null;
  valuePpEst: number | null;
  adoption: number | null;
  builds: number;
  reason?: string | null;
};

export type PickerSpell = {
  name: string;
  icon: string | null;
  desc?: string | null;
  evidence: AggregateValueSource;
  valuePp: number | null;
  valuePpEst: number | null;
  adoption: number | null;
  builds: number;
  reason?: string | null;
};

type Props = {
  open: SlotRef | null;
  pick: CombinerPick;
  items: readonly PickerItem[];
  emblems: readonly PickerEmblem[];
  talents: readonly PickerTalent[];
  spells: readonly PickerSpell[];
  error?: string | null;
  blocked: (candidate: PickCandidate) => ApplyError | null;
  onApply: (candidate: PickCandidate) => void;
  onRemove: () => void;
  onClose: () => void;
};

const TITLES: Record<SlotRef["kind"], string> = {
  item: "Escolher item",
  emblem: "Escolher emblema",
  talent: "Escolher talento",
  spell: "Escolher feitiço",
};

function evidenceClass(evidence: AggregateValueSource): string {
  if (evidence === "observed") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (evidence === "estimated") return "border-amber-300/30 bg-amber-300/10 text-amber-200";
  if (evidence === "descriptive") return "border-sky-400/30 bg-sky-400/10 text-sky-200";
  return "border-line bg-abyss/60 text-mist";
}

function OptionRow({
  name,
  icon,
  meta,
  evidence,
  value,
  adoption,
  builds,
  reason,
  selected,
  disabled,
  disabledReason,
  onClick,
}: {
  name: string;
  icon: string | null;
  meta?: string | null;
  evidence: AggregateValueSource;
  value: string;
  adoption: number | null;
  builds: number;
  reason?: string | null;
  selected: boolean;
  disabled: boolean;
  disabledReason: ApplyError | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      title={reason ?? undefined}
      className={cx(
        "flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors",
        selected ? "border-gold/60 bg-gold/10" : "border-line bg-abyss/40 hover:border-gold/40",
        disabled && "cursor-not-allowed opacity-45 hover:border-line",
      )}
    >
      {icon ? (
        <img src={icon} alt="" className="h-9 w-9 shrink-0 rounded-lg border border-line bg-panel2 object-cover" loading="lazy" />
      ) : (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-abyss text-[9px] font-bold text-mist">
          {name.slice(0, 2).toUpperCase()}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-xs font-semibold text-foam">{name}</span>
          {selected ? <Check size={12} className="shrink-0 text-gold" aria-label="já escolhido" /> : null}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-mist">
          {meta ? <span className="truncate">{meta}</span> : null}
          <span className={cx("rounded-full border px-1.5 py-0.5 font-bold", evidenceClass(evidence))}>
            {evidenceLabel(evidence)}
          </span>
          <span className="num">{value}</span>
          <span>· {adoption == null ? "adoção —" : `${pct(adoption, 0)} das builds`}</span>
          {builds > 0 ? <span>· {builds} build{builds === 1 ? "" : "s"}</span> : null}
        </span>
        {disabledReason ? (
          <span className="mt-0.5 block text-[10px] text-amber-200">bloqueado: {APPLY_ERROR_TEXT[disabledReason]}</span>
        ) : null}
      </span>
    </button>
  );
}

/**
 * Modal/bottom sheet de um slot. Lista o catálogo do recorte + o que apareceu
 * nas builds observadas; nada é escondido por "não recomendado". O bloqueio é
 * explicado pela mesma regra que o aplicador usa.
 */
export default function SlotPicker({
  open,
  pick,
  items,
  emblems,
  talents,
  spells,
  error,
  blocked,
  onApply,
  onRemove,
  onClose,
}: Props) {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const id = window.setTimeout(() => searchRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const q = query.trim().toLowerCase();
  const match = (name: string | null | undefined) => !q || (name ?? "").toLowerCase().includes(q);

  const filteredItems = useMemo(
    () => [...items].filter((item) => match(item.name)).sort((a, b) => {
      const av = a.valuePp ?? a.valuePpEst ?? -Infinity;
      const bv = b.valuePp ?? b.valuePpEst ?? -Infinity;
      return bv - av || (b.adoption ?? -Infinity) - (a.adoption ?? -Infinity) || (a.name ?? "").localeCompare(b.name ?? "");
    }),
    [items, q],
  );
  const filteredEmblems = useMemo(
    () => [...emblems].filter((emblem) => match(emblem.name)).sort(
      (a, b) => (b.adoption ?? -Infinity) - (a.adoption ?? -Infinity) || (a.name ?? "").localeCompare(b.name ?? ""),
    ),
    [emblems, q],
  );
  const filteredTalents = useMemo(
    () => [...talents]
      .filter((talent) => (open?.kind === "talent" && open.tier != null ? talent.tier === open.tier : true))
      .filter((talent) => match(talent.name))
      .sort((a, b) => (a.tier ?? 99) - (b.tier ?? 99) || (b.valuePp ?? b.valuePpEst ?? -Infinity) - (a.valuePp ?? a.valuePpEst ?? -Infinity)),
    [talents, q, open],
  );
  const filteredSpells = useMemo(
    () => [...spells].filter((spell) => match(spell.name)).sort(
      (a, b) => (b.valuePp ?? b.valuePpEst ?? -Infinity) - (a.valuePp ?? a.valuePpEst ?? -Infinity) || (a.name).localeCompare(b.name),
    ),
    [spells, q],
  );

  if (!open) return null;

  const kind = open.kind;
  const title = TITLES[kind];
  const filled =
    open.kind === "item"
      ? pick.itemIds[open.index] != null
      : open.kind === "emblem"
        ? pick.emblemId != null
        : open.kind === "spell"
          ? !!pick.spellName
          : pick.talentIds.some((id) => talents.find((talent) => talent.id === id)?.tier === open.tier);

  const itemCurrent = open.kind === "item" ? pick.itemIds[open.index] ?? null : null;
  const emblemCurrent = open.kind === "emblem" ? pick.emblemId : null;
  const spellCurrent = open.kind === "spell" ? (pick.spellName ?? "").trim().toLowerCase() : "";
  const talentCurrent = open.kind === "talent"
    ? pick.talentIds.find((id) => talents.find((talent) => talent.id === id)?.tier === open.tier) ?? null
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-abyss/70 p-2 sm:items-center sm:p-4" role="presentation">
      <button type="button" aria-label="Fechar seletor" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="slot-picker-title"
        className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gold/35 bg-panel2 shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="lbl text-[10px]">Composição</p>
            <h2 id="slot-picker-title" className="truncate text-sm font-bold text-foam">
              {title}
              {kind === "talent" && open.tier != null ? ` · T${open.tier}` : ""}
            </h2>
          </div>
          {filled ? (
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-line bg-abyss/60 px-2.5 text-[11px] font-semibold text-mist hover:border-rose-300/50 hover:text-rose-200"
            >
              <Minus size={13} /> Remover
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="grid min-h-[38px] min-w-[38px] place-items-center rounded-xl border border-line bg-abyss/60 text-mist hover:text-foam"
          >
            <X size={16} />
          </button>
        </div>

        <div className="border-b border-line px-3 py-2">
          <label className="relative block">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-mist" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar neste recorte…"
              className="w-full rounded-xl border border-line bg-abyss/60 py-2 pl-8 pr-2 text-xs text-foam placeholder:text-mist/60"
              aria-label="Buscar componente"
            />
          </label>
          {error ? <p className="mt-1.5 text-[11px] text-amber-200">{error}</p> : null}
        </div>

        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2.5">
          {kind === "item" && (
            <>
              {filled ? (
                <button
                  type="button"
                  onClick={onRemove}
                  className="w-full rounded-xl border border-dashed border-line px-2.5 py-2 text-left text-[11px] font-semibold text-mist hover:border-rose-300/50 hover:text-rose-200"
                >
                  Deixar este slot vazio
                </button>
              ) : null}
              {filteredItems.map((item) => {
                const candidate: PickCandidate = { kind: "item", id: item.id };
                const reason = blocked(candidate);
                return (
                  <OptionRow
                    key={item.id}
                    name={item.name ?? `Item #${item.id}`}
                    icon={item.icon}
                    meta={item.archetypeLabel}
                    evidence={item.evidence}
                    value={valueText(item.evidence, item.valuePp, item.valuePpEst)}
                    adoption={item.adoption}
                    builds={item.builds}
                    reason={item.reason}
                    selected={itemCurrent === item.id}
                    disabled={!!reason && itemCurrent !== item.id}
                    disabledReason={reason}
                    onClick={() => onApply(candidate)}
                  />
                );
              })}
              {filteredItems.length === 0 ? <p className="p-3 text-[11px] text-mist">Nenhum item com esse nome no recorte.</p> : null}
            </>
          )}

          {kind === "emblem" && (
            <>
              <button
                type="button"
                onClick={() => onApply({ kind: "emblem", id: null })}
                className={cx(
                  "w-full rounded-xl border px-2.5 py-2 text-left text-[11px] font-semibold",
                  !pick.emblemId ? "border-gold/55 bg-gold/10 text-gold" : "border-dashed border-line text-mist hover:border-gold/40",
                )}
              >
                Sem emblema (não soma no índice)
              </button>
              {filteredEmblems.map((emblem) => (
                <OptionRow
                  key={emblem.id}
                  name={emblem.name ?? `Emblema #${emblem.id}`}
                  icon={emblem.icon}
                  meta="descritivo · não soma no índice"
                  evidence={emblem.evidence}
                  value="descritivo"
                  adoption={emblem.adoption}
                  builds={emblem.builds}
                  selected={emblemCurrent === emblem.id}
                  disabled={false}
                  disabledReason={null}
                  onClick={() => onApply({ kind: "emblem", id: emblem.id })}
                />
              ))}
              {filteredEmblems.length === 0 ? <p className="p-3 text-[11px] text-mist">Nenhum emblema com esse nome no recorte.</p> : null}
            </>
          )}

          {kind === "talent" && (
            <>
              {filteredTalents.map((talent) => {
                const candidate: PickCandidate = { kind: "talent", id: talent.id, tier: talent.tier };
                const reason = blocked(candidate);
                return (
                  <OptionRow
                    key={talent.id}
                    name={talent.name ?? `Talento #${talent.id}`}
                    icon={talent.icon}
                    meta={`${talent.tier == null ? "tier —" : `T${talent.tier}`}${talent.desc ? ` · ${talent.desc}` : ""}`}
                    evidence={talent.evidence}
                    value={valueText(talent.evidence, talent.valuePp, talent.valuePpEst)}
                    adoption={talent.adoption}
                    builds={talent.builds}
                    reason={talent.reason}
                    selected={talentCurrent === talent.id}
                    disabled={!!reason && talentCurrent !== talent.id}
                    disabledReason={reason}
                    onClick={() => onApply(candidate)}
                  />
                );
              })}
              {filteredTalents.length === 0 ? <p className="p-3 text-[11px] text-mist">Nenhum talento neste tier/recorte.</p> : null}
            </>
          )}

          {kind === "spell" && (
            <>
              <button
                type="button"
                onClick={() => onApply({ kind: "spell", name: null })}
                className={cx(
                  "w-full rounded-xl border px-2.5 py-2 text-left text-[11px] font-semibold",
                  !pick.spellName ? "border-gold/55 bg-gold/10 text-gold" : "border-dashed border-line text-mist hover:border-gold/40",
                )}
              >
                Sem feitiço
              </button>
              {filteredSpells.map((spell) => (
                <OptionRow
                  key={spell.name}
                  name={spell.name}
                  icon={spell.icon}
                  meta={spell.desc}
                  evidence={spell.evidence}
                  value={valueText(spell.evidence, spell.valuePp, spell.valuePpEst)}
                  adoption={spell.adoption}
                  builds={spell.builds}
                  reason={spell.reason}
                  selected={spellCurrent === spell.name.trim().toLowerCase()}
                  disabled={false}
                  disabledReason={null}
                  onClick={() => onApply({ kind: "spell", name: spell.name })}
                />
              ))}
              {filteredSpells.length === 0 ? <p className="p-3 text-[11px] text-mist">Nenhum feitiço com esse nome no recorte.</p> : null}
            </>
          )}
        </div>

        <p className="border-t border-line px-3 py-2 text-[10px] text-mist/80">
          Evidência é do recorte. “Sem contraste” não é zero: é ausência de variação observada.
          Emblema é descritivo e não soma no índice.
        </p>
      </div>
    </div>
  );
}
