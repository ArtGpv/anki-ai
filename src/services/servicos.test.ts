import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { baralhos, db, definirChave, definirChaveTavily, tags } from '../db';
import type { OpcoesEnvio, ProcessadorPython, ResultadoPython } from '../ia';
import {
  associarTags, buscarCartoes, chaveTavily, criarCartao, criarGrupo, criarOpcoesEnvio, criarServicoEnvio,
  desassociarTags, editarCartao, enviarGrupo, ErroServico, lerUsoTavily, exportarGrupo, listarCartoes, listarGrupos, nomeArquivoApkg, recuperarEnviosInterrompidos,
  regerarCartao, removerCartao, removerGrupo, salvarConfiguracoes, lerConfiguracoes, tentarDeNovo,
} from './index';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await baralhos.adicionar('Faculdade::Sinais');
});

const MD_MINIMO = '## 1. Papéis\ntexto\n\n## MODELO 1 - x\nm1\n\n## 7. Renderização\ncódigo';

const OK: ResultadoPython = {
  ok: true, status: 'ok', mensagem: null, erros: [],
  cartao: { baralho: 'B', front: '<b>F</b>', back: 'B', tags: [] },
  json: { pergunta: 'Defina Laplace', imagem_resposta: 'Imagem de x' },
};
const INVALIDO: ResultadoPython = { ok: false, status: 'invalido', mensagem: 'x', erros: ['e'], cartao: null, json: null };

/** Opções de envio com IA simulada: cada chamada ao Python consome a próxima resposta. */
function opcoes(respostas: ResultadoPython[]): OpcoesEnvio {
  return {
    pausaMs: 0,
    deps: {
      especificacaoMd: MD_MINIMO,
      buscaWeb: true,
      maxTentativas: 1,
      // v4: as fontes vêm da Tavily (simulada); o Gemini só devolve a consulta e o JSON.
      pesquisador: { pesquisar: async () => [{ titulo: 'Wiki', url: 'https://w.org', conteudo: 'texto' }] },
      gerador: { gerar: async () => ({ texto: '{}' }) },
      python: { processarJson: async () => respostas.shift()! } as ProcessadorPython,
    },
  };
}

async function grupoComCartoes(n = 2) {
  const g = await criarGrupo({ nome: '  Sinais   e Sistemas ', baralho: 'faculdade::sinais' });
  const cs = [];
  for (let i = 0; i < n; i++) cs.push(await criarCartao({ grupoId: g.id, modo: 'A', inputBase: `defina laplace ${i}`, tags: ['Mat::Laplace'] }));
  return { g, cs };
}

describe('grupos', () => {
  it('normaliza nome, reaproveita a caixa do baralho e exige baralho existente', async () => {
    const g = await criarGrupo({ nome: '  Sinais   e Sistemas ', baralho: 'faculdade::sinais' });
    expect(g.nome).toBe('Sinais e Sistemas');
    expect(g.baralho).toBe('Faculdade::Sinais');
    await expect(criarGrupo({ nome: 'x', baralho: 'Nao::Existe' })).rejects.toMatchObject({ codigo: 'BARALHO_INEXISTENTE' });
    await expect(criarGrupo({ nome: '  ', baralho: 'Faculdade' })).rejects.toMatchObject({ codigo: 'NOME_VAZIO' });
  });

  it('estado derivado: rascunho até todos prontos; resumo por grupo', async () => {
    const { g, cs } = await grupoComCartoes(2);
    expect((await listarGrupos())[0].resumo).toMatchObject({ total: 2, prontos: 0, estado: 'rascunho' });
    await db.cartoes.update(cs[0].id, { estado: 'pronto' });
    expect((await listarGrupos())[0].resumo).toMatchObject({ prontos: 1, estado: 'rascunho' });
    await db.cartoes.update(cs[1].id, { estado: 'pronto' });
    expect((await listarGrupos())[0].resumo.estado).toBe('finalizado');
    expect((await listarGrupos())[0].id).toBe(g.id);
  });

  it('remover grupo apaga cartões e arquivos', async () => {
    const { g } = await grupoComCartoes(2);
    await db.arquivos.add({ id: 'a1', grupoId: g.id, nome: 'x.txt', tipo: 'texto', mime: 'text/plain', tamanho: 1, texto: 'x', paginas: null, conteudo: null, criadoEm: 1 });
    expect(await removerGrupo(g.id)).toBe(2);
    expect(await db.cartoes.count()).toBe(0);
    expect(await db.arquivos.count()).toBe(0);
    expect(await db.grupos.count()).toBe(0);
  });
});

