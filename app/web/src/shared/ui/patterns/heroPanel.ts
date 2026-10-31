// Contrato dos painéis de contexto por herói (F4b).
//
// `HeroPanelProps` é usado pelos painéis de rotas planas (Confrontos, Builds). O
// tipo mora em `shared/` para que uma feature não dependa de outra (ADR-037).
import type { ReactNode } from "react";

export interface HeroPanelProps {
  rank: string;
  window: string;
  hero: string;
  dossier?: ReactNode;
  picker?: ReactNode;
  /** Na ficha (/hero/:id): herói em destaque no topo, sem KPIs globais. Tabela segue abaixo como prova. */
  ficha?: boolean;
}
