import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db';
import { ClienteTavily } from './cliente-tavily';
import {
  definirLimiteMensalTavily, lerContadorTavily, mesDeReset, reservarBuscaTavily, reservarRequisicao,
} from './contador';
import { CODIGOS_QUE_PARAM_A_FILA, ErroIA } from './erros-ia';
import { executarFila } from './fila';
import { gerarCartao, type DepsGeracao } from './geracao';
import { extrairBase, limparConsulta, montarMaterialPesquisado, montarMensagemUsuario, montarSistema } from './prompt';
import type { ProcessadorPython, ReqGerar, ReqPesquisa, ResultadoBusca, ResultadoPython } from './tipos-ia';

const md = readFileSync(new URL('./especificacao_cartoes.md', import.meta.url), 'utf8');

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});
afterEach(() => vi.unstubAllGlobals());

const OK: ResultadoPython = {
  ok: true, status: 'ok', mensagem: null, erros: [],
  cartao: { baralho: 'B', front: 'f', back: 'b', tags: [] }, json: {},
};
const invalido = (erros: string[]): ResultadoPython => ({
  ok: false, status: 'invalido', mensagem: 'x', erros, cartao: null, json: null,
});

const RESULTADOS: ResultadoBusca[] = [
  { titulo: 'Laplace A', url: 'https://w.org/1', conteudo: 'conteúdo um' },
  { titulo: 'Laplace B', url: 'https://w.org/2', conteudo: 'conteúdo dois' },
];

interface OpMontar {
  buscaWeb?: boolean;
  tavilyAvancado?: boolean;
  semPesquisador?: boolean;
  erroBusca?: Error;
  achados?: ResultadoBusca[];
}

/** Gemini e Tavily simulados. A consulta (saidaEstruturada = false) devolve texto simples; a geração, "{}". */
function montar(respostas: ResultadoPython[], op: OpMontar = {}) {
  const reqs: ReqGerar[] = [];
  const buscas: ReqPesquisa[] = [];
  const deps: DepsGeracao = {
    especificacaoMd: md,
    buscaWeb: op.buscaWeb ?? false,
    tavilyAvancado: op.tavilyAvancado,
    pesquisador: op.semPesquisador
      ? undefined
      : {
          async pesquisar(req) {
            buscas.push(req);
            if (op.erroBusca) throw op.erroBusca;
            return op.achados ?? RESULTADOS;
          },
        },
    gerador: {
      async gerar(req) {
        reqs.push({ ...req, contents: [...req.contents] });
        return { texto: req.saidaEstruturada ? '{}' : 'laplace transform definition' };
      },
    },
    python: { processarJson: async () => respostas.shift()! } as ProcessadorPython,
  };
  return { deps, reqs, buscas };
}
const pedidoA = { modo: 'A' as const, texto: 'defina X', tags: ['Mat'] };
const textos = (r: ReqGerar, i = 0) =>
  (r.contents[i].parts ?? []).map((p) => (p as { text?: string }).text ?? '').join('\n');

describe('prompt', () => {
  it('base vai das seções 1 a 6; Modo B mantém só o modelo escolhido', () => {
    const tudo = extrairBase(md);
    expect(tudo).toContain('## MODELO 4');
    expect(tudo).not.toContain('## 7.');
    const so1 = extrairBase(md, 'definicao');
    expect(so1).toContain('## MODELO 1');
    expect(so1).not.toContain('## MODELO 2');
  });
  it('Modo B não envia tags e pede separação de contexto; Modo A envia tags como leitura', () => {
    const b = montarMensagemUsuario({ modo: 'B', texto: 'Em sinais, defina X', tags: ['Mat'], modelo: 'definicao' });
    const txtB = (b[0] as { text: string }).text;
    expect(txtB).toContain('modelo_incerto');
    expect(txtB).not.toContain('Mat');
    const a = (montarMensagemUsuario(pedidoA)[0] as { text: string }).text;
    expect(a).toContain('SOMENTE LEITURA');
    expect(montarSistema(md, 'A')).toContain('REGRAS DE SAÍDA');
  });
  it('Modo B sem modelo é erro', () => {
    expect(() => montarMensagemUsuario({ modo: 'B', texto: 'x', tags: [] })).toThrow();
  });
  it('material pesquisado: sem arquivos a Tavily prevalece; com arquivos é só complemento', () => {
    const sem = montarMaterialPesquisado(RESULTADOS, false);
    expect(sem).toContain('análise conjunta');
    expect(sem).toContain('prevalece');
    expect(sem).toContain('https://w.org/1');
    const com = montarMaterialPesquisado(RESULTADOS, true);
    expect(com).toContain('prioridade');
    expect(com).not.toContain('prevalece');
  });
  it('limparConsulta tira aspas, cercas e prefixo', () => {
    expect(limparConsulta('Consulta: "laplace transform"')).toBe('laplace transform');
    expect(limparConsulta('```\nlaplace transform\n```')).toBe('laplace transform');
    expect(limparConsulta('   ')).toBe('');
  });
});

