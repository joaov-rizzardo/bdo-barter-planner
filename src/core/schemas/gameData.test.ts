import { describe, expect, it } from 'vitest';
import { DataValidationError, parseGameData } from './gameData';
import { sampleGameData } from '../data/sampleData';

const bruto = () => JSON.parse(JSON.stringify(sampleGameData));

describe('validação dos arquivos de dados', () => {
  it('aceita a fixture de exemplo', () => {
    const data = parseGameData(bruto());
    expect(data.islands).toHaveLength(4);
    expect(data.routes).toHaveLength(4);
  });

  it('aponta o campo com problema em português', () => {
    const dados = bruto();
    dados.barterItems[0].weightLt = 'cem';
    try {
      parseGameData(dados);
      expect.unreachable('deveria ter lançado');
    } catch (erro) {
      expect(erro).toBeInstanceOf(DataValidationError);
      const e = erro as DataValidationError;
      expect(e.file).toBe('barterItems.json');
      expect(e.issues[0]).toContain('0.weightLt');
      expect(e.message).toContain('peso deve ser numérico');
    }
  });

  it('recusa rota que aponta para ilha inexistente', () => {
    const dados = bruto();
    dados.routes[0].islandId = 'nao-existe';
    expect(() => parseGameData(dados)).toThrow(/ilha desconhecida nao-existe/);
  });

  it('recusa ids duplicados', () => {
    const dados = bruto();
    dados.islands.push({ ...dados.islands[0] });
    expect(() => parseGameData(dados)).toThrow(/ilha com id duplicado/);
  });
});
