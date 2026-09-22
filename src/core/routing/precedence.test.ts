import { describe, expect, it } from 'vitest';
import { cadeiaEmCadeia, troca } from './fixtures';
import { dependencias, ordemTopologica, ordemValida } from './precedence';

describe('precedência entre trocas', () => {
  it('liga a saída de uma troca à entrada da outra', () => {
    const deps = dependencias(cadeiaEmCadeia);
    expect([...deps.get('tA')!]).toEqual([]);
    expect([...deps.get('tB')!]).toEqual(['tA']);
    expect([...deps.get('tC')!]).toEqual(['tB']);
  });

  it('troca com estoque não depende de ninguém', () => {
    const comEstoque = cadeiaEmCadeia.map((t) => (t.id === 'tB' ? { ...t, hasStock: true } : t));
    expect([...dependencias(comEstoque).get('tB')!]).toEqual([]);
  });

  it('ordena produção antes do consumo mesmo com a entrada desordenada', () => {
    const { ordem, ciclo } = ordemTopologica([...cadeiaEmCadeia].reverse());
    expect(ordem.map((t) => t.id)).toEqual(['tA', 'tB', 'tC']);
    expect(ciclo).toEqual([]);
  });

  it('isola trocas em dependência circular', () => {
    const ciclico = [
      troca({ id: 'x', islandId: 'A', inputItemId: 'i1', outputItemId: 'i2' }),
      troca({ id: 'y', islandId: 'B', inputItemId: 'i2', outputItemId: 'i1' }),
    ];
    const { ordem, ciclo } = ordemTopologica(ciclico);
    expect(ordem).toEqual([]);
    expect(ciclo.map((t) => t.id).sort()).toEqual(['x', 'y']);
  });

  it('valida sequências', () => {
    const deps = dependencias(cadeiaEmCadeia);
    expect(ordemValida(cadeiaEmCadeia, deps)).toBe(true);
    expect(ordemValida([...cadeiaEmCadeia].reverse(), deps)).toBe(false);
    // dependência que está em outra viagem não invalida a sequência
    expect(ordemValida([cadeiaEmCadeia[2]!], deps)).toBe(true);
  });
});
