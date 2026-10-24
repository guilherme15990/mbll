import { useSearchParams } from "react-router-dom";
import { useFilters } from "../app/filters";
import HeroPicker from "../components/HeroPicker";
import { HeroDossier } from "../components/HeroDossier";
import BlindPanel from "./panels/BlindPanel";

/** CTX-BPS · rota plana (dona do dado). Corpo em BlindPanel, reutilizado pela aba blind de /heroi. */
export default function Blind() {
  const { rank, window, hero } = useFilters();
  const [sp, setSp] = useSearchParams();

  const pickHero = (id: string) => {
    sp.set("hero", id);
    setSp(sp);
  };

  return (
    <BlindPanel
      rank={rank}
      window={window}
      hero={hero}
      dossier={hero ? <HeroDossier heroId={hero} activeContextId="BPS" rank={rank} window={window} /> : undefined}
      picker={<HeroPicker hero={hero} onPick={pickHero} />}
    />
  );
}
