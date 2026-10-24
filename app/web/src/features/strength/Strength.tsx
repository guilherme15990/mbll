import { useFilters } from "../../app/filters";
import { HeroDossier } from "../../shared/ui/patterns/HeroDossier";
import ForcaPanel from "./ForcaPanel";

/** CTX-SHR · rota plana (dona do dado). Corpo em ForcaPanel, reutilizado pela aba forca de /heroi. */
export default function Strength() {
  const { rank, window, hero } = useFilters();
  return (
    <ForcaPanel
      rank={rank}
      window={window}
      hero={hero}
      dossier={hero ? <HeroDossier heroId={hero} activeContextId="SHR" rank={rank} window={window} /> : undefined}
    />
  );
}
