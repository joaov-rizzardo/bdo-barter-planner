import { describe, expect, it } from 'vitest';
import { sampleGameData } from '../data/sampleData';
import { applyPortOverrides, portosComArmazem, validarConfiguracaoDeRota } from './ports';

const ilhas = sampleGameData.islands;

describe('ajustes manuais de porto', () => {
  it('liga o armazém de um porto que não tinha', () => {
    const ajustadas = applyPortOverrides(ilhas, { i1: { hasWarehouse: true } });
    expect(portosComArmazem(ajustadas).map((i) => i.id)).toEqual(['base', 'i1']);
    // não mexe no que não foi informado
    expect(ajustadas.find((i) => i.id === 'i1')?.hasWharfManager).toBe(false);
  });

  it('mantém as ilhas intactas sem ajustes', () => {
    expect(applyPortOverrides(ilhas, {})).toEqual(ilhas);
  });
});

describe('validação da rota configurada', () => {
  it('aceita base com armazém e coordenada', () => {
    const problemas = validarConfiguracaoDeRota(
      { baseIslandId: 'base', unloadIslandIds: [], portOverrides: {}, distanceOverrides: [] },
      ilhas,
    );
    expect(problemas).toEqual([]);
  });

  it('cobra a escolha da base', () => {
    const problemas = validarConfiguracaoDeRota(
      { baseIslandId: null, unloadIslandIds: [], portOverrides: {}, distanceOverrides: [] },
      ilhas,
    );
    expect(problemas[0]?.code).toBe('base_nao_definida');
  });

  it('recusa base sem armazém e descarga sem armazém', () => {
    const problemas = validarConfiguracaoDeRota(
      { baseIslandId: 'i1', unloadIslandIds: ['i2'], portOverrides: {}, distanceOverrides: [] },
      ilhas,
    );
    expect(problemas.map((p) => p.code)).toEqual(['base_sem_armazem', 'descarga_sem_armazem']);
    expect(problemas[0]?.message).toContain('Tashu');
  });

  it('recusa porto sem posição no mapa como base', () => {
    const semCoordenada = ilhas.map((i) => (i.id === 'base' ? { ...i, x: null, y: null } : i));
    const problemas = validarConfiguracaoDeRota(
      { baseIslandId: 'base', unloadIslandIds: [], portOverrides: {}, distanceOverrides: [] },
      semCoordenada,
    );
    expect(problemas[0]?.code).toBe('base_sem_coordenada');
  });
});
