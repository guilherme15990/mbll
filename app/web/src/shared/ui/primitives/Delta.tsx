import { num } from "../../format";
import { dir, dirWord } from "../../domain/present";

export function Delta({ z }: { z: unknown }) {
  return (
    <span className="num text-xs text-mist" title={typeof z === "number" ? `d=${num(z)} (${dirWord(z)})` : "sem dado"}>
      {dir(z)} {typeof z === "number" && Number.isFinite(z) ? num(z) : ""}
    </span>
  );
}
