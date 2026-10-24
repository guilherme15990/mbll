export function Avatar({ src, name, size = 40 }: { src: string | null; name: string; size?: number }) {
  if (src) return <img src={src} alt={name} width={size} height={size} loading="lazy" className="rounded-xl border border-line object-cover shadow-sm" style={{ width: size, height: size }} />;
  return (
    <div className="rounded-xl border border-line bg-panel2 flex items-center justify-center font-bold text-gold shadow-sm" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {(name || "?").slice(0, 1)}
    </div>
  );
}
