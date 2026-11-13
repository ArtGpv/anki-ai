/** Módulo 1 - Monta as dependências reais: chaves do IndexedDB + modelo e pesquisa das Configurações. */
import { obterChave, obterChaveTavily } from '../db';
import { ClienteGemini } from './cliente-ia';
import { ClienteTavily } from './cliente-tavily';
import { TIMEOUT_MS, TIMEOUT_TAVILY_MS, lerConfigIA } from './config-ia';
import { ErroIA } from './erros-ia';
import type { DepsGeracao } from './geracao';
import type { PesquisadorWeb, ProcessadorPython } from './tipos-ia';

/**
 * Lança SEM_CHAVE (Gemini) ou, com a pesquisa ligada, TAVILY_SEM_CHAVE, antes de qualquer cartão
 * ser alterado (quem chama é `criarOpcoesEnvio`).
 */
export async function criarDepsGeracao(
  python: ProcessadorPython,
  especificacaoMd: string,
): Promise<{ deps: DepsGeracao; pausaMs: number }> {
  const chave = await obterChave();
  if (!chave) throw new ErroIA('SEM_CHAVE', 'Informe a chave da API do Gemini nas Configurações.');
  const cfg = await lerConfigIA();

  let pesquisador: PesquisadorWeb | undefined;
  if (cfg.buscaWeb) {
    const chaveTavily = await obterChaveTavily();
    if (!chaveTavily) {
      throw new ErroIA(
        'TAVILY_SEM_CHAVE',
        'A pesquisa na web está ligada, mas falta a chave da Tavily. Informe-a nas Configurações ou desligue a pesquisa.',
      );
    }
    pesquisador = new ClienteTavily(chaveTavily, TIMEOUT_TAVILY_MS);
  }

  return {
    pausaMs: cfg.pausaMs,
    deps: {
      gerador: new ClienteGemini(chave, cfg.modelo, TIMEOUT_MS),
      python,
      especificacaoMd,
      buscaWeb: cfg.buscaWeb,
      tavilyAvancado: cfg.tavilyAvancado,
      pesquisador,
    },
  };
}
