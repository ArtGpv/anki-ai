/** Módulo 1 - Cliente do Gemini (@google/genai), chamado direto do navegador. Sem ferramentas (v4). */
import { GoogleGenAI, type GenerateContentConfig } from '@google/genai';
import schemaBruto from './cartao_schema.json';
import { reservarRequisicao } from './contador';
import { ErroIA, traduzirErroApi } from './erros-ia';
import type { GeradorIA, ReqGerar, RespostaIA } from './tipos-ia';

// A API não usa $schema/$id; o resto do JSON Schema vai como está.
const { $schema: _s, $id: _i, ...SCHEMA_IA } = schemaBruto as Record<string, unknown>;

function rejeitarAoAbortar(sinal: AbortSignal): Promise<never> {
  return new Promise((_, rejeitar) => {
    if (sinal.aborted) return rejeitar(new DOMException('Abortado', 'AbortError'));
    sinal.addEventListener('abort', () => rejeitar(new DOMException('Abortado', 'AbortError')), { once: true });
  });
}

export class ClienteGemini implements GeradorIA {
  private readonly ai: GoogleGenAI;

  constructor(
    apiKey: string,
    private readonly modelo: string,
    private readonly timeoutMs = 60_000,
  ) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  /** Cada chamada (consulta, geração ou regeneração) conta 1 requisição no contador do dia, mesmo se falhar. */
  async gerar(req: ReqGerar): Promise<RespostaIA> {
    await reservarRequisicao();

    const ctl = new AbortController();
    let estourou = false;
    const timer = setTimeout(() => {
      estourou = true;
      ctl.abort();
    }, this.timeoutMs);
    const cancelar = () => ctl.abort();
    req.sinal?.addEventListener('abort', cancelar, { once: true });

    try {
      const config: GenerateContentConfig = {
        systemInstruction: req.sistema,
        temperature: 0.2,
        abortSignal: ctl.signal,
      };
      if (req.saidaEstruturada) {
        config.responseMimeType = 'application/json';
        config.responseJsonSchema = SCHEMA_IA;
      }

      const resp = await Promise.race([
        this.ai.models.generateContent({ model: this.modelo, contents: req.contents, config }),
        rejeitarAoAbortar(ctl.signal),
      ]);

      const texto = resp.text?.trim();
      if (!texto) {
        const bloqueio = resp.promptFeedback?.blockReason;
        throw new ErroIA('RESPOSTA_VAZIA', bloqueio ? `O Gemini bloqueou o pedido (${bloqueio}).` : 'O Gemini devolveu uma resposta vazia.');
      }
      return { texto };
    } catch (e) {
      if (estourou) throw new ErroIA('TIMEOUT', `O Gemini não respondeu em ${Math.round(this.timeoutMs / 1000)} s.`);
      if (req.sinal?.aborted) throw new ErroIA('CANCELADO', 'Envio cancelado.');
      throw traduzirErroApi(e);
    } finally {
      clearTimeout(timer);
      req.sinal?.removeEventListener('abort', cancelar);
    }
  }
}
