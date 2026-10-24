import { useSearchParams } from "react-router-dom";
import { useFilters } from "../../app/filters";
import HeroPicker from "../../shared/ui/patterns/HeroPicker";
import { HeroDossier } from "../../shared/ui/patterns/HeroDossier";
import ConfiancaPanel from "./ConfiancaPanel";

/** CTX-CNF · rota plana (dona do dado). Corpo em ConfiancaPanel, reutilizado pela aba confianca de /heroi. */
export default function Confidence() {
  const { rank, window, hero } = useFilters();
  const [sp, setSp] = useSearchParams();

  const pickHero = (id: string) => {
    sp.set("hero", id);
    setSp(sp);
  };

  return (
    <ConfiancaPanel
      rank={rank}
      window={window}
      hero={hero}
      dossier={hero ? <HeroDossier heroId={hero} activeContextId="CNF" rank={rank} window={window} /> : undefined}
      picker={<HeroPicker hero={hero} onPick={pickHero} />}
    />
  );
}
