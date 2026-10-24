import type { ReactNode } from "react";

export function SectionTitle({
  kicker,
  title,
  right,
  subtitle,
}: {
  kicker?: string;
  title: string;
  right?: ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        {kicker && <p className="lbl mb-0.5">{kicker}</p>}
        <h2 className="text-lg md:text-xl font-bold tracking-tight text-foam">{title}</h2>
        {subtitle && <p className="text-xs text-mist mt-0.5">{subtitle}</p>}
      </div>
      {right && <div className="self-center">{right}</div>}
    </div>
  );
}
