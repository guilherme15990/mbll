import type { Build } from "../../../shared/api";
import { pct } from "../../../shared/api";
import { BUILD_TAG_CLASS, getBuildTags } from "../../../shared/domain/buildLabel";
import { cx } from "../../../shared/domain/present";

function ItemSlot({ item }: {
  item: { id?: number; name: string | null; icon: string | null } | undefined;
}) {
  const label = item?.name ?? (item?.id != null ? `Item #${item.id}` : "Item sem identificação");
  if (item?.icon) {
    return (
      <img
        src={item.icon}
        alt={label}
        title={label}
        className="h-7 w-7 rounded-md border border-line object-cover shadow-sm"
        loading="lazy"
      />
    );
  }
  return (
    <span
      title={label}
      className="grid h-7 w-7 place-items-center rounded-md border border-line bg-abyss text-[9px] font-mono text-mist"
    >
      {item?.id != null ? `#${item.id}` : "—"}
    </span>
  );
}

function NamedSlot({ icon, name, fallback }: {
  icon: string | null | undefined;
  name: string | null | undefined;
  fallback: string;
}) {
  if (!name && !icon) return null;
  return (
    <span
      title={`${fallback}: ${name ?? "não informado"}`}
      className="inline-flex max-w-[128px] items-center gap-1 rounded-md border border-line bg-panel/60 px-1.5 py-0.5 text-[9px] font-mono text-mist"
    >
      {icon ? (
        <img
          src={icon}
          alt=""
          aria-hidden="true"
          className="h-4 w-4 rounded object-cover"
          loading="lazy"
        />
      ) : null}
      <span className="truncate">{name ?? fallback}</span>
    </span>
  );
}

/**
 * Uma build dentro do card do herói: win/pick, marcas, itens na ordem da fonte
 * e feitiço/emblema. A ordem dos itens é a publicada — não é sugestão de compra.
 * Lift/referências ficam na ficha do herói, onde há espaço para o contexto.
 */
export function BuildRow({ build }: { build: Build }) {
  const tags = getBuildTags(build);
  const items = build.items ?? [];

  return (
    <article className="space-y-2 rounded-xl border border-line/80 bg-abyss/60 p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex items-baseline gap-1.5">
          <span className="lbl">win</span>
          <span className="num text-sm font-bold text-foam">{pct(build.win)}</span>
          <span className="text-[10px] font-mono text-mist">pick {pct(build.pick, 2)}</span>
        </div>
        {tags.length ? (
          <div className="flex flex-wrap items-center gap-1" role="list" aria-label="Marcas da build">
            {tags.map((t) => (
              <span
                key={t.key}
                role="listitem"
                title={t.title}
                className={cx(
                  "inline-block rounded-full border px-1.5 py-0.5 text-[10px] font-bold",
                  BUILD_TAG_CLASS[t.tone],
                )}
              >
                {t.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {items.map((item, i) => (
          <ItemSlot key={`${item.id ?? "item"}-${i}`} item={item} />
        ))}
        <NamedSlot icon={build.spell?.icon} name={build.spell?.name} fallback="Feitiço" />
        <NamedSlot icon={build.emblem?.icon} name={build.emblem?.name} fallback="Emblema" />
      </div>
    </article>
  );
}
