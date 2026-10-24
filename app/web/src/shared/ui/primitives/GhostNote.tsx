import type { ReactNode } from "react";
import { Ghost } from "lucide-react";

export function GhostNote({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs text-mist/80 italic flex items-center gap-1.5">
      <Ghost size={13} className="shrink-0 text-mist/60" />
      <span>{children}</span>
    </p>
  );
}
