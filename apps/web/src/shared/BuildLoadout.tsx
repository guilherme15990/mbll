import type { ReactNode } from "react";
import { cx } from "../lib/api";

/** Modelo padrão de loadout: itens, emblema, talentos e feitiço em grupos separados. */
export type LoadoutItem = { id?: number; name: string | null; icon: string | null };
export type LoadoutTalent = { id?: number; name: string | null; tier: number | null; icon: string | null };
export type BuildLoadoutData = {
  items?: LoadoutItem[] | null;
  emblem?: { id?: number | null; name: string | null; icon: string | null } | null;
  talents?: LoadoutTalent[] | null;
  spell?: { name: string | null; icon: string | null } | null;
};

const ITEM_SLOTS = 6;
const TALENT_SLOTS = 3;

function Group({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("rounded-xl border border-line bg-abyss/40 px-2 py-1.5 sm:px-2.5 sm:py-2 space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-mist">{label}</span>
        {hint ? <span className="text-[10px] font-mono text-mist/60">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function ItemSlot({ item }: { item?: LoadoutItem }) {
  if (item?.icon) {
    const label = item.name ?? (item.id != null ? `Item #${item.id}` : "Item");
    return (
      <img
        src={item.icon}
        alt={label}
        title={label}
        className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg border border-line object-cover bg-panel2 shrink-0"
        loading="lazy"
      />
    );
  }
  return (
    <span
      title={item?.name ?? (item?.id != null ? `Item #${item.id}` : "Slot de item vazio")}
      className="grid h-7 w-7 sm:h-8 sm:w-8 place-items-center rounded-lg border border-dashed border-line/80 bg-panel2/30 text-[9px] num text-mist/50 shrink-0"
    >
      {item?.id != null ? `#${item.id}` : "—"}
    </span>
  );
}

function TalentSlot({ talent, index }: { talent?: LoadoutTalent; index: number }) {
  const tier = talent?.tier ?? index + 1;
  const label = talent?.name ?? `Talento ${index + 1}`;
  if (talent?.icon) {
    return (
      <div className="relative shrink-0" title={`T${tier} · ${label}`}>
        <img
          src={talent.icon}
          alt={label}
          className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg border border-line object-cover bg-panel2"
          loading="lazy"
        />
        <span className="absolute -top-1 -left-1 grid h-3 min-w-[14px] sm:h-3.5 sm:min-w-[15px] place-items-center rounded border border-line bg-panel px-0.5 text-[8px] font-bold text-mist">
          T{tier}
        </span>
      </div>
    );
  }
  return (
    <span
      title={`T${tier} · ${talent ? label : "sem talento"}`}
      className="grid h-7 w-7 sm:h-8 sm:w-8 place-items-center rounded-lg border border-dashed border-line/80 bg-panel2/30 text-[9px] font-bold text-mist/50 shrink-0"
    >
      T{tier}
    </span>
  );
}

function NamedSlot({
  icon,
  name,
  fallback,
  id,
}: {
  icon: string | null | undefined;
  name: string | null | undefined;
  fallback: string;
  id?: number | null;
}) {
  const label = name ?? (id != null ? `#${id}` : "—");
  return (
    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
      {icon ? (
        <img
          src={icon}
          alt={label === "—" ? fallback : label}
          title={label === "—" ? fallback : label}
          className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg border border-line object-cover bg-panel2 shrink-0"
          loading="lazy"
        />
      ) : (
        <span
          title={`${fallback} não informado`}
          className="grid h-7 w-7 sm:h-8 sm:w-8 place-items-center rounded-lg border border-dashed border-line/80 bg-panel2/30 text-[10px] text-mist/50 shrink-0"
        >
          —
        </span>
      )}
      <span className="text-[10px] text-mist truncate">{label}</span>
    </div>
  );
}

/**
 * Loadout padrão de build no software.
 * Itens, emblema, talentos e feitiço são grupos distintos — nunca uma única fileira.
 */
export default function BuildLoadout({
  build,
  className,
}: {
  build: BuildLoadoutData;
  className?: string;
}) {
  const items = (build.items ?? []).slice(0, ITEM_SLOTS);
  const talents = (build.talents ?? []).slice(0, TALENT_SLOTS);
  const emptyItems = Math.max(0, ITEM_SLOTS - items.length);

  return (
    <div className={cx("flex flex-wrap items-stretch gap-2", className)}>
      <Group label="Itens" hint={`${items.length}/${ITEM_SLOTS}`} className="flex-[2] min-w-[204px] sm:min-w-[248px]">
        <div className="flex items-center gap-1 sm:gap-1.5">
          {items.map((item, i) => (
            <ItemSlot key={`item-${item.id ?? i}`} item={item} />
          ))}
          {Array.from({ length: emptyItems }).map((_, i) => (
            <ItemSlot key={`empty-${i}`} />
          ))}
        </div>
      </Group>

      <Group label="Emblema" className="flex-1 min-w-[104px] sm:min-w-[112px]">
        <NamedSlot icon={build.emblem?.icon} name={build.emblem?.name} id={build.emblem?.id} fallback="Emblema" />
      </Group>

      <Group label="Talentos" hint={`${talents.length}/${TALENT_SLOTS}`} className="flex-[1.4] min-w-[132px] sm:min-w-[148px]">
        <div className="flex items-center gap-1 sm:gap-1.5">
          {Array.from({ length: TALENT_SLOTS }).map((_, i) => (
            <TalentSlot key={`talent-${i}`} talent={talents[i]} index={i} />
          ))}
        </div>
      </Group>

      <Group label="Feitiço" className="flex-1 min-w-[104px] sm:min-w-[112px]">
        <NamedSlot icon={build.spell?.icon} name={build.spell?.name} fallback="Feitiço" />
      </Group>
    </div>
  );
}
