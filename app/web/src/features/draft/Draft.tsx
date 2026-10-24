import { useSearchParams } from "react-router-dom";
import { useFilters } from "../../app/filters";
import HeroPicker from "../../shared/ui/patterns/HeroPicker";
import { HeroDossier } from "../../shared/ui/patterns/HeroDossier";
import DraftPanel from "./DraftPanel";

/** CTX-DRF · rota plana (dona do dado). Corpo em DraftPanel, reutilizado pela aba draft de /heroi. */
export default function Draft() {
  const { rank, window, hero } = useFilters();
  const [sp, setSp] = useSearchParams();

  const pickHero = (id: string) => {
    sp.set("hero", id);
    setSp(sp);
  };

  return (
    <DraftPanel
      rank={rank}
      window={window}
      hero={hero}
      dossier={hero ? <HeroDossier heroId={hero} activeContextId="DRF" rank={rank} window={window} /> : undefined}
      picker={<HeroPicker hero={hero} onPick={pickHero} />}
    />
  );
}
