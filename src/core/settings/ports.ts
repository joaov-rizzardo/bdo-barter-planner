import type { Island, PortOverride, RouteSettings } from '../models/types';

/** Aplica os ajustes manuais de armazém/gerente de cais sobre os dados do jogo. */
export function applyPortOverrides(
  islands: readonly Island[],
  overrides: Readonly<Record<string, PortOverride>>,
): Island[] {
  return islands.map((ilha) => {
    const ajuste = overrides[ilha.id];
    if (!ajuste) return ilha;
    return {
      ...ilha,
      hasWarehouse: ajuste.hasWarehouse ?? ilha.hasWarehouse,
      hasWharfManager: ajuste.hasWharfManager ?? ilha.hasWharfManager,
    };
  });
}

/** Portos elegíveis como base ou ponto de descarga: precisam de armazém. */
export function portosComArmazem(islands: readonly Island[]): Island[] {
  return islands.filter((i) => i.hasWarehouse);
}

export type ProblemaDeConfiguracao =
  | { code: 'base_nao_definida'; message: string }
  | { code: 'base_desconhecida'; message: string; islandId: string }
  | { code: 'base_sem_armazem'; message: string; islandId: string }
  | { code: 'descarga_sem_armazem'; message: string; islandId: string }
  | { code: 'base_sem_coordenada'; message: string; islandId: string };

/** Valida base e portos de descarga contra os dados (já com overrides aplicados). */
export function validarConfiguracaoDeRota(
  route: RouteSettings,
  islands: readonly Island[],
): ProblemaDeConfiguracao[] {
  const porId = new Map(islands.map((i) => [i.id, i]));
  const problemas: ProblemaDeConfiguracao[] = [];

  if (!route.baseIslandId) {
    problemas.push({
      code: 'base_nao_definida',
      message: 'Escolha o porto base antes de calcular a rota.',
    });
  } else {
    const base = porId.get(route.baseIslandId);
    if (!base) {
      problemas.push({
        code: 'base_desconhecida',
        message: `O porto base (${route.baseIslandId}) não existe nos dados carregados.`,
        islandId: route.baseIslandId,
      });
    } else {
      if (!base.hasWarehouse) {
        problemas.push({
          code: 'base_sem_armazem',
          message: `${base.namePt} não tem armazém: escolha outro porto base ou marque o armazém nas Configurações.`,
          islandId: base.id,
        });
      }
      if (base.x === null || base.y === null) {
        problemas.push({
          code: 'base_sem_coordenada',
          message: `${base.namePt} não tem posição no mapa e não pode ser usado no cálculo de rota.`,
          islandId: base.id,
        });
      }
    }
  }

  for (const id of route.unloadIslandIds) {
    const porto = porId.get(id);
    if (!porto || !porto.hasWarehouse) {
      problemas.push({
        code: 'descarga_sem_armazem',
        message: `O porto de descarga ${porto?.namePt ?? id} não tem armazém.`,
        islandId: id,
      });
    }
  }

  return problemas;
}