describe('contador', () => {
  it('bloqueia ao atingir o limite e zera em outro dia', async () => {
    await db.config.put({ chave: 'limiteDiarioRequisicoes', valor: 2 });
    const hoje = new Date('2026-11-07T12:00:00Z');
    await reservarRequisicao(hoje);
    await reservarRequisicao(hoje);
    await expect(reservarRequisicao(hoje)).rejects.toMatchObject({ codigo: 'LIMITE_DIARIO' });
    expect(await reservarRequisicao(new Date('2026-11-09T12:00:00Z'))).toBe(1);
  });
});

describe('contador mensal da Tavily', () => {
  it('básica custa 1 crédito, avançada 2, e zera na virada do mês', async () => {
    const nov = new Date('2026-11-15T12:00:00Z');
    expect(await lerContadorTavily(nov)).toMatchObject({ mes: '2026-11', buscas: 0, creditos: 0, limite: 1000 });
    await reservarBuscaTavily(false, nov);
    await reservarBuscaTavily(true, nov);
    expect(await lerContadorTavily(nov)).toMatchObject({ buscas: 2, creditos: 3 });
    expect(await lerContadorTavily(new Date('2026-12-01T00:30:00Z'))).toMatchObject({ mes: '2026-12', buscas: 0, creditos: 0 });
    expect(await reservarBuscaTavily(false, new Date('2026-12-01T00:30:00Z'))).toMatchObject({ buscas: 1, creditos: 1 });
    expect(mesDeReset(nov)).toBe('2026-11');
  });
  it('bloqueia quando os créditos acabariam e não conta a busca recusada', async () => {
    await definirLimiteMensalTavily(3);
    const d = new Date('2026-11-15T12:00:00Z');
    await reservarBuscaTavily(true, d); // 2
    await expect(reservarBuscaTavily(true, d)).rejects.toMatchObject({ codigo: 'TAVILY_LIMITE' }); // 4 > 3
    expect(await lerContadorTavily(d)).toMatchObject({ buscas: 1, creditos: 2 });
    await reservarBuscaTavily(false, d); // 3 <= 3
    expect(await lerContadorTavily(d)).toMatchObject({ buscas: 2, creditos: 3, limite: 3 });
  });
  it('limite mensal inválido é recusado', async () => {
    await expect(definirLimiteMensalTavily(0)).rejects.toThrow();
    await expect(definirLimiteMensalTavily(1.5)).rejects.toThrow();
  });
});

