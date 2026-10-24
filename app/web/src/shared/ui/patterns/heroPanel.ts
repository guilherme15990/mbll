// Contrato dos painéis de contexto por herói (F4b).
//
// `ForcaPanel` é o painel genérico (tabela + dossier + picker) e `HeroPanelProps`
// é usado por todos os painéis de features diferentes. O tipo mora em `shared/`
// para que `features/blind` não dependa de `features/forca`.
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
