/**
 * Cabeçalho enxuto da aba Builds: título do recorte + aviso de rota não
 * validada. Sem chips de contexto, contador de cobertura ou rodapé
 * metodológico — a decisão do usuário é deixar a tela só com builds.
 */
export function RouteBuildsHeader({ laneKey, total, routeUnvalidated }: {
  laneKey: string;
  total: number;
  routeUnvalidated: boolean;
}) {
  return (
    <header className="space-y-3 p-4">
      <div>
        <p className="lbl">Builds · composição por rota</p>
        <h3 className="mt-0.5 text-sm font-bold tracking-tight text-foam">
          Top-{total} θ̂ da rota {laneKey.toUpperCase()} com builds
        </h3>
      </div>

      {routeUnvalidated ? (
        <p
          role="note"
          className="rounded-xl border border-amber-300/30 bg-amber-400/5 px-3 py-2 text-[11px] leading-relaxed text-amber-200"
        >
          Mapa de rotas indisponível — o top-{total} abaixo não foi validado pela
          rota. Os números usam explicitamente {laneKey.toUpperCase()}.
        </p>
      ) : null}
    </header>
  );
}
