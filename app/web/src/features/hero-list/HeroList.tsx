import { Link, useSearchParams } from "react-router-dom";
import { num, useHeroLanes, useHeroes } from "../../shared/api";
import { useFilters } from "../../app/filters";
import HeroPicker from "../../shared/ui/patterns/HeroPicker";
import { PrimaryAction } from "../../shared/idd/cards/PrimaryAction";
import {
  Avatar, CtxBar, Empty, ErrBox, IddZone,
  Loading, SectionTitle, TierBadge,
} from "../../shared/ui";

/**
 * /hero — lista de entrada (nível entrada).
 * Busca via HeroPicker + cartões (Avatar+nome+tier+θ̂) → /hero/:id (home).
 * A tabela analítica segue em /forca (nada duplicado aqui, nada removido de lá).
 */
export default function HeroList() {
  const { rank, window, hero } = useFilters();
  const [sp, setSp] = useSearchParams();
  const heroesQuery = useHeroes(rank, window);
  const lanesQuery = useHeroLanes(rank);
  const lanesMap = (lanesQuery.data?.data ?? {}) as Record<number, string[]>;

  const pickHero = (id: string) => {
    if (!id) sp.delete("hero");
    else sp.set("hero", id);
    setSp(sp);
  };

  if (heroesQuery.isLoading) return <Loading rows={6} />;
  if (heroesQuery.isError) return <ErrBox onRetry={() => heroesQuery.refetch()} />;

  const heroes = [...(heroesQuery.data?.data ?? [])].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const fichaTo = hero
    ? `/hero/${hero}?rank=${rank}&window=${window}`
    : "/hero";

  return (
    <section className="space-y-5" aria-label="Lista de heróis">
      <CtxBar
        id="SHR"
        name="Entrada de heróis"
        question="Qual herói abrir na ficha?"
        status="provisório (entrada)"
        prdRef="Nível entrada · análise em /forca"
      />

      <SectionTitle
        kicker="Entrada"
        title="Heróis"
        subtitle="Busque e abra a ficha. A leitura analítica por faixa segue na tabela de /forca."
      />

      <PrimaryAction
        contextId="SHR"
        capId="CAP-SHR-01"
        label="Abrir a Ficha do Herói"
        to={fichaTo}
        disabledReason={!hero ? "selecione um herói abaixo para abrir a ficha" : null}
      />

      <IddZone zone="secondary" capId="CAP-SHR-01">
        <HeroPicker hero={hero || null} onPick={pickHero} />
      </IddZone>

      {!heroes.length ? (
        <Empty
          title="Nenhum herói neste recorte"
          hint="Ajuste o elo ou a janela no topo."
        />
      ) : (
        <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Cartões de heróis">
          {heroes.map((h) => (
            <li key={h.id}>
              <Link
                to={`/hero/${h.id}?rank=${rank}&window=${window}`}
                className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-panel border border-line hover:border-gold/40 transition-colors"
                aria-label={`Abrir ficha de ${h.name}`}
              >
                <Avatar src={h.head} name={h.name} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-foam truncate">{h.name}</span>
                  <span className="block text-[11px] text-mist font-mono">
                    θ̂ {num(h.wrAdj, 3)}
                    {(lanesMap[h.id] ?? []).length ? ` · ${(lanesMap[h.id] ?? []).join("/")}` : ""}
                  </span>
                </span>
                <span
                  className="text-right shrink-0"
                  title={`Índice de força ${h.strength_index ?? "—"} de 0–100: posição normalizada do θ̂ no meta (strength-index-v1). Posição, nunca probabilidade.`}
                  aria-label={typeof h.strength_index === "number" ? `Índice de força ${h.strength_index} de 100` : "Índice de força sem dado"}
                >
                  <span className="block num text-base font-bold text-gold leading-none">
                    {typeof h.strength_index === "number" ? num(h.strength_index, 1) : "—"}
                  </span>
                  <span className="block text-[9px] uppercase tracking-wider text-mist mt-0.5">índice</span>
                </span>
                <TierBadge tier={h.tier} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
