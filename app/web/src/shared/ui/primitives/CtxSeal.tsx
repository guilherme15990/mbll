import type { ReactNode } from "react";

export function CtxSeal({ children }: { children: ReactNode }) {
  return <span className="ctx-seal">{children}</span>;
}
