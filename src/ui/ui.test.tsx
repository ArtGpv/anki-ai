// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { baralhos, db, tags } from '../db';
import { reservarBuscaTavily } from '../ia';
import { criarCartao, criarGrupo, lerConfiguracoes, salvarConfiguracoes } from '../services';
import { CONFIG_TAGS, ModalArvore } from './modais/ModalArvore';
import { Configuracoes } from './telas/Configuracoes';
import { Dashboard } from './telas/Dashboard';
import { ProvedorToast } from './toast';

// Evita criar o Worker do Pyodide nos testes de tela.
vi.mock('./python', () => ({
  exportarEBaixar: vi.fn(),
  textoExportacao: vi.fn(() => 'ok'),
}));

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});
afterEach(cleanup);

describe('ModalArvore (Tags)', () => {
  it('adiciona uma tag com ancestrais, seleciona e confirma', async () => {
    const user = userEvent.setup();
    const aoConfirmar = vi.fn();
    render(<ModalArvore config={CONFIG_TAGS} inicial={[]} aoConfirmar={aoConfirmar} aoCancelar={() => {}} />);

    await user.click(screen.getByLabelText('Adicionar'));
    await user.type(screen.getByLabelText('Novo item'), 'Mat::Geometria{Enter}');

    const caixa = (await screen.findByLabelText('Selecionar Mat::Geometria')) as HTMLInputElement;
    expect(caixa.checked).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(aoConfirmar).toHaveBeenCalledWith(['Mat::Geometria']);
  });

  it('apagar um item com filhos pede confirmação e apaga os filhos', async () => {
    const user = userEvent.setup();
    await tags.adicionar('A::B');
    render(<ModalArvore config={CONFIG_TAGS} inicial={[]} aoConfirmar={() => {}} aoCancelar={() => {}} />);

    await user.click(await screen.findByLabelText('Selecionar A'));
    await user.click(screen.getByLabelText('Apagar selecionados'));
    expect(await screen.findByText(/filhos abaixo também serão apagados/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Apagar' }));

    await waitFor(async () => expect(await tags.listar()).toEqual([]));
  });

  it('filtra pela busca e mostra os ancestrais do achado', async () => {
    const user = userEvent.setup();
    await tags.adicionar('Mat::Geometria::Plana');
    await tags.adicionar('Fis');
    render(<ModalArvore config={CONFIG_TAGS} inicial={[]} aoConfirmar={() => {}} aoCancelar={() => {}} />);

    await user.click(screen.getByLabelText('Buscar'));
    await user.type(screen.getByLabelText('Filtrar'), 'plana');
    expect(await screen.findByLabelText('Selecionar Mat::Geometria::Plana')).toBeTruthy();
    await waitFor(() => expect(screen.queryByLabelText('Selecionar Fis')).toBeNull());
  });
});

describe('Dashboard', () => {
  it('estado vazio, depois cards com a ação direta de cada estado (+ e ↓)', async () => {
    render(<ProvedorToast><Dashboard /></ProvedorToast>);
    expect(await screen.findByText(/Nenhum grupo formado/)).toBeTruthy();

    await baralhos.adicionar('Faculdade');
    const g = await criarGrupo({ nome: 'Sinais', baralho: 'Faculdade' });
    const c = await criarCartao({ grupoId: g.id, modo: 'A', inputBase: 'defina x' });
    expect(await screen.findByLabelText('Adicionar cartão em Sinais')).toBeTruthy();
    expect(screen.queryByText(/Nenhum grupo formado/)).toBeNull();

    await db.cartoes.update(c.id, { estado: 'pronto' });
    expect(await screen.findByLabelText('Baixar .apkg de Sinais')).toBeTruthy();
  });

  it('mostra o contador de prontos quando há erro', async () => {
    await baralhos.adicionar('Faculdade');
    const g = await criarGrupo({ nome: 'Laplace', baralho: 'Faculdade' });
    const a = await criarCartao({ grupoId: g.id, modo: 'A', inputBase: 'a' });
    const b = await criarCartao({ grupoId: g.id, modo: 'A', inputBase: 'b' });
    await db.cartoes.update(a.id, { estado: 'pronto' });
    await db.cartoes.update(b.id, { estado: 'erro' });
    render(<ProvedorToast><Dashboard /></ProvedorToast>);
    expect(await screen.findByLabelText('1 de 2 prontos')).toBeTruthy();
  });

  it('o botão flutuante abre a modal de criação de grupo', async () => {
    const user = userEvent.setup();
    render(<ProvedorToast><Dashboard /></ProvedorToast>);
    await user.click(await screen.findByLabelText('Criar grupo'));
    expect(await screen.findByRole('dialog', { name: 'Novo grupo' })).toBeTruthy();
  });
});

describe('Configurações (Tavily)', () => {
  const abrir = () => render(<ProvedorToast><Configuracoes /></ProvedorToast>);

  it('salva a chave da Tavily mascarada e remove com confirmação', async () => {
    const user = userEvent.setup();
    abrir();
    expect(await screen.findByText('Nenhuma chave da Tavily salva.')).toBeTruthy();
    await user.type(screen.getByLabelText('Adicionar chave da Tavily'), 'tvly-abc123');
    await user.click(screen.getByRole('button', { name: 'Salvar chave da Tavily' }));
    expect(await screen.findByText('tvly••••••••')).toBeTruthy();
    expect(screen.queryByText('tvly-abc123')).toBeNull(); // nunca mostra a chave inteira

    await user.click(screen.getByRole('button', { name: 'Remover chave da Tavily' }));
    await user.click(await screen.findByRole('button', { name: 'Remover' }));
    expect(await screen.findByText('Nenhuma chave da Tavily salva.')).toBeTruthy();
  });

  it('o checkbox de pesquisa avançada grava a configuração', async () => {
    const user = userEvent.setup();
    abrir();
    const caixa = (await screen.findByLabelText(/Usar pesquisa avançada/)) as HTMLInputElement;
    await waitFor(() => expect(caixa.disabled).toBe(false));
    await user.click(caixa);
    await waitFor(async () => expect((await lerConfiguracoes()).tavilyAvancado).toBe(true));
  });

  it('avisa quando a pesquisa está ligada sem chave da Tavily', async () => {
    await salvarConfiguracoes({ buscaWeb: true });
    abrir();
    expect(await screen.findByText(/falta a chave da Tavily/)).toBeTruthy();
  });

  it('mostra o uso do mês e salva o limite mensal', async () => {
    const user = userEvent.setup();
    await reservarBuscaTavily(false); // 1 crédito
    abrir();
    expect(await screen.findByText('1 / 1000')).toBeTruthy();

    const campo = (await screen.findByLabelText('Limite mensal de créditos')) as HTMLInputElement;
    await user.clear(campo);
    await user.type(campo, '50');
    await user.click(screen.getByRole('button', { name: 'Salvar limite' }));
    await waitFor(async () => expect((await lerConfiguracoes()).limiteMensalTavily).toBe(50));
    expect(await screen.findByText('1 / 50')).toBeTruthy();
  });
});
