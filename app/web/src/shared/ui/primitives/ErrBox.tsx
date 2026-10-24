import { AlertTriangle, RotateCcw } from "lucide-react";

export function ErrBox({ onRetry, message }: { onRetry?: () => void; message?: string }) {
  return (
    <div className="card p-6 border-amber-300/40 bg-amber-400/5 text-center grid place-items-center gap-2.5">
      <span className="p-2.5 rounded-xl bg-amber-400/10 text-amber-300 border border-amber-400/30">
        <AlertTriangle size={22} />
      </span>
      <h3 className="font-bold text-sm text-foam">Falha na consulta da API</h3>
      <p className="text-xs text-mist max-w-md leading-relaxed">
        {message ?? "Não foi possível carregar os dados deste contexto. Pode ser uma indisponibilidade temporária da API comunitária Rone Arena ou parâmetros de consulta incompatíveis."}
      </p>
      {onRetry && (
        <button onClick={onRetry} className="btn-ghost mt-2 inline-flex items-center gap-1.5 text-xs">
          <RotateCcw size={14} /> Tentar novamente
        </button>
      )}
    </div>
  );
}
