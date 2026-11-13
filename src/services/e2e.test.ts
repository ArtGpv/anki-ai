/** Ponta a ponta (Módulo 7): grupo → cartões → envio (Gemini simulado + ClienteTavily real com fetch simulado) → exportação. */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { baralhos, db } from '../db';
import { ClienteTavily, definirLimiteMensalTavily, type OpcoesEnvio, type ProcessadorPython, type ResultadoPython } from '../ia';
import {
  criarCartao, criarGrupo, enviarGrupo, exportarGrupo, lerUsoTavily, listarCartoes, listarGrupos,
} from './index';

const MD_MINIMO = '## 1. Papéis\ntexto\n\n## MODELO 1 - x\nm1\n\n## 7. Renderização\ncódigo';

const OK: ResultadoPython = {
  ok: true, status: 'ok', mensagem: null, erros: [],
  cartao: { baralho: 'B', front: '<b>F</b>', back: 'B', tags: [] },
  json: { pergunta: 'Defina Laplace' },
};

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await baralhos.adicionar('Faculdade::Sinais');
});
afterEach(() => vi.unstubAllGlobals());

/** Tavily real (REST) com fetch simulado; Gemini simulado: consulta em texto simples, geração em "{}". */
function montar(avancado = false) {
  const falso = vi.fn(async () =>
    new Response(JSON.stringify({ results: [{ title: 'Laplace', url: 'https://w.org/1', content: 'texto' }] }), { status: 200 }),
  );
  vi.stubGlobal('fetch', falso);
  const op: OpcoesEnvio = {
    pausaMs: 0,
    deps: {
      especificacaoMd: MD_MINIMO,
      buscaWeb: true,
      tavilyAvancado: avancado,
      maxTentativas: 1,
      pesquisador: new ClienteTavily('tvly-x'),
      gerador: { gerar: async (req) => ({ texto: req.saidaEstruturada ? '{}' : 'laplace transform' }) },
      python: { processarJson: async () => OK } as ProcessadorPython,
    },
  };
  return { op, falso };
}

async function grupoComCartoes(n: number) {
  const g = await criarGrupo({ nome: 'Sinais e Sistemas', baralho: 'Faculdade::Sinais' });
  for (let i = 0; i < n; i++) {
    await criarCartao({ grupoId: g.id, modo: 'A', inputBase: `defina laplace ${i}`, tags: ['Mat::Laplace'] });
  }
  return g;
}

const corpo = (falso: ReturnType<typeof vi.fn>, i: number) =>
  JSON.parse(((falso.mock.calls[i] as unknown as [string, RequestInit])[1]).body as string);

describe('fluxo completo com pesquisa na web', () => {
  it('envia, guarda as fontes da Tavily, conta os créditos e exporta', async () => {
    const { op, falso } = montar();
    const g = await grupoComCartoes(2);

    const r = await enviarGrupo(g.id, op);
    expect(r).toMatchObject({ processados: 2, resumo: { prontos: 2, estado: 'finalizado' } });
    expect((await listarGrupos())[0].resumo.estado).toBe('finalizado');

    for (const c of await listarCartoes(g.id)) {
      expect(c.estado).toBe('pronto');
      expect(c.fontes).toEqual([{ titulo: 'Laplace', url: 'https://w.org/1' }]);
    }
    expect(falso).toHaveBeenCalledTimes(2); // uma busca por cartão
    expect(corpo(falso, 0)).toMatchObject({ search_depth: 'basic', max_results: 5 });
    expect(await lerUsoTavily()).toMatchObject({ buscas: 2, creditos: 2 });

    let recebidos: { tags: string[] }[] = [];
    const python = { gerarApkg: async (c: typeof recebidos) => { recebidos = c; return new Blob(['x']); } };
    const e = await exportarGrupo(g.id, python);
    expect(e).toMatchObject({ exportados: 2, ignorados: 0, nomeArquivo: 'Sinais_e_Sistemas.apkg' });
    expect(recebidos.map((c) => c.tags)).toEqual([['Mat::Laplace'], ['Mat::Laplace']]);
  });

  it('modo avançado: search_depth "advanced" e 2 créditos por busca', async () => {
    const { op, falso } = montar(true);
    const g = await grupoComCartoes(1);
    await enviarGrupo(g.id, op);
    expect(corpo(falso, 0)).toMatchObject({ search_depth: 'advanced' });
    expect(await lerUsoTavily()).toMatchObject({ buscas: 1, creditos: 2 });
  });

  it('limite mensal esgotado interrompe a fila: o restante continua em rascunho', async () => {
    await definirLimiteMensalTavily(1);
    const { op, falso } = montar();
    const g = await grupoComCartoes(3);

    const r = await enviarGrupo(g.id, op);
    expect(r.processados).toBe(2); // o 2º falha com TAVILY_LIMITE e a fila para
    expect(r.resumo).toMatchObject({ prontos: 1, erros: 1, rascunhos: 1, estado: 'rascunho' });
    const erro = (await listarCartoes(g.id)).find((c) => c.estado === 'erro')!;
    expect(erro.mensagemErro).toContain('Limite mensal');
    expect(falso).toHaveBeenCalledTimes(1); // a busca recusada nem chegou à rede
    expect(await lerUsoTavily()).toMatchObject({ buscas: 1, creditos: 1, limite: 1 });
  });
});