describe('cartões', () => {
  it('Modo B exige modelo; Modo A descarta modelo; tags são criadas no cadastro', async () => {
    const { g } = await grupoComCartoes(0);
    await expect(criarCartao({ grupoId: g.id, modo: 'B', inputBase: 'x' })).rejects.toMatchObject({ codigo: 'MODELO_OBRIGATORIO' });
    await expect(criarCartao({ grupoId: g.id, modo: 'A', inputBase: '  ' })).rejects.toMatchObject({ codigo: 'TEXTO_VAZIO' });
    const a = await criarCartao({ grupoId: g.id, modo: 'A', inputBase: 'x', modelo: 'definicao', tags: ['Mat::Geometria', 'mat::geometria'] });
    expect(a.modelo).toBeNull();
    expect(a.tags).toEqual(['Mat::Geometria']);
    expect(await tags.listar()).toEqual(['Mat', 'Mat::Geometria']);
  });

  it('edição só antes do envio; tags podem mudar também em cartão pronto', async () => {
    const { cs } = await grupoComCartoes(1);
    const editado = await editarCartao(cs[0].id, { inputBase: 'novo texto', modo: 'B', modelo: 'definicao' });
    expect(editado).toMatchObject({ modo: 'B', modelo: 'definicao', inputBase: 'novo texto' });
    await db.cartoes.update(cs[0].id, { estado: 'pronto' });
    await expect(editarCartao(cs[0].id, { inputBase: 'y' })).rejects.toMatchObject({ codigo: 'ESTADO_INVALIDO' });
    const t = await associarTags(cs[0].id, ['Fis']);
    expect(t.tags).toEqual(['Mat::Laplace', 'Fis']);
    expect((await desassociarTags(cs[0].id, ['MAT :: laplace'])).tags).toEqual(['Fis']);
    await removerCartao(cs[0].id);
    expect(await listarCartoes(cs[0].grupoId)).toEqual([]);
  });
});

describe('envio', () => {
  it('falha parcial: pronto + erro; tentar de novo só no cartão com erro', async () => {
    const { g, cs } = await grupoComCartoes(2);
    const r = await enviarGrupo(g.id, opcoes([OK, INVALIDO]));
    expect(r.processados).toBe(2);
    expect(r.resumo).toMatchObject({ prontos: 1, erros: 1, estado: 'rascunho' });
    const [c1, c2] = await listarCartoes(g.id);
    expect(c1).toMatchObject({ estado: 'pronto', front: '<b>F</b>' });
    expect(c1.fontes).toEqual([{ titulo: 'Wiki', url: 'https://w.org' }]);
    expect(c2.estado).toBe('erro');

    await expect(tentarDeNovo(c1.id, opcoes([OK]))).rejects.toMatchObject({ codigo: 'ESTADO_INVALIDO' });
    expect((await tentarDeNovo(c2.id, opcoes([OK]))).estado).toBe('pronto');
    expect((await listarGrupos())[0].resumo.estado).toBe('finalizado');
    expect(cs).toHaveLength(2);
  });

  it('regerar só vale para pronto/erro e bloqueia envio duplicado', async () => {
    const { g, cs } = await grupoComCartoes(1);
    await expect(regerarCartao(cs[0].id, opcoes([OK]))).rejects.toMatchObject({ codigo: 'ESTADO_INVALIDO' });
    await enviarGrupo(g.id, opcoes([OK]));
    expect((await regerarCartao(cs[0].id, opcoes([OK]), 'mais curto')).estado).toBe('pronto');

    // Dois envios simultâneos do mesmo grupo: o segundo é recusado.
    await db.cartoes.update(cs[0].id, { estado: 'erro' });
    const lento = opcoes([OK]);
    lento.deps.python = { processarJson: () => new Promise((res) => setTimeout(() => res(OK), 30)) } as ProcessadorPython;
    const primeiro = enviarGrupo(g.id, lento);
    await expect(enviarGrupo(g.id, opcoes([OK]))).rejects.toMatchObject({ codigo: 'ENVIO_EM_ANDAMENTO' });
    await expect(removerGrupo(g.id)).rejects.toBeInstanceOf(ErroServico);
    await primeiro;
  });

  it('envios interrompidos viram erro ao reabrir o app', async () => {
    const { cs } = await grupoComCartoes(1);
    await db.cartoes.update(cs[0].id, { estado: 'enviando' });
    expect(await recuperarEnviosInterrompidos()).toBe(1);
    expect((await db.cartoes.get(cs[0].id))!.estado).toBe('erro');
  });
});

