import type { ReactNode } from "react";
import { cx } from "../domain/present";
import { useIdd, IDD_ZONES } from ".";

export function IddZone({
  zone,
  capId,
  className,
  children,
  ...rest
}: {
  zone: "identity" | "state" | "data" | "primary" | "secondary" | "risk";
  capId?: string;
  className?: string;
  children: ReactNode;
  [k: string]: unknown;
}) {
  const { inspectorEnabled } = useIdd();
  const config = IDD_ZONES[zone];
  const testId = (rest["data-testid"] as string | undefined) ?? `idd-zone-${zone}`;

  if (!inspectorEnabled) {
    return (
      <div className={className} data-testid={testId}>
        {children}
      </div>
    );
  }

  return (
    <div data-testid={testId} className={cx("relative rounded-xl border transition-all duration-200", config?.colorBorder, config?.colorBg, className)}>
      <div className="absolute -top-2.5 right-2 z-10 flex items-center gap-1 pointer-events-none">
        <span className={cx("text-[9px] font-mono px-1.5 py-0.2 rounded-full border shadow-sm font-semibold", config?.colorBadge)}>
          {config?.name}
        </span>
        {capId && (
          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-abyss text-gold border border-gold/40">
            {capId}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
