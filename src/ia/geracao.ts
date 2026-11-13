/**
 * Módulo 1 - Gerar UM cartão (v4). Com a pesquisa ligada, cada cartão passa por:
 *   1) consulta (Gemini, sem ferramentas) -> 2) pesquisa (Tavily) -> 3) geração (Gemini, saída estruturada)
 *   -> 4) validação no Python e regeneração (sem repetir 1 e 2).
 * Limites por cartão: até 4 chamadas ao Gemini (1 consulta + 1 geração + 2 regenerações) e 1 à Tavily.
 */
import type { Content } from '@google/genai';
import type { Fonte } from '../db';
import { MAX_TENTATIVAS } from './config-ia';
import { ErroIA } from './erros-ia';
import {
  SISTEMA_CONSULTA,
  limparConsulta,
  montarMensagemConsulta,
  montarMensagemErros,
  montarMensagemUsuario,
  montarSistema,
  temArquivos,
} from './prompt';
import type { GeradorIA, PedidoCartao, PesquisadorWeb, ProcessadorPython, ResultadoBusca, ResultadoPython } from './tipos-ia';

export interface DepsGeracao {
  gerador: GeradorIA;
  python: ProcessadorPython;
  /** Conteúdo de especificacao_cartoes.md. */
  especificacaoMd: string;
  /** Opção "Pesquisar na web" das Configurações. Desligada: nenhuma chamada à Tavily. */
  buscaWeb: boolean;
  /** Checkbox "Usar pesquisa avançada". Ignorado quando o grupo tem arquivos (a busca é sempre básica). */
  tavilyAvancado?: boolean;
  /** Obrigatório quando `buscaWeb` é true; sem ele, o cartão falha com TAVILY_SEM_CHAVE. */
  pesquisador?: PesquisadorWeb;
  maxTentativas?: number;
  sinal?: AbortSignal;
}

export interface EntradaGeracao {
  pedido: PedidoCartao;
  baralho: string;
  delimitador?: string;
}

export interface SaidaGeracao {
  resultado: ResultadoPython;
  /** Resultados da Tavily enviados ao Gemini, na ordem da Tavily (vazio sem pesquisa). */
  fontes: Fonte[];
  /** Quantas gerações foram usadas (1 a 3); a consulta não conta aqui. */
  tentativas: number;
}

export async function gerarCartao(entrada: EntradaGeracao, deps: DepsGeracao): Promise<SaidaGeracao> {
  const { pedido, baralho, delimitador } = entrada;
  const max = deps.maxTentativas ?? MAX_TENTATIVAS;
  const sistema = montarSistema(deps.especificacaoMd, pedido.modo, pedido.modelo);
  const comArquivos = temArquivos(pedido.arquivos);

  // Etapas 1 e 2: uma única vez por cartão; as regenerações reaproveitam o material.
  let achados: ResultadoBusca[] = [];
  if (deps.buscaWeb) {
    if (!deps.pesquisador) {
      throw new ErroIA('TAVILY_SEM_CHAVE', 'A pesquisa na web está ligada, mas falta a chave da Tavily. Informe-a nas Configurações.');
    }
    const resp = await deps.gerador.gerar({
      sistema: SISTEMA_CONSULTA,
      contents: [{ role: 'user', parts: montarMensagemConsulta(pedido) }],
      saidaEstruturada: false,
      sinal: deps.sinal,
    });
    const consulta = limparConsulta(resp.texto);
    if (!consulta) throw new ErroIA('RESPOSTA_VAZIA', 'O Gemini não devolveu uma consulta de pesquisa.');

    achados = await deps.pesquisador.pesquisar({
      consulta,
      avancado: !comArquivos && !!deps.tavilyAvancado, // com arquivos: sempre básico e complementar
      sinal: deps.sinal,
    });
    if (!achados.length) {
      throw new ErroIA('TAVILY_SEM_RESULTADOS', `A Tavily não encontrou resultados para "${consulta}". Reescreva o pedido ou desligue a pesquisa.`);
    }
  }

  const porUrl = new Map<string, Fonte>();
  for (const r of achados) if (!porUrl.has(r.url)) porUrl.set(r.url, { titulo: r.titulo || r.url, url: r.url });
  const fontes = [...porUrl.values()];

  // Etapa 3 e 4: geração com saída estruturada e regeneração com a lista de erros.
  const historico: Content[] = [{ role: 'user', parts: montarMensagemUsuario(pedido, achados) }];

  let resultado!: ResultadoPython;
  for (let tentativa = 1; tentativa <= max; tentativa++) {
    const { texto } = await deps.gerador.gerar({
      sistema,
      contents: historico,
      saidaEstruturada: true,
      sinal: deps.sinal,
    });
    resultado = await deps.python.processarJson(texto, baralho, pedido.tags.length ? pedido.tags : null, delimitador);

    // ok, separar_cartoes e entrada_insuficiente não são regenerados; só "invalido".
    if (resultado.status !== 'invalido' || tentativa === max) {
      return { resultado, fontes, tentativas: tentativa };
    }
    historico.push(
      { role: 'model', parts: [{ text: texto }] },
      { role: 'user', parts: [{ text: montarMensagemErros(resultado.erros) }] },
    );
  }
  /* istanbul ignore next */
  return { resultado, fontes, tentativas: max };
}
