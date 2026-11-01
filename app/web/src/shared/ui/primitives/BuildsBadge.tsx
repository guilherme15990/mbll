import type { ReactNode } from "react";

/**
 * Selo dourado do módulo de builds.
 *
 * Fonte única do pill "Build Management" (e de rótulos irmãos): a tela não
 * repete a classe. Só apresentação — o texto entra por `children`.
 */
export function BuildsBadge({ children = "Build Management" }: { children?: ReactNode }) {
  return (
    <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border border-gold/40 bg-gold/10 text-gold">
      {children}
    </span>
  );
}
