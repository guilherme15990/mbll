// Limite de erro de renderização (F4a).
//
// Um throw no render de uma página não deve apagar o shell inteiro nem deixar
// a tela branca. O boundary isola a falha, mostra a mensagem e oferece:
// tentar de novo (re-render), recarregar a página ou voltar ao início.
//
// É um class component porque `getDerivedStateFromError`/`componentDidCatch`
// não têm equivalente em hooks.
import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Sem stack na tela; o detalhe vai para o console do operador.
    console.error("ui_error", error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-[50vh] flex items-center justify-center p-4">
        <div
          role="alert"
          data-testid="error-boundary"
          className="card w-full max-w-lg p-6 space-y-3 border-rose-400/40 bg-panel"
        >
          <h2 className="text-foam font-bold text-base">Esta tela falhou ao renderizar</h2>
          <p className="text-sm text-mist">
            O erro foi isolado: o restante do app continua funcionando. Tente de novo ou recarregue.
          </p>
          <pre className="text-[11px] font-mono text-rose-300/85 whitespace-pre-wrap break-words">
            {this.state.error.message || "erro sem mensagem"}
          </pre>
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <button
              type="button"
              onClick={this.reset}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-line text-foam hover:border-line-bright transition-colors"
            >
              Tentar de novo
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gold/15 border border-gold/40 text-gold-light hover:bg-gold/25 transition-colors"
            >
              Recarregar página
            </button>
            <a
              href="/"
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-mist hover:text-foam transition-colors"
            >
              Ir para o início
            </a>
          </div>
        </div>
      </div>
    );
  }
}
