import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { IddZone } from "../ui";

/**
 * IDD C4 — ExportEvidence · casa mínima de Concluir (P0-3, L2-06).
 * Operação LOCAL (clipboard + CSV do dado em cache) — sem Evento de Domínio.
 */
export function ExportEvidence({
  contextId,
  capId,
  fileName,
  deepLink,
  csvText,
  policyNote,
}: {
  contextId: string;
  capId: string;
  fileName: string;
  deepLink: string;
  csvText: string;
  policyNote?: string;
}) {
  const [copied, setCopied] = useState(false);
  const empty = !csvText || csvText.trim().length === 0;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(deepLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indisponível */
    }
  };

  const download = () => {
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <IddZone zone="secondary" capId={capId}>
      <div className="card p-3.5 bg-panel border-line flex items-center gap-2.5 flex-wrap" data-testid={`export-${contextId}`}>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-mono text-mist uppercase tracking-wider">Evidência · {capId}</p>
          {policyNote ? <p className="text-[10px] font-mono text-mist/80 truncate" title={policyNote}>{policyNote}</p> : null}
          {empty ? <p className="text-[11px] text-mist">nada para exportar neste recorte</p> : null}
        </div>
        <button
          onClick={copy}
          disabled={empty}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-abyss/60 text-mist hover:text-foam border border-line disabled:opacity-50"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "link copiado" : "Copiar link da evidência"}
        </button>
        <button
          onClick={download}
          disabled={empty}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-gold/15 text-gold border border-gold/40 hover:bg-gold/25 disabled:opacity-50"
        >
          <Download size={13} />
          Baixar CSV
        </button>
        <span role="status" className="sr-only">{copied ? "link copiado" : ""}</span>
      </div>
    </IddZone>
  );
}
