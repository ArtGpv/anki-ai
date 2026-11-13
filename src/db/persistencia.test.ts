import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ancestrais, baralhos, construirArvore, db, definirChave, definirChaveTavily, definirConfig, ErroPersistencia,
  mascararChave, normalizarCaminho, novoId, obterChave, obterChaveMascarada, obterChaveTavily,
  obterChaveTavilyMascarada, obterConfig, removerChave, removerChaveTavily, tags, type Cartao,
} from './index';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

const cartao = (over: Partial<Cartao> = {}): Cartao => ({
  id: novoId(), grupoId: 'g1', modo: 'A', modelo: null, inputBase: 'x', tags: [],
  estado: 'rascunho', mensagemErro: null, json: null, front: null, back: null,
  fontes: [], criadoEm: Date.now(), ...over,
});

describe('caminhos', () => {
  it('normaliza espaços em volta de ::', () => {
    expect(normalizarCaminho(' Mat :: Geometria ')).toBe('Mat::Geometria');
    expect(normalizarCaminho('Cursos::Dados&R')).toBe('Cursos::Dados&R');
  });
  it('rejeita segmentos vazios e ":" solto', () => {
    for (const ruim of ['', 'A::', '::A', 'A::::B', 'A:::B']) {
      expect(() => normalizarCaminho(ruim)).toThrow(ErroPersistencia);
    }
  });
  it('ancestrais e árvore', () => {
    expect(ancestrais('A::B::C')).toEqual(['A', 'A::B']);
    const arv = construirArvore(['A::B::C', 'A::D', 'E']);
    expect(arv.map((n) => n.caminho)).toEqual(['A', 'E']);
    expect(arv[0].filhos.map((n) => n.caminho)).toEqual(['A::B', 'A::D']);
    expect(arv[0].filhos[0].filhos[0].nivel).toBe(3);
  });
});

describe('chave da API', () => {
  it('adiciona, altera, mascara e remove', async () => {
    expect(await obterChave()).toBeNull();
    await definirChave('  AIzaSyABC123  ');
    expect(await obterChave()).toBe('AIzaSyABC123');
    expect(await obterChaveMascarada()).toBe('AIza••••••••');
    await definirChave('AIzaOUTRA');
    expect(await obterChave()).toBe('AIzaOUTRA');
    await removerChave();
    expect(await obterChave()).toBeNull();
  });
  it('rejeita chave vazia e mascara chave curta', async () => {
    await expect(definirChave('   ')).rejects.toMatchObject({ codigo: 'CHAVE_VAZIA' });
    expect(mascararChave('abc')).toBe('••••••••');
  });
  it('config genérica com padrão; não aceita a chave por aqui', async () => {
    expect(await obterConfig('pausa', 5)).toBe(5);
    await definirConfig('pausa', 8);
    expect(await obterConfig('pausa', 5)).toBe(8);
    await expect(definirConfig('chaveApi', 'x')).rejects.toThrow();
  });
});

describe('chave da Tavily', () => {
  it('é independente da chave do Gemini: adiciona, altera, mascara e remove', async () => {
    expect(await obterChaveTavily()).toBeNull();
    await definirChave('AIzaGemini');
    await definirChaveTavily('  tvly-abc123  ');
    expect(await obterChaveTavily()).toBe('tvly-abc123');
    expect(await obterChaveTavilyMascarada()).toBe('tvly••••••••');
    await definirChaveTavily('tvly-outra');
    expect(await obterChaveTavily()).toBe('tvly-outra');
    await removerChaveTavily();
    expect(await obterChaveTavily()).toBeNull();
    expect(await obterChave()).toBe('AIzaGemini'); // a do Gemini não foi afetada
  });
  it('rejeita chave vazia e não é aceita pela config genérica', async () => {
    await expect(definirChaveTavily('  ')).rejects.toMatchObject({ codigo: 'CHAVE_VAZIA' });
    await expect(definirConfig('chaveTavily', 'x')).rejects.toThrow();
  });
});

describe('tags', () => {
  it('cria ancestrais, é idempotente e ignora diferença de caixa', async () => {
    const r = await tags.adicionar('Mat::Geometria::Plana');
    expect(r.criados).toEqual(['Mat', 'Mat::Geometria', 'Mat::Geometria::Plana']);
    expect((await tags.adicionar('mat::geometria')).criados).toEqual([]);
    const r2 = await tags.adicionar('MAT::Álgebra');
    expect(r2.caminho).toBe('Mat::Álgebra'); // reaproveita a caixa do pai existente
    expect(await tags.listar()).toEqual(['Mat', 'Mat::Álgebra', 'Mat::Geometria', 'Mat::Geometria::Plana']);
  });
  it('busca devolve achados com seus ancestrais', async () => {
    await tags.adicionar('Mat::Geometria::Plana');
    await tags.adicionar('Fis');
    expect(await tags.buscar('plana')).toEqual(['Mat', 'Mat::Geometria', 'Mat::Geometria::Plana']);
  });
  it('apagar tag com filhos pede confirmação e depois remove dos cartões', async () => {
    await tags.adicionar('Mat::Geometria');
    await tags.adicionar('Fis');
    await db.cartoes.add(cartao({ id: 'c1', tags: ['Mat::Geometria', 'Fis'] }));

    await expect(tags.remover(['Mat'])).rejects.toMatchObject({
      codigo: 'CONFIRMACAO_NECESSARIA', detalhes: ['Mat::Geometria'],
    });
    expect(await tags.listar()).toHaveLength(3); // nada foi apagado

    const apagadas = await tags.remover(['Mat'], { confirmarFilhos: true });
    expect(apagadas.sort()).toEqual(['Mat', 'Mat::Geometria']);
    expect(await tags.listar()).toEqual(['Fis']);
    expect((await db.cartoes.get('c1'))!.tags).toEqual(['Fis']);
  });
  it('apagar folha não pede confirmação', async () => {
    await tags.adicionar('A::B');
    await tags.remover(['A::B']);
    expect(await tags.listar()).toEqual(['A']);
  });
});

describe('baralhos', () => {
  it('limita a 2 níveis', async () => {
    await baralhos.adicionar('Faculdade::Sinais');
    await expect(baralhos.adicionar('A::B::C')).rejects.toMatchObject({ codigo: 'NIVEL_EXCEDIDO' });
    expect(await baralhos.listar()).toEqual(['Faculdade', 'Faculdade::Sinais']);
  });
  it('não apaga baralho usado por grupo (nem pelo pai)', async () => {
    await baralhos.adicionar('Faculdade::Sinais');
    await db.grupos.add({ id: 'g1', nome: 'Laplace', baralho: 'Faculdade::Sinais', criadoEm: 1 });
    await expect(baralhos.remover(['Faculdade::Sinais'])).rejects.toMatchObject({
      codigo: 'BARALHO_EM_USO', detalhes: ['Laplace'],
    });
    await expect(baralhos.remover(['Faculdade'], { confirmarFilhos: true })).rejects.toMatchObject({
      codigo: 'BARALHO_EM_USO',
    });
    expect(await baralhos.listar()).toHaveLength(2);
    await db.grupos.delete('g1');
    await baralhos.remover(['Faculdade'], { confirmarFilhos: true });
    expect(await baralhos.listar()).toEqual([]);
  });
});
