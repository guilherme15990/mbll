import { useSearchParams } from "react-router-dom";
import { useFilters } from "../app/filters";
import HeroPicker from "../components/HeroPicker";
import { HeroDossier } from "../components/HeroDossier";
import TempoPanel from "./panels/TempoPanel";

/** CTX-TMP · rota plana (dona do dado). Corpo em TempoPanel, reutilizado pela aba tempo de /heroi. */
export default function Tempo() {
  const { rank, window, hero } = useFilters();
  const [sp, setSp] = useSearchParams();

  const pickHero = (id: string) => {
    sp.set("hero", id);
    setSp(sp);
  };

  return (
    <TempoPanel
      rank={rank}
      window={window}
      hero={hero}
      dossier={hero ? <HeroDossier heroId={hero} activeContextId="TMP" rank={rank} window={window} /> : undefined}
      picker={<HeroPicker hero={hero} onPick={pickHero} />}
    />
  );
}
