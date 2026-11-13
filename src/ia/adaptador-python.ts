/** Módulo 1 - Liga o ClientePython (src/pyodide) ao ProcessadorPython esperado por geracao.ts. */
import type { ClientePython } from '../pyodide/cliente';
import { ErroIA } from './erros-ia';
import type { ProcessadorPython, ResultadoPython } from './tipos-ia';

export function adaptarPython(cliente: Pick<ClientePython, 'processar'>): ProcessadorPython {
  return {
    async processarJson(entrada, baralho, tags, delimitador) {
      try {
        const r = await cliente.processar({
          entrada,
          baralho,
          tags: tags ?? undefined,
          delimitador: delimitador as 'parenteses' | 'tag' | undefined,
        });
        return r as ResultadoPython;
      } catch (e) {
        // Falha do Worker/Pyodide (não é erro do Gemini): mensagem própria no cartão.
        throw new ErroIA('API', `Falha ao validar o cartão no Python: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  };
}
