/** Módulo 1 - Erros da camada de IA, com mensagens em português para o cartão em estado "erro". */

export type CodigoErroIA =
  | 'SEM_CHAVE'
  | 'CHAVE_INVALIDA'
  | 'MODELO_INVALIDO'
  | 'LIMITE_DIARIO'
  | 'LIMITE_API'
  | 'TIMEOUT'
  | 'CANCELADO'
  | 'REDE'
  | 'RESPOSTA_VAZIA'
  | 'API'
  // v4: pesquisa na web (Tavily)
  | 'TAVILY_SEM_CHAVE'
  | 'TAVILY_CHAVE_INVALIDA'
  | 'TAVILY_LIMITE'
  | 'TAVILY_TIMEOUT'
  | 'TAVILY_REDE'
  | 'TAVILY_SEM_RESULTADOS'
  | 'TAVILY_API';

export class ErroIA extends Error {
  constructor(
    public readonly codigo: CodigoErroIA,
    mensagem: string,
    public readonly status?: number,
  ) {
    super(mensagem);
    this.name = 'ErroIA';
  }
}

/** Erros que não adianta repetir nos próximos cartões da fila. */
export const CODIGOS_QUE_PARAM_A_FILA: CodigoErroIA[] = [
  'SEM_CHAVE',
  'CHAVE_INVALIDA',
  'MODELO_INVALIDO',
  'LIMITE_DIARIO',
  'LIMITE_API',
  'CANCELADO',
  'TAVILY_SEM_CHAVE',
  'TAVILY_CHAVE_INVALIDA',
  'TAVILY_LIMITE',
];

function extrairStatus(e: unknown): number | undefined {
  const direto = Number((e as { status?: unknown })?.status);
  if (Number.isInteger(direto) && direto >= 100) return direto;
  const m = /"code"\s*:\s*(\d{3})/.exec(String((e as { message?: unknown })?.message ?? ''));
  return m ? Number(m[1]) : undefined;
}

/** Converte qualquer falha do SDK/rede em ErroIA. */
export function traduzirErroApi(e: unknown): ErroIA {
  if (e instanceof ErroIA) return e;
  const msg = String((e as { message?: unknown })?.message ?? e);
  const status = extrairStatus(e);

  if (/API key (not valid|expired)|API_KEY_INVALID/i.test(msg) || status === 401 || status === 403) {
    return new ErroIA('CHAVE_INVALIDA', 'Chave da API recusada pelo Gemini. Confira a chave nas Configurações.', status);
  }
  if (status === 404) {
    return new ErroIA('MODELO_INVALIDO', 'Modelo não encontrado. Confira o nome do modelo nas Configurações.', status);
  }
  if (status === 429) {
    return new ErroIA('LIMITE_API', 'Limite de requisições do Gemini atingido (429). Tente de novo mais tarde.', status);
  }
  if (e instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(msg)) {
    return new ErroIA('REDE', 'Falha de rede ao chamar o Gemini. Verifique a conexão.');
  }
  return new ErroIA('API', `Erro do Gemini${status ? ` (${status})` : ''}: ${msg.slice(0, 300)}`, status);
}

/**
 * Converte a falha de uma chamada à Tavily em ErroIA. `status` é o HTTP da resposta (undefined =
 * a requisição nem chegou: rede/CORS). `detalhe` é o corpo da resposta ou o erro capturado.
 * [VERIFICAR] os códigos 432/433 (limite de plano/créditos) na documentação atual da Tavily.
 */
export function traduzirErroTavily(status: number | undefined, detalhe: unknown): ErroIA {
  if (status === 401 || status === 403) {
    return new ErroIA('TAVILY_CHAVE_INVALIDA', 'Chave da Tavily recusada. Confira a chave nas Configurações.', status);
  }
  if (status === 429 || status === 432 || status === 433) {
    return new ErroIA(
      'TAVILY_LIMITE',
      'Limite da Tavily atingido (créditos do plano ou requisições por minuto). Confira o painel da Tavily ou tente mais tarde.',
      status,
    );
  }
  if (status === undefined) {
    const msg = String((detalhe as { message?: unknown })?.message ?? detalhe);
    if (detalhe instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(msg)) {
      return new ErroIA('TAVILY_REDE', 'Falha de rede ao chamar a Tavily (conexão ou bloqueio de CORS). Verifique a conexão.');
    }
    return new ErroIA('TAVILY_API', `Erro ao chamar a Tavily: ${msg.slice(0, 300)}`);
  }
  return new ErroIA('TAVILY_API', `Erro da Tavily (${status}): ${String(detalhe).slice(0, 300)}`, status);
}
