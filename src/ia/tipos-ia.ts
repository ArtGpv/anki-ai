/** Módulo 1 - Tipos compartilhados da camada de IA. */
import type { Content } from '@google/genai';
import type { ModeloCartao, ModoCartao } from '../db';

export interface ContextoArquivos {
  /** Texto extraído dos arquivos do grupo (Módulo 6). */
  texto: string;
  imagens: { mime: string; base64: string }[];
}

export interface PedidoCartao {
  modo: ModoCartao;
  /** Modo A: prompt livre. Modo B: Front escrito pelo usuário. */
  texto: string;
  /** Só leitura, só no Modo A (inferir `contexto`). No Modo B não é enviada. */
  tags: string[];
  /** Só no Modo B. */
  modelo?: ModeloCartao | null;
  /** Instrução extra ao regerar (ex.: "mais curto"). */
  instrucaoExtra?: string;
  arquivos?: ContextoArquivos | null;
}

/** O Gemini nunca recebe ferramentas (v4): só texto, arquivos/imagens e, opcionalmente, saída estruturada. */
export interface ReqGerar {
  sistema: string;
  contents: Content[];
  saidaEstruturada: boolean;
  sinal?: AbortSignal;
}

export interface RespostaIA {
  texto: string;
}

/** Abstração do Gemini: o cliente real e os testes implementam a mesma interface. */
export interface GeradorIA {
  gerar(req: ReqGerar): Promise<RespostaIA>;
}

/** Um resultado da pesquisa na web (Tavily). */
export interface ResultadoBusca {
  titulo: string;
  url: string;
  conteudo: string;
}

export interface ReqPesquisa {
  consulta: string;
  /** true = search_depth "advanced" (mais créditos); false = "basic". */
  avancado: boolean;
  sinal?: AbortSignal;
}

/** Abstração da Tavily: o cliente real e os testes implementam a mesma interface. */
export interface PesquisadorWeb {
  pesquisar(req: ReqPesquisa): Promise<ResultadoBusca[]>;
}

/** Retorno de `processar_json` (ponte.py). */
export interface ResultadoPython {
  ok: boolean;
  status: 'ok' | 'separar_cartoes' | 'entrada_insuficiente' | 'invalido';
  mensagem: string | null;
  erros: string[];
  cartao: { baralho: string; front: string; back: string; tags: string[] } | null;
  json: Record<string, unknown> | null;
}

/** Adaptador sobre o Worker do Pyodide (Fase 1): chama `processar_json` da ponte. */
export interface ProcessadorPython {
  processarJson(
    entrada: string,
    baralho: string,
    tags: string[] | null,
    delimitador?: string,
  ): Promise<ResultadoPython>;
}
