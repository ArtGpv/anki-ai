/** Funções puras para caminhos hierárquicos com o delimitador `::` (sem acesso ao banco). */
import { ErroPersistencia } from './erros';

export const SEP = '::';

/** Remove espaços em volta de cada segmento e valida. Mantém a caixa digitada. */
export function normalizarCaminho(entrada: string): string {
  const segmentos = entrada.split(SEP).map((s) => s.trim().replace(/\s+/g, ' '));
  if (segmentos.length === 0 || segmentos.some((s) => s === '' || s.includes(':'))) {
    throw new ErroPersistencia(
      'CAMINHO_INVALIDO',
      `Nome inválido: "${entrada}". Use segmentos não vazios separados por "${SEP}" e sem ":".`,
    );
  }
  return segmentos.join(SEP);
}

export const segmentos = (caminho: string): string[] => caminho.split(SEP);
export const nivel = (caminho: string): number => segmentos(caminho).length;
export const nomeFolha = (caminho: string): string => segmentos(caminho).at(-1)!;

/** "A::B::C" -> ["A", "A::B"] (sem o próprio caminho). */
export function ancestrais(caminho: string): string[] {
  const s = segmentos(caminho);
  return s.slice(0, -1).map((_, i) => s.slice(0, i + 1).join(SEP));
}

export const ehDescendente = (caminho: string, pai: string): boolean =>
  caminho.startsWith(pai + SEP);

export interface NoArvore {
  nome: string;
  caminho: string;
  nivel: number;
  filhos: NoArvore[];
}

const ordenar = (a: NoArvore, b: NoArvore) => a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' });

/** Monta a árvore para a interface; ancestrais ausentes entram como nós. */
export function construirArvore(caminhos: string[]): NoArvore[] {
  const nos = new Map<string, NoArvore>();
  const raizes: NoArvore[] = [];
  for (const caminho of [...caminhos].sort()) {
    for (const c of [...ancestrais(caminho), caminho]) {
      if (nos.has(c)) continue;
      const no: NoArvore = { nome: nomeFolha(c), caminho: c, nivel: nivel(c), filhos: [] };
      nos.set(c, no);
      const pai = nos.get(ancestrais(c).at(-1) ?? '');
      (pai ? pai.filhos : raizes).push(no);
    }
  }
  const ordenarTudo = (lista: NoArvore[]) => {
    lista.sort(ordenar);
    lista.forEach((n) => ordenarTudo(n.filhos));
  };
  ordenarTudo(raizes);
  return raizes;
}
