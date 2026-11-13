/**
 * Modal única de árvore (Módulo 4, item 3): Tags (seleção múltipla, hierarquia ilimitada) e
 * Baralhos (seleção única, até 2 níveis). O que muda é só a configuração.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState, type FormEvent } from 'react';
import { ancestrais, baralhos, construirArvore, ErroPersistencia, tags, type NoArvore } from '../../db';
import { Confirmacao } from '../componentes/Confirmacao';
import { IconeLixeira, IconeLupa, IconeMais, IconeSeta } from '../componentes/Icones';
import { Modal } from '../componentes/Modal';
import { mensagemDeErro } from '../util';

export interface ConfigArvore {
  titulo: string;
  servico: typeof tags;
  multipla: boolean;
  vazio: string;
  exemploNovo: string;
}

export const CONFIG_TAGS: ConfigArvore = {
  titulo: 'Tags',
  servico: tags,
  multipla: true,
  vazio: 'Nenhuma tag criada. Use + para adicionar.',
  exemploNovo: 'Ex.: Cursos::Dados&R',
};
export const CONFIG_BARALHOS: ConfigArvore = {
  titulo: 'Baralhos',
  servico: baralhos,
  multipla: false,
  vazio: 'Nenhum baralho criado. Use + para adicionar.',
  exemploNovo: 'Ex.: Faculdade::Sinais (até 2 níveis)',
};

interface Props {
  config: ConfigArvore;
  /** Caminhos já selecionados ao abrir. */
  inicial: string[];
  aoConfirmar: (selecao: string[]) => void;
  aoCancelar: () => void;
}