describe('exportação', () => {
  it('exige cartão pronto, ignora os demais e acrescenta tags automáticas', async () => {
    const { g, cs } = await grupoComCartoes(2);
    let recebidos: unknown[] = [];
    const python = { gerarApkg: async (c: unknown[]) => { recebidos = c; return new Blob(['x']); } };
    await expect(exportarGrupo(g.id, python)).rejects.toMatchObject({ codigo: 'SEM_CARTOES_PRONTOS' });
    await enviarGrupo(g.id, opcoes([OK, INVALIDO]));
    const r = await exportarGrupo(g.id, python);
    expect(r).toMatchObject({ exportados: 1, ignorados: 1, nomeArquivo: 'Sinais_e_Sistemas.apkg' });
    expect(recebidos).toEqual([
      { baralho: 'Faculdade::Sinais', front: '<b>F</b>', back: 'B', tags: ['Mat::Laplace', 'Imagem_pendente'] },
    ]);
    expect(cs).toHaveLength(2);
    expect(nomeArquivoApkg('Álgebra & Cálculo!')).toBe('Algebra_Calculo.apkg');
    expect(nomeArquivoApkg('???')).toBe('cartoes.apkg');
  });
});

describe('busca', () => {
  it('aproximada (erro de digitação, sem acento) e filtro por tag com subtags', async () => {
    const g = await criarGrupo({ nome: 'G', baralho: 'Faculdade' });
    await criarCartao({ grupoId: g.id, modo: 'A', inputBase: 'Transformada de Laplace', tags: ['Sinais::Laplace'] });
    await criarCartao({ grupoId: g.id, modo: 'A', inputBase: 'Série de Fourier', tags: ['Sinais::Fourier'] });
    await criarCartao({ grupoId: g.id, modo: 'A', inputBase: 'Área do círculo', tags: ['Mat::Geometria'] });

    expect((await buscarCartoes('laplce')).map((c) => c.inputBase)).toEqual(['Transformada de Laplace']);
    expect((await buscarCartoes('circulo')).map((c) => c.inputBase)).toEqual(['Área do círculo']);
    expect((await buscarCartoes('', { tags: ['Sinais'] })).map((c) => c.inputBase).sort()).toEqual(['Série de Fourier', 'Transformada de Laplace']);
    expect(await buscarCartoes('fourier', { tags: ['Mat'] })).toEqual([]);
  });
});

