/** Módulo 2 - Chave da API e configurações (tela de Configurações do Módulo 4). */
import {
  definirChave,
  definirChaveTavily,
  definirConfig,
  obterChave,
  obterChaveMascarada,
  obterChaveTavily,
  obterChaveTavilyMascarada,
  obterConfig,
  removerChave,
  removerChaveTavily,
} from '../db';
import {
  BUSCA_WEB_PADRAO,
  CHAVES,
  LIMITE_DIA_PADRAO,
  LIMITE_MES_TAVILY_PADRAO,
  MODELO_PADRAO,
  PAUSA_PADRAO_S,
  definirLimiteDiario,
  definirLimiteMensalTavily,
  lerContador,
  lerContadorTavily,
} from '../ia';
import { ErroServico } from './erros';

export type Tema = 'claro' | 'escuro' | 'sistema';
const CHAVE_TEMA = 'tema';

export interface Configuracoes {
  modelo: string;
  pausaSegundos: number;
  limiteDiario: number;
  /** Pesquisar na web (Tavily) ao gerar cartões. Desligado por padrão; exige a chave da Tavily. */
  buscaWeb: boolean;
  /** Tavily no modo avançado (2 créditos por busca). Padrão: básico. Com arquivos no grupo a busca é sempre básica. */
  tavilyAvancado: boolean;
  /** Limite mensal de créditos da Tavily (contagem local e aproximada). */
  limiteMensalTavily: number;
  tema: Tema;
}

/** Adicionar, alterar (mesma função) e remover a chave; a interface mostra só a versão mascarada. */
export const chaveApi = {
  definir: definirChave,
  remover: removerChave,
  mascarada: obterChaveMascarada,
  existe: async () => (await obterChave()) !== null,
};

/** Mesmo contrato da chave do Gemini, para a chave da Tavily (v4). Independente da outra. */
export const chaveTavily = {
  definir: definirChaveTavily,
  remover: removerChaveTavily,
  mascarada: obterChaveTavilyMascarada,
  existe: async () => (await obterChaveTavily()) !== null,
};

export async function lerConfiguracoes(): Promise<Configuracoes> {
  const modelo = (await obterConfig<string>(CHAVES.modelo, MODELO_PADRAO)).trim() || MODELO_PADRAO;
  return {
    modelo,
    pausaSegundos: await obterConfig<number>(CHAVES.pausa, PAUSA_PADRAO_S),
    limiteDiario: await obterConfig<number>(CHAVES.limiteDia, LIMITE_DIA_PADRAO),
    buscaWeb: await obterConfig<boolean>(CHAVES.buscaWeb, BUSCA_WEB_PADRAO),
    tavilyAvancado: await obterConfig<boolean>(CHAVES.tavilyAvancado, false),
    limiteMensalTavily: await obterConfig<number>(CHAVES.limiteMesTavily, LIMITE_MES_TAVILY_PADRAO),
    tema: await obterConfig<Tema>(CHAVE_TEMA, 'sistema'),
  };
}

/** Salva só o que veio em `mudancas`; valida tudo antes de gravar qualquer coisa. */
export async function salvarConfiguracoes(mudancas: Partial<Configuracoes>): Promise<Configuracoes> {
  const { modelo, pausaSegundos, limiteDiario, buscaWeb, tavilyAvancado, limiteMensalTavily, tema } = mudancas;
  if (modelo !== undefined && !modelo.trim()) {
    throw new ErroServico('CONFIG_INVALIDA', 'Informe o código do modelo de IA.');
  }
  if (modelo !== undefined && /\s/.test(modelo.trim())) {
    throw new ErroServico(
      'CONFIG_INVALIDA',
      'Use o código do modelo (ex.: gemini-3.5-flash-lite), em minúsculas e sem espaços, e não o nome de exibição.',
    );
  }
  if (buscaWeb !== undefined && typeof buscaWeb !== 'boolean') {
    throw new ErroServico('CONFIG_INVALIDA', 'Valor inválido para a pesquisa na web.');
  }
  if (tavilyAvancado !== undefined && typeof tavilyAvancado !== 'boolean') {
    throw new ErroServico('CONFIG_INVALIDA', 'Valor inválido para o modo avançado da Tavily.');
  }
  if (limiteMensalTavily !== undefined && !(Number.isInteger(limiteMensalTavily) && limiteMensalTavily >= 1)) {
    throw new ErroServico('CONFIG_INVALIDA', 'O limite mensal da Tavily deve ser um inteiro maior que 0.');
  }
  if (pausaSegundos !== undefined && !(Number.isFinite(pausaSegundos) && pausaSegundos >= 0 && pausaSegundos <= 600)) {
    throw new ErroServico('CONFIG_INVALIDA', 'A pausa entre cartões deve ficar entre 0 e 600 segundos.');
  }
  if (limiteDiario !== undefined && !(Number.isInteger(limiteDiario) && limiteDiario >= 1)) {
    throw new ErroServico('CONFIG_INVALIDA', 'O limite diário deve ser um inteiro maior que 0.');
  }
  if (tema !== undefined && !['claro', 'escuro', 'sistema'].includes(tema)) {
    throw new ErroServico('CONFIG_INVALIDA', 'Tema inválido.');
  }

  if (modelo !== undefined) await definirConfig(CHAVES.modelo, modelo.trim());
  if (pausaSegundos !== undefined) await definirConfig(CHAVES.pausa, pausaSegundos);
  if (limiteDiario !== undefined) await definirLimiteDiario(limiteDiario);
  if (buscaWeb !== undefined) await definirConfig(CHAVES.buscaWeb, buscaWeb);
  if (tavilyAvancado !== undefined) await definirConfig(CHAVES.tavilyAvancado, tavilyAvancado);
  if (limiteMensalTavily !== undefined) await definirLimiteMensalTavily(limiteMensalTavily);
  if (tema !== undefined) await definirConfig(CHAVE_TEMA, tema);
  return lerConfiguracoes();
}

/** Contador de requisições do dia (ex.: "37 / 200"). O dia segue o relógio do Pacífico, como a cota do Gemini. */
export async function lerUsoDoDia(): Promise<{ dia: string; total: number; limite: number }> {
  return lerContador();
}

/** Buscas e créditos estimados do mês na Tavily (ex.: "17 / 1000 créditos"). Zera na virada do mês (UTC). */
export async function lerUsoTavily(): Promise<{ mes: string; buscas: number; creditos: number; limite: number }> {
  return lerContadorTavily();
}