describe('gerarCartao (validação e regeneração, sem pesquisa)', () => {
  it('regenera enviando os erros e para ao validar', async () => {
    const { deps, reqs } = montar([invalido(['pergunta: erro A']), OK]);
    const s = await gerarCartao({ pedido: pedidoA, baralho: 'B' }, deps);
    expect(s.resultado.ok).toBe(true);
    expect(s.tentativas).toBe(2);
    const ultimo = reqs[1].contents.at(-1)!.parts![0] as { text: string };
    expect(ultimo.text).toContain('pergunta: erro A');
    expect(reqs[1].contents).toHaveLength(3);
  });
  it('desiste após 3 gerações', async () => {
    const { deps, reqs } = montar([invalido(['a']), invalido(['b']), invalido(['c'])]);
    const s = await gerarCartao({ pedido: pedidoA, baralho: 'B' }, deps);
    expect(s.resultado.status).toBe('invalido');
    expect(reqs).toHaveLength(3);
  });
  it('separar_cartoes não é regenerado', async () => {
    const sep: ResultadoPython = { ...invalido([]), status: 'separar_cartoes', mensagem: 'separe' };
    const { deps, reqs } = montar([sep]);
    const s = await gerarCartao({ pedido: pedidoA, baralho: 'B' }, deps);
    expect(s.resultado.status).toBe('separar_cartoes');
    expect(reqs).toHaveLength(1);
  });
  it('pesquisa desligada não chama a Tavily nem gera consulta; sem fontes', async () => {
    const { deps, reqs, buscas } = montar([OK]);
    const s = await gerarCartao({ pedido: pedidoA, baralho: 'B' }, deps);
    expect(buscas).toHaveLength(0);
    expect(reqs).toHaveLength(1);
    expect(s.fontes).toEqual([]);
    expect(textos(reqs[0])).not.toContain('MATERIAL PESQUISADO');
  });
});

describe('gerarCartao (pesquisa: consulta → Tavily → geração)', () => {
  it('consulta e Tavily uma só vez por cartão, reaproveitadas nas regenerações', async () => {
    const { deps, reqs, buscas } = montar([invalido(['x']), OK], { buscaWeb: true });
    const s = await gerarCartao({ pedido: pedidoA, baralho: 'B' }, deps);
    expect(s.tentativas).toBe(2);
    expect(reqs.map((r) => r.saidaEstruturada)).toEqual([false, true, true]); // 1 consulta + 2 gerações = 3 chamadas ao Gemini
    expect('buscaWeb' in reqs[0]).toBe(false); // o Gemini nunca recebe ferramentas
    expect(buscas).toHaveLength(1);
    expect(buscas[0]).toMatchObject({ consulta: 'laplace transform definition', avancado: false });
    expect(textos(reqs[1])).toContain('MATERIAL PESQUISADO');
    expect(textos(reqs[2])).toContain('https://w.org/2'); // a regeneração mantém o material
  });
  it('a consulta leva só o texto do usuário; com arquivos a busca é sempre básica', async () => {
    const { deps, reqs, buscas } = montar([OK], { buscaWeb: true, tavilyAvancado: true });
    const pedido = { ...pedidoA, arquivos: { texto: 'SEGREDO-DO-ARQUIVO', imagens: [] } };
    await gerarCartao({ pedido, baralho: 'B' }, deps);
    expect(buscas[0].avancado).toBe(false);
    expect(textos(reqs[0])).toContain('defina X');
    expect(textos(reqs[0])).not.toContain('SEGREDO-DO-ARQUIVO');
    expect(textos(reqs[0])).not.toContain('Mat'); // tags também não vão
    expect(textos(reqs[1])).toContain('SEGREDO-DO-ARQUIVO');
    expect(textos(reqs[1])).toContain('prioridade');
  });
  it('o checkbox liga o modo avançado (sem arquivos)', async () => {
    const { deps, buscas } = montar([OK], { buscaWeb: true, tavilyAvancado: true });
    await gerarCartao({ pedido: pedidoA, baralho: 'B' }, deps);
    expect(buscas[0].avancado).toBe(true);
  });
  it('as fontes do cartão vêm da Tavily, na ordem dela', async () => {
    const { deps } = montar([OK], { buscaWeb: true });
    const s = await gerarCartao({ pedido: pedidoA, baralho: 'B' }, deps);
    expect(s.fontes).toEqual([
      { titulo: 'Laplace A', url: 'https://w.org/1' },
      { titulo: 'Laplace B', url: 'https://w.org/2' },
    ]);
  });
  it('erro da Tavily não faz fallback: falha e não chega à geração', async () => {
    const { deps, reqs } = montar([OK], { buscaWeb: true, erroBusca: new ErroIA('TAVILY_LIMITE', 'sem créditos') });
    await expect(gerarCartao({ pedido: pedidoA, baralho: 'B' }, deps)).rejects.toMatchObject({ codigo: 'TAVILY_LIMITE' });
    expect(reqs).toHaveLength(1); // só a consulta
  });
  it('pesquisa ligada sem pesquisador (sem chave) falha antes de chamar o Gemini', async () => {
    const { deps, reqs } = montar([OK], { buscaWeb: true, semPesquisador: true });
    await expect(gerarCartao({ pedido: pedidoA, baralho: 'B' }, deps)).rejects.toMatchObject({ codigo: 'TAVILY_SEM_CHAVE' });
    expect(reqs).toHaveLength(0);
  });
  it('zero resultados vira erro claro', async () => {
    const { deps } = montar([OK], { buscaWeb: true, achados: [] });
    await expect(gerarCartao({ pedido: pedidoA, baralho: 'B' }, deps)).rejects.toMatchObject({ codigo: 'TAVILY_SEM_RESULTADOS' });
  });
  it('erros globais da Tavily interrompem a fila; os de um só cartão não', () => {
    for (const c of ['TAVILY_SEM_CHAVE', 'TAVILY_CHAVE_INVALIDA', 'TAVILY_LIMITE'] as const) {
      expect(CODIGOS_QUE_PARAM_A_FILA).toContain(c);
    }
    for (const c of ['TAVILY_TIMEOUT', 'TAVILY_REDE', 'TAVILY_SEM_RESULTADOS', 'TAVILY_API'] as const) {
      expect(CODIGOS_QUE_PARAM_A_FILA).not.toContain(c);
    }
  });
});