export function ModalArvore({ config, inicial, aoConfirmar, aoCancelar }: Props) {
  const { servico, multipla, titulo } = config;
  const [selecao, setSelecao] = useState<string[]>(inicial);
  const [busca, setBusca] = useState('');
  const [mostrarBusca, setMostrarBusca] = useState(false);
  const [adicionando, setAdicionando] = useState(false);
  const [novo, setNovo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [expandidos, setExpandidos] = useState<Set<string>>(() => new Set(inicial.flatMap(ancestrais)));
  const [apagar, setApagar] = useState<{ selecionados: string[]; filhosExtras: string[] } | null>(null);
  const [apagando, setApagando] = useState(false);

  const caminhos = useLiveQuery(() => servico.buscar(busca), [servico, busca]);
  const raizes = useMemo(() => construirArvore(caminhos ?? []), [caminhos]);
  const buscando = busca.trim() !== '';

  function alternarSelecao(caminho: string) {
    setSelecao((s) => (s.includes(caminho) ? s.filter((x) => x !== caminho) : multipla ? [...s, caminho] : [caminho]));
  }
  function alternarExpansao(caminho: string) {
    setExpandidos((s) => {
      const n = new Set(s);
      n.has(caminho) ? n.delete(caminho) : n.add(caminho);
      return n;
    });
  }

  async function adicionar(ev: FormEvent) {
    ev.preventDefault();
    try {
      const { caminho } = await servico.adicionar(novo);
      setErro(null);
      setNovo('');
      setAdicionando(false);
      setExpandidos((s) => new Set([...s, ...ancestrais(caminho)]));
      setSelecao((s) => (multipla ? (s.includes(caminho) ? s : [...s, caminho]) : [caminho]));
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }

  async function pedirApagar() {
    const previa = await servico.previaRemocao(selecao);
    if (!previa.selecionados.length) return setSelecao([]);
    setApagar(previa);
  }

  async function confirmarApagar() {
    if (!apagar) return;
    setApagando(true);
    try {
      const apagados = await servico.remover(apagar.selecionados, { confirmarFilhos: true });
      setSelecao((s) => s.filter((x) => !apagados.includes(x)));
      setErro(null);
    } catch (e) {
      setErro(e instanceof ErroPersistencia && e.detalhes.length ? `${e.message} (${e.detalhes.join(', ')})` : mensagemDeErro(e));
    } finally {
      setApagando(false);
      setApagar(null);
    }
  }

  // Função de render (não componente): evita remontar as linhas a cada render e perder o foco.
  function renderLinha(no: NoArvore) {
    const temFilhos = no.filhos.length > 0;
    const aberto = buscando || expandidos.has(no.caminho);
    const marcado = selecao.includes(no.caminho);
    return (
      <li key={no.caminho}>
        <div className="flex items-center gap-1 rounded-md pr-2 hover:bg-[var(--sel)]" style={{ paddingLeft: (no.nivel - 1) * 20 + 4 }}>
          <button
            type="button"
            className="icone-btn icone-btn-p"
            style={{ visibility: temFilhos ? 'visible' : 'hidden' }}
            aria-label={aberto ? `Recolher ${no.nome}` : `Expandir ${no.nome}`}
            aria-expanded={aberto}
            tabIndex={temFilhos ? 0 : -1}
            onClick={() => alternarExpansao(no.caminho)}
          >
            <IconeSeta width={16} height={16} style={{ transform: aberto ? 'rotate(90deg)' : undefined }} />
          </button>
          <button
            type="button"
            className="min-w-0 flex-1 truncate py-2.5 text-left text-sm"
            title={no.caminho}
            onClick={() => (temFilhos ? alternarExpansao(no.caminho) : alternarSelecao(no.caminho))}
          >
            {no.nome}
          </button>
          <input
            type="checkbox"
            className="h-4 w-4 shrink-0"
            checked={marcado}
            onChange={() => alternarSelecao(no.caminho)}
            aria-label={`Selecionar ${no.caminho}`}
          />
        </div>
        {temFilhos && aberto && (
          <ul>{no.filhos.map(renderLinha)}</ul>
        )}
      </li>
    );
  }

  const cabecalho = (
    <header className="shrink-0 bg-[var(--modal-topo)]">
      <div className="flex items-center gap-1 px-4 py-1.5">
        <h2 className="flex-1 text-base font-medium">{titulo}</h2>
        <button type="button" className="icone-btn icone-btn-p" aria-label="Buscar" aria-pressed={mostrarBusca}
          onClick={() => { setMostrarBusca((v) => !v); if (mostrarBusca) setBusca(''); }}>
          <IconeLupa width={18} height={18} />
        </button>
        <button type="button" className="icone-btn icone-btn-p" aria-label="Adicionar" aria-pressed={adicionando}
          onClick={() => { setAdicionando((v) => !v); setErro(null); }}>
          <IconeMais width={18} height={18} />
        </button>
        <button type="button" className="icone-btn icone-btn-p" aria-label="Apagar selecionados" title="Apagar selecionados"
          disabled={selecao.length === 0} onClick={pedirApagar}>
          <IconeLixeira width={18} height={18} />
        </button>
      </div>
      {mostrarBusca && (
        <div className="px-4 pb-2">
          <input autoFocus className="campo" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar…" aria-label="Filtrar" />
        </div>
      )}
      {adicionando && (
        <form className="flex gap-2 px-4 pb-2" onSubmit={adicionar}>
          <input autoFocus className="campo" value={novo} onChange={(e) => setNovo(e.target.value)} placeholder={config.exemploNovo} aria-label="Novo item" />
          <button type="submit" className="btn btn-primario" disabled={!novo.trim()}>Adicionar</button>
        </form>
      )}
    </header>
  );

  return (
    <>
      <Modal
        cabecalho={cabecalho}
        aoFechar={aoCancelar}
        alto
        largura="sm:max-w-sm"
        rodape={
          <>
            <button type="button" className="btn btn-texto" onClick={aoCancelar}>Cancelar</button>
            <button type="button" className="btn btn-texto" onClick={() => aoConfirmar(selecao)}>Confirmar</button>
          </>
        }
      >
        {erro && <p role="alert" className="mx-3 mt-2 rounded-md bg-[var(--perigo-fundo)] px-3 py-2 text-xs text-[var(--perigo)]">{erro}</p>}
        <ul className="p-2" role="tree" aria-label={titulo}>
          {raizes.map(renderLinha)}
        </ul>
        {caminhos && caminhos.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-[var(--texto-suave)]">{buscando ? 'Nada encontrado.' : config.vazio}</p>
        )}
      </Modal>
      {apagar && (
        <Confirmacao
          titulo={`Apagar ${titulo.toLowerCase()}`}
          perigo
          ocupado={apagando}
          rotuloConfirmar="Apagar"
          aoCancelar={() => setApagar(null)}
          aoConfirmar={confirmarApagar}
          mensagem={
            <>
              <p>Apagar {apagar.selecionados.length} item(ns) selecionado(s)?</p>
              {apagar.filhosExtras.length > 0 && (
                <p className="mt-2">Os filhos abaixo também serão apagados: {apagar.filhosExtras.join(', ')}.</p>
              )}
              {multipla && <p className="mt-2 text-[var(--texto-suave)]">As tags apagadas também saem dos cartões.</p>}
            </>
          }
        />
      )}
    </>
  );
}
