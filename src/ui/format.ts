const numero = new Intl.NumberFormat('pt-BR');
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const porcentagem = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  maximumFractionDigits: 2,
});

export const fmtInteiro = (valor: number) => numero.format(valor);
export const fmtDecimal = (valor: number) => decimal.format(valor);
export const fmtPorcentagem = (fracao: number) => porcentagem.format(fracao);
export const fmtLt = (valor: number) => `${decimal.format(valor)} LT`;

/** Normaliza para busca: sem acento, minúsculo. */
export const semAcento = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
