// Padrões operacionais de draft (PRD Draft §7) — FONTE ÚNICA.
// Unifica os DUPLICADOS `getDraftPatterns` de
// app/web/src/pages/hero/sections/DraftSection.tsx ({caso,leitura,ativo}) e
// app/web/src/pages/panels/DraftPanel.tsx (+badgeColor, leituras longas).
// Canônico = forma do painel (com `badgeColor`); casos e regras de ativação
// idênticos. Puro, sem I/O.

/** Padrões operacionais do PRD Draft §7. */
export function getDraftPatterns(d) {
  const strong = (d && d.strength_class) === "Forte" || (d && d.strength_class) === "Joia";
  const modest = !strong;
  const pickHigh = ((d && d.pick && d.pick.residual) ?? 0) > 0;
  const pickLow = ((d && d.pick && d.pick.residual) ?? 0) < 0;
  const banHigh = ((d && d.ban && d.ban.residual) ?? 0) > 0;
  // V2 §10 (MEDIUM): padrões herdam o caráter experimental de strong/isGem (q não
  // validado) — `evidence_status` viaja junto para a UI declarar "candidato".
  const evidence_status = (d && (d.inference_status ?? d.evidence_status ?? d.q_status)) ?? "unknown";

  return [
    {
      caso: "Forte e Muito Banido",
      leitura: "Pressão alinhada à performance observada; ameaça competitiva reconhecida pelo ambiente de draft.",
      ativo: strong && banHigh,
      badgeColor: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10",
      evidence_status,
    },
    {
      caso: "Overbanned (Sobrepressão de Ban)",
      leitura: "Candidato a sobrepressão de ban com força moderada. Checar presença de counters específicos e defasagem de patch.",
      ativo: modest && banHigh,
      badgeColor: "text-rose-300 border-rose-400/30 bg-rose-400/10",
      evidence_status,
    },
    {
      caso: "Hidden Gem (Força Alta, Pouco Escolhido)",
      leitura: "Candidato a joia escondida subestimada pelo draft. Exige persistência em snapshots futuros e estabilidade na grade c.",
      ativo: strong && pickLow,
      badgeColor: "text-cyan-300 border-cyan-400/30 bg-cyan-400/10",
      evidence_status,
    },
    {
      caso: "Stale Draft Pressure (Pressão Defasada)",
      leitura: "Pressão elevada mantida por inércia após queda de força pós-patch. Monitorar em snapshots posteriores.",
      ativo: false,
      badgeColor: "text-amber-300 border-amber-400/30 bg-amber-400/10",
      evidence_status,
    },
    {
      caso: "Popular Underperformer (Popular, Rendimento Mediano)",
      leitura: "Muito escolhido, mas rendimento mediano. A popularidade atrai jogadores de níveis heterogêneos; não indica fraqueza do herói.",
      ativo: modest && pickHigh,
      badgeColor: "text-purple-300 border-purple-400/30 bg-purple-400/10",
      evidence_status,
    },
  ];
}
