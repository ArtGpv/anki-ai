/** Módulo 1 - Constantes e leitura das configurações da IA (guardadas em db.config). */
import { obterConfig } from '../db';

/**
 * Valor inicial do campo "Modelo de IA" (editável nas Configurações). Use sempre o CÓDIGO do modelo
 * (minúsculas, com hífens), nunca o nome de exibição. Confirme no AI Studio quais estão gratuitos.
 */
export const MODELO_PADRAO = 'gemini-3.5-flash-lite';

/** Opções da caixa seletora das Configurações; além delas, o usuário pode digitar outro código. */
export const MODELOS_SUGERIDOS = ['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.8-flash'] as const;

export const TIMEOUT_MS = 60_000;
/** v4: a Tavily tem timeout próprio, separado dos 60 s do Gemini. */
export const TIMEOUT_TAVILY_MS = 30_000;
/** Gerações por cartão: 1 + 2 regenerações (seção 8, passo 7). Com pesquisa, soma-se 1 chamada de consulta (total 4 ao Gemini). */
export const MAX_TENTATIVAS = 3;
export const PAUSA_PADRAO_S = 5;
/** Os limites do plano gratuito não são publicados; valor conservador, editável. */
export const LIMITE_DIA_PADRAO = 200;
/** Pesquisa na web (Tavily): desligada por padrão; exige a chave da Tavily. */
export const BUSCA_WEB_PADRAO = false;

export const TAVILY_URL = 'https://api.tavily.com/search';
/** Resultados por busca (valor padrão da Tavily; fixo no código, ponto de atenção 2). */
export const MAX_RESULTADOS_TAVILY = 5;
/** Limite de caracteres do conteúdo de cada resultado enviado ao Gemini (controla tokens). */
export const MAX_CHARS_RESULTADO = 3000;
/** Custo em créditos por busca (docs da Tavily, conferido em nov/2026): básica 1, avançada 2. */
export const CREDITOS_TAVILY_BASICO = 1;
export const CREDITOS_TAVILY_AVANCADO = 2;
/** Plano gratuito (Researcher): 1.000 créditos por mês, renovados no dia 1. Editável nas Configurações. */
export const LIMITE_MES_TAVILY_PADRAO = 1000;

export const CHAVES = {
  modelo: 'modeloIA',
  pausa: 'pausaSegundos',
  limiteDia: 'limiteDiarioRequisicoes',
  contador: 'contadorRequisicoes',
  buscaWeb: 'buscaWeb',
  /** v4: true = Tavily no modo avançado (checkbox das Configurações); false = básico. */
  tavilyAvancado: 'tavilyAvancado',
  /** v4: { mes, buscas, creditos } do mês corrente. */
  contadorTavily: 'contadorTavily',
  /** v4: limite mensal de créditos da Tavily (inteiro). */
  limiteMesTavily: 'limiteMesTavily',
} as const;

export interface ConfigIA {
  modelo: string;
  pausaMs: number;
  /** Pesquisar na web (Tavily). Com arquivos no grupo, a busca é sempre básica e complementar. */
  buscaWeb: boolean;
  tavilyAvancado: boolean;
}

export async function lerConfigIA(): Promise<ConfigIA> {
  const modelo = (await obterConfig<string>(CHAVES.modelo, MODELO_PADRAO)).trim() || MODELO_PADRAO;
  const pausaS = await obterConfig<number>(CHAVES.pausa, PAUSA_PADRAO_S);
  const buscaWeb = await obterConfig<boolean>(CHAVES.buscaWeb, BUSCA_WEB_PADRAO);
  const tavilyAvancado = await obterConfig<boolean>(CHAVES.tavilyAvancado, false);
  return { modelo, pausaMs: Math.max(0, pausaS) * 1000, buscaWeb, tavilyAvancado };
}