describe('configurações', () => {
  it('valida antes de gravar e devolve padrões', async () => {
    expect(await lerConfiguracoes()).toMatchObject({
      tema: 'sistema', buscaWeb: false, tavilyAvancado: false, limiteMensalTavily: 1000, modelo: 'gemini-3.5-flash-lite',
    });
    await expect(salvarConfiguracoes({ modelo: 'Gemini 3.5 Flash-Lite' })).rejects.toMatchObject({ codigo: 'CONFIG_INVALIDA' });
    expect((await salvarConfiguracoes({ buscaWeb: true })).buscaWeb).toBe(true);
    await expect(salvarConfiguracoes({ modelo: ' ', pausaSegundos: 3 })).rejects.toMatchObject({ codigo: 'CONFIG_INVALIDA' });
    expect((await lerConfiguracoes()).pausaSegundos).toBe(5); // nada foi gravado
    const c = await salvarConfiguracoes({ modelo: ' gemini-x ', pausaSegundos: 0, limiteDiario: 50, tema: 'escuro' });
    expect(c).toMatchObject({ modelo: 'gemini-x', pausaSegundos: 0, limiteDiario: 50, tema: 'escuro' });
  });
});

describe('configurações da Tavily', () => {
  it('modo avançado e limite mensal são validados antes de gravar', async () => {
    expect(await salvarConfiguracoes({ tavilyAvancado: true, limiteMensalTavily: 500 })).toMatchObject({
      tavilyAvancado: true, limiteMensalTavily: 500,
    });
    for (const ruim of [0, 1.5, -3, Number.NaN]) {
      await expect(salvarConfiguracoes({ tavilyAvancado: false, limiteMensalTavily: ruim })).rejects.toMatchObject({ codigo: 'CONFIG_INVALIDA' });
    }
    await expect(salvarConfiguracoes({ tavilyAvancado: 'sim' as unknown as boolean })).rejects.toMatchObject({ codigo: 'CONFIG_INVALIDA' });
    expect(await lerConfiguracoes()).toMatchObject({ tavilyAvancado: true, limiteMensalTavily: 500 }); // nada mudou
  });

  it('o uso mensal reflete o limite configurado', async () => {
    expect(await lerUsoTavily()).toMatchObject({ buscas: 0, creditos: 0, limite: 1000 });
    await salvarConfiguracoes({ limiteMensalTavily: 20 });
    expect((await lerUsoTavily()).limite).toBe(20);
  });

  it('chave: adiciona, mascara e remove, sem afetar a do Gemini', async () => {
    expect(await chaveTavily.existe()).toBe(false);
    await definirChave('AIzaGemini');
    await chaveTavily.definir(' tvly-abc123 ');
    expect(await chaveTavily.existe()).toBe(true);
    expect(await chaveTavily.mascarada()).toBe('tvly••••••••');
    await chaveTavily.remover();
    expect(await chaveTavily.mascarada()).toBeNull();
    await expect(chaveTavily.definir('  ')).rejects.toMatchObject({ codigo: 'CHAVE_VAZIA' });
  });
});

describe('opções de envio com a Tavily', () => {
  const py = { processar: async () => { throw new Error('não deveria chamar o Python'); } };

  it('pesquisa ligada sem chave da Tavily falha antes de mexer nos cartões', async () => {
    const { g, cs } = await grupoComCartoes(2);
    await definirChave('AIzaGemini');
    await salvarConfiguracoes({ buscaWeb: true });
    await expect(criarServicoEnvio(py).enviarGrupo(g.id)).rejects.toMatchObject({ codigo: 'TAVILY_SEM_CHAVE' });
    for (const c of cs) expect((await db.cartoes.get(c.id))!.estado).toBe('rascunho');

    await definirChaveTavily('tvly-abc123');
    const op = await criarOpcoesEnvio(py);
    expect(op.deps.buscaWeb).toBe(true);
    expect(op.deps.pesquisador).toBeDefined();
  });

  it('sem a pesquisa não exige chave da Tavily; o modo avançado chega às opções', async () => {
    await definirChave('AIzaGemini');
    const sem = (await criarOpcoesEnvio(py)).deps;
    expect(sem).toMatchObject({ buscaWeb: false, tavilyAvancado: false });
    expect(sem.pesquisador).toBeUndefined();

    await definirChaveTavily('tvly-abc123');
    await salvarConfiguracoes({ buscaWeb: true, tavilyAvancado: true });
    expect((await criarOpcoesEnvio(py)).deps).toMatchObject({ buscaWeb: true, tavilyAvancado: true });
  });
});
