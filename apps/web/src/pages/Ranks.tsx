import { useSearchParams } from "react-router-dom";
import { useFilters } from "../App";
import HeroPicker from "../components/HeroPicker";
import { HeroDossier } from "../components/HeroDossier";
import RanksPanel from "./panels/RanksPanel";

/** CTX-RNK · rota plana (dona do dado). Corpo em RanksPanel, reutilizado pela aba ranks de /heroi. */
export default function Ranks() {
  const { rank, window, hero } = useFilters();
  const [sp, setSp] = useSearchParams();

  const pickHero = (id: string) => {
    sp.set("hero", id);
    setSp(sp);
  };

  return (
    <RanksPanel
      rank={rank}
      window={window}
      hero={hero}
      dossier={hero ? <HeroDossier heroId={hero} activeContextId="RNK" rank={rank} window={window} /> : undefined}
      picker={<HeroPicker hero={hero} onPick={pickHero} />}
    />
  );
}
