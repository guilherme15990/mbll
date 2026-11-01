import { Gauge } from "lucide-react";
import type { DraftAnalysis } from "./model";

/**
 * Força dos times como velocímetro (ADR-053 D2).
 *
 * `share = índice / (índice_nós + índice_eles)`. A agulha aponta o lado que
 * lidera a divisão do índice somado — NÃO é probabilidade: só aparece com os
 * dois índices presentes (50 = neutro, ao meio).
 */
const CX = 120;
const CY = 110;
const R = 92;

function polar(radius: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY - radius * Math.sin(rad) };
}

export default function StrengthBar({ analysis }: { analysis: DraftAnalysis }) {
  const { share } = analysis;
  const ours = share ? Math.round(share.ours) : null;
  const theirs = share ? Math.round(share.theirs) : null;
  // 0 % → agulha na ponta direita (inimigo); 100 % → ponta esquerda (meu time).
  const angle = ours == null ? 90 : ours * 1.8;
  const tip = polar(R - 18, angle);
  const tail = polar(12, angle + 180);

  return (
    <section className="card p-3.5 space-y-2" aria-label="Força dos times">
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <p className="lbl flex items-center gap-1.5">
          <Gauge size={12} className="text-gold" aria-hidden="true" /> Força dos times
        </p>
      </header>

      <div className="relative mx-auto w-full max-w-[280px]">
        <svg
          viewBox="0 0 240 122"
          className="w-full h-auto"
          role="img"
          aria-label={
            share
              ? `divisão do índice: meu time ${ours}%, inimigo ${theirs}%`
              : "divisão do índice indisponível — falta índice de um dos lados"
          }
        >
          <path
            d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX} ${CY - R}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={13}
            strokeLinecap="round"
            className={share ? "text-sky-400/70" : "text-line/40"}
          />
          <path
            d={`M ${CX} ${CY - R} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={13}
            strokeLinecap="round"
            className={share ? "text-rose-400/70" : "text-line/40"}
          />
          <line x1={CX} y1={CY - 8} x2={CX} y2={CY - R + 16} stroke="currentColor" strokeWidth={1} className="text-line" />
          {share && (
            <line
              x1={tail.x}
              y1={tail.y}
              x2={tip.x}
              y2={tip.y}
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              className="text-foam"
            />
          )}
          <circle cx={CX} cy={CY} r={6} className="fill-abyss stroke-line" strokeWidth={1.5} />
        </svg>

        {!share && (
          <p className="absolute inset-x-0 bottom-6 text-center text-[10px] font-mono text-mist/70">
            falta índice de um dos lados
          </p>
        )}
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="num text-2xl font-black leading-none text-sky-300">{ours == null ? "—" : `${ours}%`}</p>
          <p className="text-[10px] uppercase tracking-wider text-mist mt-0.5">Meu time</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="num text-2xl font-black leading-none text-rose-300">{theirs == null ? "—" : `${theirs}%`}</p>
          <p className="text-[10px] uppercase tracking-wider text-mist mt-0.5">Time inimigo</p>
        </div>
      </div>
    </section>
  );
}
