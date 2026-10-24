import { cx } from "../../domain/present";

const CLASS_STYLE: Record<string, string> = {
  Forte: "border-gold/60 text-gold bg-gold/10",
  Fraco: "border-mist/40 text-mist bg-abyss/40",
  Joia: "border-cyan-300/60 text-cyan-200 bg-cyan-400/10 shadow-[0_0_12px_rgba(34,211,238,0.2)]",
  "Na media": "border-line text-mist bg-abyss/40",
  "Amostra pequena": "border-line text-mist/70 italic bg-abyss/40",
};

export function ClassSeal({ cls }: { cls: string | null | undefined }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cx("text-[11px] font-medium px-2 py-0.5 rounded-full border", (cls != null && CLASS_STYLE[cls]) ?? CLASS_STYLE["Na media"])}>{cls ?? "Na media"}</span>
    </span>
  );
}
