import { casarLinhas, type DadosDoCasamento, type LinhaLida, type TrocaLida } from './casamento';
import { isolarNumero, lerNumero, type ModeloDeDigito } from './digitos';
import { prepararParaOcr, recortar, type ImagemCrua } from './imagem';
import { extrairLinhasDePermuta, type Caixa, type LinhaOcr } from './layout';

/**
 * Porta para o OCR do texto (tesseract.js no Node ou no navegador). Recebe a
 * imagem já preparada (cinza, texto escuro, ampliada) e devolve as linhas com
 * a posição **nessa imagem**; o pipeline converte de volta para a print.
 */
export type LerTexto = (imagem: ImagemCrua) => Promise<LinhaOcr[]>;

export interface ResultadoDaPrint {
  /** Linhas de texto lidas, já na escala da print original. */
  texto: LinhaOcr[];
  /** Linhas da janela de permuta com as quantidades dos ícones. */
  linhas: LinhaLida[];
  /** Cada linha casada com a rota do jogo. */
  trocas: TrocaLida[];
}

/** OCR do texto da print, com as posições na escala da imagem original. */
export async function lerTextoDaPrint(imagem: ImagemCrua, lerTexto: LerTexto): Promise<LinhaOcr[]> {
  const { imagem: preparada, escala } = prepararParaOcr(imagem);
  return (await lerTexto(preparada)).map((l) => ({
    texto: l.texto,
    x0: l.x0 / escala,
    y0: l.y0 / escala,
    x1: l.x1 / escala,
    y1: l.y1 / escala,
  }));
}

/**
 * Lê uma print da janela "Informações de Permuta": OCR do texto, montagem das
 * linhas, leitura dos números dos ícones e casamento com as rotas do jogo.
 * `imagem` é a print original em RGB ou RGBA.
 */
export async function lerTrocasDaPrint(
  imagem: ImagemCrua,
  lerTexto: LerTexto,
  dados: DadosDoCasamento,
  modelos: readonly ModeloDeDigito[],
): Promise<ResultadoDaPrint> {
  const texto = await lerTextoDaPrint(imagem, lerTexto);

  const linhas: LinhaLida[] = extrairLinhasDePermuta(texto).map((linha) => {
    const quantidade = (caixa: Caixa) => {
      const recorte = recortar(imagem, caixa);
      const numero = recorte ? isolarNumero(recorte, linha.alturaDigito) : null;
      return numero ? lerNumero(numero, modelos) : null;
    };
    return {
      ...linha,
      qtdEntrada: quantidade(linha.quantidadeEntrada),
      qtdSaida: quantidade(linha.quantidadeSaida),
    };
  });

  return { texto, linhas, trocas: casarLinhas(linhas, dados) };
}
