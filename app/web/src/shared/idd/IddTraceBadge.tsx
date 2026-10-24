import { Compass } from "lucide-react";
import { useIdd } from ".";

export function IddTraceBadge({ capId, step }: { capId: string; step?: string }) {
  const { inspectorEnabled } = useIdd();
  if (!inspectorEnabled) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-abyss/90 border border-gold/40 text-gold shadow-sm animate-fadeIn">
      <Compass size={11} className="text-gold" />
      <span>IDD: {capId}</span>
      {step && <span className="text-mist">({step})</span>}
    </span>
  );
}
