/** Módulo 1 (v4) - Cliente da Tavily (REST), chamado direto do navegador. CORS confirmado no GitHub Pages. */
import { reservarBuscaTavily } from './contador';
import { MAX_CHARS_RESULTADO, MAX_RESULTADOS_TAVILY, TAVILY_URL, TIMEOUT_TAVILY_MS } from './config-ia';
import { ErroIA, traduzirErroTavily } from './erros-ia';
import type { PesquisadorWeb, ReqPesquisa, ResultadoBusca } from './tipos-ia';

function extrairResultados(texto: string): ResultadoBusca[] {
  let dados: { results?: unknown };
  try {
    dados = JSON.parse(texto);
  } catch {
    throw new ErroIA('TAVILY_API', 'A Tavily devolveu uma resposta que não é JSON válido.');
  }
  const lista = Array.isArray(dados.results) ? (dados.results as Record<string, unknown>[]) : [];
  const saida: ResultadoBusca[] = [];
  for (const r of lista) {
    const url = typeof r.url === 'string' ? r.url.trim() : '';
    const conteudo = typeof r.content === 'string' ? r.content.trim() : '';
    if (!url || !conteudo) continue;
    const titulo = typeof r.title === 'string' && r.title.trim() ? r.title.trim() : url;
    saida.push({ titulo, url, conteudo: conteudo.slice(0, MAX_CHARS_RESULTADO) });
  }
  return saida;
}

export class ClienteTavily implements PesquisadorWeb {
  constructor(
    private readonly apiKey: string,
    private readonly timeoutMs = TIMEOUT_TAVILY_MS,
    private readonly url = TAVILY_URL,
  ) {}

  /** Uma busca por chamada; cada uma conta no contador mensal (1 crédito básica, 2 avançada). Devolve os resultados na ordem da Tavily (só os com URL e conteúdo). */
  async pesquisar(req: ReqPesquisa): Promise<ResultadoBusca[]> {
    // Antes de qualquer rede: se os créditos do mês acabaram, lança TAVILY_LIMITE sem chamar a Tavily.
    await reservarBuscaTavily(req.avancado);

    const ctl = new AbortController();
    let estourou = false;
    const timer = setTimeout(() => {
      estourou = true;
      ctl.abort();
    }, this.timeoutMs);
    const cancelar = () => ctl.abort();
    req.sinal?.addEventListener('abort', cancelar, { once: true });

    try {
      const resp = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          query: req.consulta,
          search_depth: req.avancado ? 'advanced' : 'basic',
          max_results: MAX_RESULTADOS_TAVILY,
          include_answer: false,
          include_raw_content: false,
          include_images: false,
        }),
        signal: ctl.signal,
      });
      const corpo = await resp.text();
      if (!resp.ok) throw traduzirErroTavily(resp.status, corpo);
      return extrairResultados(corpo);
    } catch (e) {
      if (estourou) throw new ErroIA('TAVILY_TIMEOUT', `A Tavily não respondeu em ${Math.round(this.timeoutMs / 1000)} s.`);
      if (req.sinal?.aborted) throw new ErroIA('CANCELADO', 'Envio cancelado.');
      if (e instanceof ErroIA) throw e;
      throw traduzirErroTavily(undefined, e);
    } finally {
      clearTimeout(timer);
      req.sinal?.removeEventListener('abort', cancelar);
    }
  }
}
