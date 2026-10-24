export function Loading({ rows = 6 }: { rows?: number }) {
  return (
    <div className="grid gap-2.5" aria-label="carregando">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 rounded-2xl bg-panel border border-line animate-pulse" />
      ))}
    </div>
  );
}
