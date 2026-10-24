import { useSearchParams } from "react-router-dom";
import { useFilters } from "../../app/filters";
import HeroPicker from "../../shared/HeroPicker";
import { HeroDossier } from "../../shared/HeroDossier";
import ConfrontosPanel from "./ConfrontosPanel";

/** CTX-M6 · rota plana (dona do dado). Corpo em ConfrontosPanel, reutilizado pela aba confrontos de /heroi. */
export default function Confrontos() {
  const { rank, window, hero } = useFilters();
  const [sp, setSp] = useSearchParams();

  const pickHero = (id: string) => {
    sp.set("hero", id);
    setSp(sp);
  };

  return (
    <ConfrontosPanel
      rank={rank}
      window={window}
      hero={hero}
      dossier={hero ? <HeroDossier heroId={hero} activeContextId="M6" rank={rank} window={window} /> : undefined}
      picker={<HeroPicker hero={hero} onPick={pickHero} />}
    />
  );
}
