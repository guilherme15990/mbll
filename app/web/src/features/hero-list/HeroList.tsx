import { Link, useSearchParams } from "react-router-dom";
import { num, useHeroLanes, useHeroes } from "../../shared/api";
import { useFilters, withLanes } from "../../app/filters";
import HeroPicker from "../../shared/ui/patterns/HeroPicker";
import { PrimaryAction } from "../../shared/ui/patterns/PrimaryAction";
import {
  Avatar, CtxBar, Empty, ErrBox,
  Loading, SectionTitle, TierBadge,
} from "../../shared/ui";

/**
 * /hero — lista de entrada (nível entrada).
 * Busca via HeroPicker + cartões (Avatar+nome+tier+θ̂) → /hero/:id (home).
 * A tabela analítica segue em /forca (nada duplicado aqui, nada removido de lá).
 */
export default function HeroList() {
  const { rank, window, hero, lanes } = useFilters();
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
  // Filtro global de rota (?lanes=, selecionado no header): join client com o
  // mapa /heroes/lanes. Mapa ainda não carregado/vazio = sem filtro (nunca
  // esconder tudo por falha de fonte).
  const lanesReady = lanesQuery.isSuccess && Object.keys(lanesMap).length > 0;
  const filtering = lanes.length > 0 && lanesReady;
  const shown = filtering
    ? heroes.filter((h) => (lanesMap[h.id] ?? []).some((l) => lanes.includes(l)))
    : heroes;
  const fichaTo = hero
    ? withLanes(`/hero/${hero}?rank=${rank}&window=${window}`, lanes)
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
        label="Abrir a Ficha do Herói"
        to={fichaTo}
        disabledReason={!hero ? "selecione um herói abaixo para abrir a ficha" : null}
      />

      <div>
        <HeroPicker hero={hero || null} onPick={pickHero} />
      </div>

      {lanes.length > 0 && !lanesReady ? (
        <p className="text-[11px] text-mist" role="note">
          {lanesQuery.isLoading
            ? `carregando mapa de rotas… (${lanes.join(" + ")})`
            : `mapa de rotas indisponível — lista sem filtro de rota (${lanes.join(" + ")})`}
        </p>
      ) : filtering ? (
        <p className="text-[11px] text-mist" role="note">
          filtro global de rota {lanes.join(" + ")} (topo) · {shown.length} de {heroes.length} heróis
        </p>
      ) : null}

      {!shown.length ? (
        <Empty
          title="Nenhum herói neste recorte"
          hint={filtering
            ? `Nenhum herói com rota ${lanes.join(" + ")} neste recorte. Ajuste o elo, a janela ou a rota no topo.`
            : "Ajuste o elo ou a janela no topo."}
        />
      ) : (
        <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Cartões de heróis">
          {shown.map((h) => (
            <li key={h.id}>
              <Link
                to={withLanes(`/hero/${h.id}?rank=${rank}&window=${window}`, lanes)}
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
