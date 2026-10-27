import { ArrowRight, Check } from "lucide-react";
import { cx, pct } from "../../shared/api";
import type { CombinerPick } from "../../shared/domain/combiner";
import type { ObservedRuneCombo } from "../../shared/domain/buildManager";

type Props = {
  combos: readonly ObservedRuneCombo[];
  pick: CombinerPick;
  onApply: (combo: ObservedRuneCombo) => void;
};

function sameIds(left: readonly number[], right: readonly number[]): boolean {
  if (left.length !== right.length) return false;
  const a = [...new Set(left)].sort((x, y) => x - y);
  const b = [...new Set(right)].sort((x, y) => x - y);
  return a.every((value, index) => value === b[index]);
}

function sameRune(pick: CombinerPick, combo: ObservedRuneCombo): boolean {
  return (
    pick.emblemId === combo.emblemId &&
    sameIds(pick.talentIds, combo.talents.map((talent) => talent.id)) &&
    (pick.spellName ?? "").trim().toLowerCase() === (combo.spellName ?? "").trim().toLowerCase()
  );
}

function Mini({ icon, label, tier }: { icon: string | null; label: string; tier?: number | null }) {
  return (
    <span className="relative inline-flex shrink-0" title={label}>
      {icon ? (
        <img src={icon} alt={label} className="h-8 w-8 rounded-lg border border-line bg-panel2 object-cover" loading="lazy" />
      ) : (
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-abyss text-[9px] font-bold text-mist">
          {label.slice(0, 2).toUpperCase()}
        </span>
      )}
      {tier != null ? (
        <span className="absolute -left-1 -top-1 grid h-3.5 min-w-[15px] place-items-center rounded border border-line bg-panel px-0.5 text-[8px] font-bold text-mist">
          T{tier}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Combinações EXATAS de emblema + talentos + feitiço observadas nas builds.
 * Uma combinação com 1 build não é chamada de recorrente; é só isso: 1 build.
 */
export default function RuneCombos({ combos, pick, onApply }: Props) {
  return (
    <div className="card space-y-2.5 border-line bg-panel p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="lbl text-[10px]">Emblema + talentos</p>
          <h3 className="text-sm font-bold text-foam">Combinações prontas do recorte</h3>
          <p className="text-[10px] text-mist">
            Só o conjunto exato que apareceu junto nas builds. Emblema é descritivo; talento tem peso.
          </p>
        </div>
      </div>

      {combos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-abyss/30 px-2.5 py-2 text-[11px] text-mist">
          Nenhuma combinação exata de emblema + talentos + feitiço nas builds observadas deste recorte. Use os slots
          acima para testar uma composição sua. Não montamos uma combinação “observada” juntando peças de builds
          diferentes.
        </p>
      ) : (
        <div className="space-y-1.5">
          {combos.map((combo, index) => {
            const current = sameRune(pick, combo);
            return (
              <div
                key={combo.key}
                className={cx(
                  "rounded-xl border p-2.5 transition-colors",
                  current ? "border-gold/55 bg-gold/10" : "border-line bg-abyss/35",
                )}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="grid h-5 w-5 place-items-center rounded border border-line bg-panel text-[9px] font-bold text-mist">
                    {index + 1}
                  </span>
                  <Mini icon={combo.emblemIcon} label={combo.emblemName ?? "Sem emblema"} />
                  <div className="flex items-center gap-1">
                    {combo.talents.map((talent) => (
                      <Mini key={talent.id} icon={talent.icon} label={talent.name ?? `#${talent.id}`} tier={talent.tier} />
                    ))}
                  </div>
                  {combo.spellName ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/25 bg-sky-400/10 px-1.5 py-0.5 text-[9px] text-sky-200">
                      <Mini icon={combo.spellIcon} label={combo.spellName} />
                      {combo.spellName}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onApply(combo)}
                    aria-pressed={current}
                    className={cx(
                      "ml-auto inline-flex min-h-[36px] items-center gap-1 rounded-xl border px-2.5 text-[10px] font-bold",
                      current
                        ? "border-gold/50 bg-gold/15 text-gold"
                        : "border-line bg-panel2 text-mist hover:border-gold/40 hover:text-foam",
                    )}
                  >
                    {current ? <Check size={12} /> : <ArrowRight size={12} />}
                    {current ? "em uso" : "aplicar"}
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-mist">
                  {combo.builds === 1 ? "observada em 1 build" : `observada em ${combo.builds} builds`} ·{" "}
                  {pct(combo.share, 0)} das builds
                  {combo.talents.length < 3 ? ` · ${combo.talents.length}/3 talentos com id` : ""}
                  {combo.emblemId == null ? " · emblema sem id na fonte" : ""}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
