export function AnchorNumber({
  label,
  value,
  unit,
  title,
}: {
  label: string;
  value: string;
  unit: string;
  title?: string;
}) {
  return (
    <div className="min-w-[110px]">
      <p className="text-[11px] text-mist">{label}</p>
      <p className="font-mono tabular-nums text-lg md:text-xl font-bold text-foam" title={title ?? `${label}: ${value} ${unit}`}>
        {value}
      </p>
      <p className="text-[10px] text-mist/70">{unit}</p>
    </div>
  );
}
