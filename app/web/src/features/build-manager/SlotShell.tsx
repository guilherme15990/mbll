import { Plus } from "lucide-react";
import { cx } from "../../shared/api";

type Props = {
  label: string;
  hint?: string;
  icon?: string | null;
  name?: string | null;
  empty: boolean;
  badge?: string | null;
  onClick: () => void;
  ariaLabel: string;
  tone?: "item" | "emblem" | "talent" | "spell";
};

/**
 * Célula clicável de slot (item, emblema, talento ou feitiço).
 * Só apresentação: quem chama decide o que abre e qual é o estado vazio.
 */
export default function SlotShell({
  label,
  hint,
  icon,
  name,
  empty,
  badge,
  onClick,
  ariaLabel,
  tone = "item",
}: Props) {
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
        "group relative flex h-full w-full min-h-[78px] flex-col items-center justify-center gap-1 rounded-2xl border px-1.5 py-2 text-center transition-colors",
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