describe('ClienteTavily', () => {
  const resposta = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status });

  it('envia a chave e o modo, e devolve só resultados com url e conteúdo', async () => {
    const falso = vi.fn(async () =>
      resposta(200, {
        results: [
          { title: 'A', url: 'https://a', content: 'ca', score: 1 },
          { title: 'sem conteúdo', url: 'https://b', content: '' },
        ],
      }),
    );
    vi.stubGlobal('fetch', falso);
    const r = await new ClienteTavily('tvly-x').pesquisar({ consulta: 'q', avancado: true });
    expect(r).toEqual([{ titulo: 'A', url: 'https://a', conteudo: 'ca' }]);
    const [url, init] = falso.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.tavily.com/search');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tvly-x');
    expect(JSON.parse(init.body as string)).toMatchObject({ query: 'q', search_depth: 'advanced', max_results: 5 });
  });
  it.each([
    [401, 'TAVILY_CHAVE_INVALIDA'],
    [429, 'TAVILY_LIMITE'],
    [432, 'TAVILY_LIMITE'],
    [500, 'TAVILY_API'],
  ])('HTTP %i vira %s', async (status, codigo) => {
    vi.stubGlobal('fetch', vi.fn(async () => resposta(status, { detail: 'x' })));
    await expect(new ClienteTavily('k').pesquisar({ consulta: 'q', avancado: false })).rejects.toMatchObject({ codigo });
  });
  it('cada busca entra no contador mensal; sem créditos, nem chama a rede', async () => {
    const falso = vi.fn(async () => resposta(200, { results: [] }));
    vi.stubGlobal('fetch', falso);
    const c = new ClienteTavily('k');
    await c.pesquisar({ consulta: 'q', avancado: true });
    await c.pesquisar({ consulta: 'q', avancado: false });
    expect(await lerContadorTavily()).toMatchObject({ buscas: 2, creditos: 3 });
    await definirLimiteMensalTavily(3);
    await expect(c.pesquisar({ consulta: 'q', avancado: false })).rejects.toMatchObject({ codigo: 'TAVILY_LIMITE' });
    expect(falso).toHaveBeenCalledTimes(2);
  });
  it('falha de rede/CORS vira TAVILY_REDE', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(new ClienteTavily('k').pesquisar({ consulta: 'q', avancado: false })).rejects.toMatchObject({ codigo: 'TAVILY_REDE' });
  });
});

describe('fila', () => {
  it('pausa só entre itens que chamaram a API e para quando pedido', async () => {
    const pausas: number[] = [];
    const esperar = async (ms: number) => { pausas.push(ms); };
    const feitos = await executarFila([1, 2, 3, 4], async (n) => (n === 2 ? { chamouApi: false } : n === 3 ? { parar: true } : {}), {
      pausaMs: 5000, esperar,
    });
    expect(feitos).toBe(3);
    expect(pausas).toEqual([5000]); // após o item 1; item 2 não chamou a API; item 3 parou
  });
});
