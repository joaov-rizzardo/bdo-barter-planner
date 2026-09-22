import type { Trade } from '../models/types';
import { MAX_TROCAS_EXATO, ordenarTrocas } from './order';
import { dependencias, ordemTopologica } from './precedence';
import { simularViagem } from './simulate';
import type { RouteSolver, RouteWarning, Trip } from './types';

export interface SolverOptions {
  /** Acima deste número de trocas por viagem, usa a heurística. */
  maxTrocasExato?: number;
  /** Quantas construções diferentes tentar antes de ficar com a melhor. */
  reinicios?: number;
  /** Teto de tempo da busca, em milissegundos. */
  orcamentoMs?: number;
}

const REINICIOS_PADRAO = 12;
const ORCAMENTO_PADRAO_MS = 5_000;
const EPS = 1e-9;

/** Gerador determinístico: o mesmo plano sempre dá o mesmo roteiro. */
function criarRng(semente: number): () => number {
  let estado = semente >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Opcao {
  trade: Trade;
  distancia: number;
}

/**
 * Estratégia padrão:
 * 1. ordena as trocas por precedência (produção antes do consumo);
 * 2. monta as viagens escolhendo sempre a troca que **menos aumenta o
 *    percurso** entre as que já podem ser feitas (o item de entrada já está a
 *    bordo ou vem de uma troca anterior), e fecha a viagem quando nada mais
 *    cabe no navio;
 * 3. melhora o resultado movendo e trocando cargas entre as viagens, sem
 *    nunca criar viagem nova;
 * 4. repete a construção com sorteios diferentes e fica com a menor distância.
 */
export function createRouteSolver(options: SolverOptions = {}): RouteSolver {
  const maxExato = options.maxTrocasExato ?? MAX_TROCAS_EXATO;
  const reinicios = Math.max(1, options.reinicios ?? REINICIOS_PADRAO);
  const orcamentoMs = options.orcamentoMs ?? ORCAMENTO_PADRAO_MS;

  return {
    name: `padrao(exato<=${maxExato}, reinicios=${reinicios})`,
    solve(trades, ctx) {
      const warnings: RouteWarning[] = [];

      if (trades.length === 0) {
        return { solver: this.name, trips: [], totalDistance: 0, warnings };
      }

      const { ordem, ciclo } = ordemTopologica(trades);
      if (ciclo.length > 0) {
        warnings.push({
          code: 'precedencia_circular',
          message:
            `Há ${ciclo.length} troca(s) em dependência circular; ` +
            'elas foram colocadas no fim do roteiro.',
          ...(ciclo[0] ? { tradeId: ciclo[0].id } : {}),
        });
      }
      const sequencia = [...ordem, ...ciclo];

      for (const trade of sequencia) {
        if (!ctx.distances.temCoordenada(trade.islandId)) {
          warnings.push({
            code: 'porto_sem_coordenada',
            message:
              'Porto sem posição no mapa: a distância desse trecho conta como zero no roteiro.',
            islandId: trade.islandId,
            tradeId: trade.id,
          });
        }
      }

      // Dependências úteis: só as do plano e fora do ciclo (essas são insolúveis).
      const noCiclo = new Set(ciclo.map((t) => t.id));
      const brutas = dependencias(sequencia);
      const deps = new Map(
        sequencia.map((t) => [
          t.id,
          new Set([...(brutas.get(t.id) ?? [])].filter((d) => !noCiclo.has(d))),
        ]),
      );

      const prazo = Date.now() + orcamentoMs;
      const noPrazo = () => Date.now() < prazo;

      /** Avalia um grupo de trocas como viagem; `null` quando não cabe no navio. */
      const cache = new Map<string, Trip | null>();
      const avaliar = (grupo: readonly Trade[]): Trip | null => {
        const chave = grupo
          .map((t) => t.id)
          .sort()
          .join('|');
        if (cache.has(chave)) return cache.get(chave) ?? null;
        const { ordem: sequenciaDaViagem } = ordenarTrocas(
          grupo,
          ctx.baseIslandId,
          ctx.distances,
          maxExato,
        );
        const simulada = simularViagem(sequenciaDaViagem, ctx, 0);
        const trip = simulada.ok ? simulada.trip : null;
        cache.set(chave, trip);
        return trip;
      };

      // Trocas que não cabem nem sozinhas: viagem própria, com aviso.
      const naoCabem = new Set<string>();
      for (const trade of sequencia) {
        if (avaliar([trade]) !== null) continue;
        naoCabem.add(trade.id);
        const forcada = simularViagem([trade], ctx, 0);
        warnings.push({
          code: 'troca_nao_cabe',
          message:
            `Uma troca sozinha já passa da capacidade do navio ` +
            `(${Math.round(forcada.trip.peakWeightLt)} LT / ${forcada.trip.peakSlots} slots): ` +
            'reduza as trocas ou aumente o navio.',
          tradeId: trade.id,
          islandId: trade.islandId,
        });
      }

      const distanciaDoGrupo = (grupo: readonly Trade[]): number => {
        if (grupo.length === 1 && naoCabem.has(grupo[0]!.id)) {
          return simularViagem(grupo, ctx, 0).trip.distance;
        }
        return avaliar(grupo)?.distance ?? Number.POSITIVE_INFINITY;
      };
      const bloqueado = (grupo: readonly Trade[]) => grupo.some((t) => naoCabem.has(t.id));

      const construir = (escolher: (opcoes: Opcao[]) => Opcao): Trade[][] => {
        const restantes = new Map(sequencia.map((t) => [t.id, t]));
        const colocados = new Set<string>();
        const grupos: Trade[][] = [];

        const consumir = (trade: Trade) => {
          restantes.delete(trade.id);
          colocados.add(trade.id);
        };

        while (restantes.size > 0) {
          const atual: Trade[] = [];

          for (;;) {
            const liberadas = [...restantes.values()].filter((t) =>
              [...(deps.get(t.id) ?? [])].every((d) => colocados.has(d) || !restantes.has(d)),
            );
            // Sem nenhuma liberada só acontece com ciclo: aí vale qualquer uma.
            const candidatas = liberadas.length > 0 ? liberadas : [...restantes.values()];

            if (atual.length === 0) {
              const cabem = candidatas.filter((t) => !naoCabem.has(t.id));
              if (cabem.length === 0) {
                // Só restaram trocas grandes demais: cada uma vira uma viagem.
                const sozinha = candidatas[0]!;
                grupos.push([sozinha]);
                consumir(sozinha);
                break;
              }
              const escolhida = escolher(
                cabem.map((trade) => ({ trade, distancia: distanciaDoGrupo([trade]) })),
              );
              atual.push(escolhida.trade);
              consumir(escolhida.trade);
              continue;
            }

            const opcoes: Opcao[] = [];
            for (const candidata of candidatas) {
              if (naoCabem.has(candidata.id)) continue;
              const viagem = avaliar([...atual, candidata]);
              if (viagem) opcoes.push({ trade: candidata, distancia: viagem.distance });
            }
            if (opcoes.length === 0) break; // nada mais cabe: fecha a viagem

            const escolhida = escolher(opcoes);
            atual.push(escolhida.trade);
            consumir(escolhida.trade);
          }

          if (atual.length > 0) grupos.push(atual);
        }

        return grupos;
      };

      /** A precedência só é válida se cada dependência vier na mesma viagem ou antes. */
      const precedenciaOk = (grupos: readonly Trade[][]): boolean => {
        const indice = new Map<string, number>();
        grupos.forEach((grupo, i) => grupo.forEach((t) => indice.set(t.id, i)));
        for (const [id, dependencia] of deps) {
          const meu = indice.get(id);
          if (meu === undefined) continue;
          for (const d of dependencia) {
            const dele = indice.get(d);
            if (dele !== undefined && dele > meu) return false;
          }
        }
        return true;
      };

      /** Move e troca cargas entre viagens enquanto a distância total cair. */
      const melhorar = (inicial: Trade[][]): Trade[][] => {
        let grupos = inicial.map((g) => [...g]);
        let distancias = grupos.map(distanciaDoGrupo);

        for (let rodada = 0; rodada < 200 && noPrazo(); rodada += 1) {
          let melhorou = false;

          for (let i = 0; i < grupos.length && !melhorou; i += 1) {
            if (bloqueado(grupos[i]!)) continue;
            for (const trade of grupos[i]!) {
              for (let j = 0; j < grupos.length; j += 1) {
                if (i === j || bloqueado(grupos[j]!)) continue;

                const semTrade = grupos[i]!.filter((t) => t.id !== trade.id);
                const comTrade = [...grupos[j]!, trade];
                const candidatos = grupos.map((g, k) =>
                  k === i ? semTrade : k === j ? comTrade : g,
                );
                if (!precedenciaOk(candidatos)) continue;

                const destino = avaliar(comTrade);
                if (!destino) continue;
                const origem = semTrade.length > 0 ? avaliar(semTrade) : null;
                if (semTrade.length > 0 && !origem) continue;

                const novo = (origem?.distance ?? 0) + destino.distance;
                if (novo >= distancias[i]! + distancias[j]! - EPS) continue;

                grupos = candidatos.filter((g) => g.length > 0);
                distancias = grupos.map(distanciaDoGrupo);
                melhorou = true;
                break;
              }
              if (melhorou) break;
            }
          }

          if (!melhorou) {
            for (let i = 0; i < grupos.length && !melhorou; i += 1) {
              if (bloqueado(grupos[i]!)) continue;
              for (let j = i + 1; j < grupos.length && !melhorou; j += 1) {
                if (bloqueado(grupos[j]!)) continue;
                for (const a of grupos[i]!) {
                  for (const b of grupos[j]!) {
                    const novoI = [...grupos[i]!.filter((t) => t.id !== a.id), b];
                    const novoJ = [...grupos[j]!.filter((t) => t.id !== b.id), a];
                    const candidatos = grupos.map((g, k) =>
                      k === i ? novoI : k === j ? novoJ : g,
                    );
                    if (!precedenciaOk(candidatos)) continue;

                    const vi = avaliar(novoI);
                    const vj = avaliar(novoJ);
                    if (!vi || !vj) continue;
                    if (vi.distance + vj.distance >= distancias[i]! + distancias[j]! - EPS)
                      continue;

                    grupos = candidatos;
                    distancias = grupos.map(distanciaDoGrupo);
                    melhorou = true;
                    break;
                  }
                  if (melhorou) break;
                }
              }
            }
          }

          if (!melhorou) break;
        }

        return grupos;
      };

      const totalDe = (grupos: readonly Trade[][]) =>
        grupos.reduce((total, g) => total + distanciaDoGrupo(g), 0);

      const maisCurta = (opcoes: Opcao[]): Opcao =>
        opcoes.reduce((melhor, o) => (o.distancia < melhor.distancia ? o : melhor));

      let melhores = melhorar(construir(maisCurta));
      let melhorTotal = totalDe(melhores);

      for (let r = 1; r < reinicios && noPrazo(); r += 1) {
        const sortear = criarRng(r * 7919 + 13);
        // Sorteio entre as três melhores candidatas: variedade sem virar bagunça.
        const escolher = (opcoes: Opcao[]): Opcao => {
          const top = [...opcoes].sort((a, b) => a.distancia - b.distancia).slice(0, 3);
          return top[Math.floor(sortear() * top.length)] ?? top[0]!;
        };
        const candidatos = melhorar(construir(escolher));
        const total = totalDe(candidatos);
        // Empate fica com o resultado anterior; menos viagens desempata.
        if (
          total < melhorTotal - EPS ||
          (total < melhorTotal + EPS && candidatos.length < melhores.length)
        ) {
          melhores = candidatos;
          melhorTotal = total;
        }
      }

      const trips: Trip[] = melhores.map((grupo, i) => {
        const viagem = avaliar(grupo);
        if (viagem) return { ...viagem, index: i };
        // Só chega aqui a troca que não cabe nem sozinha.
        return { ...simularViagem(grupo, ctx, i).trip, index: i };
      });

      return {
        solver: this.name,
        trips,
        totalDistance: trips.reduce((total, t) => total + t.distance, 0),
        warnings,
      };
    },
  };
}

export const routeSolver = createRouteSolver();
