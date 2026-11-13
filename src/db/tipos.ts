/** Tipos das tabelas do IndexedDB (Módulo 3). */

export type ModoCartao = 'A' | 'B';
export type EstadoCartao = 'rascunho' | 'enviando' | 'pronto' | 'erro';
export type ModeloCartao =
  | 'definicao'
  | 'definicoes_multiplas'
  | 'demonstracao_pura'
  | 'demonstracao_raciocinio';

/**
 * O estado do grupo (rascunho/finalizado) NÃO é gravado: é derivado dos cartões
 * (finalizado = todos 'pronto'), evitando inconsistência. Calculado na camada de serviços.
 */
export interface Grupo {
  id: string;
  nome: string;
  /** Caminho completo do baralho (ex.: "Mat::Geometria"). */
  baralho: string;
  criadoEm: number;
}

export interface Fonte {
  titulo: string;
  url: string;
}

export interface Cartao {
  id: string;
  grupoId: string;
  modo: ModoCartao;
  /** Só no Modo B. */
  modelo: ModeloCartao | null;
  inputBase: string;
  /** Caminhos completos das tags (ex.: "Cursos::Dados&R"). */
  tags: string[];
  estado: EstadoCartao;
  mensagemErro: string | null;
  /** Saída da IA (cartao_schema.json). */
  json: Record<string, unknown> | null;
  /** HTML renderizado (Python/Pyodide). */
  front: string | null;
  back: string | null;
  fontes: Fonte[];
  criadoEm: number;
}

/** Baralhos e tags: guardados como caminho completo, chave primária = caminho. */
export interface ItemArvore {
  caminho: string;
  criadoEm: number;
}
export type Baralho = ItemArvore;
export type Tag = ItemArvore;

export interface Arquivo {
  id: string;
  grupoId: string;
  nome: string;
  tipo: 'texto' | 'pdf' | 'imagem';
  mime: string;
  tamanho: number;
  /** Texto extraído (txt/md/pdf). null para imagem. */
  texto: string | null;
  /** Só PDF. */
  paginas: number | null;
  /** Conteúdo original (imagens são lidas daqui para Base64). */
  conteudo: Blob | null;
  criadoEm: number;
}

export interface ItemConfig {
  chave: string;
  valor: unknown;
}
