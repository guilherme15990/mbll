export function StatusSeal({ ok, good, bad }: { ok: boolean; good: string; bad: string }) {
  return ok
    ? <span className="text-[11px] px-2 py-0.5 rounded-full border text-emerald-300 border-emerald-400/30 bg-emerald-400/10">{good}</span>
    : <span className="text-[11px] px-2 py-0.5 rounded-full border text-amber-200 border-amber-300/30 bg-amber-300/10">{bad}</span>;
}
