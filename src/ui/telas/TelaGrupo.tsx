import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useRef, useState } from 'react';
import { db, type Cartao } from '../../db';
import { ErroIA } from '../../ia';
import { buscarEmCartoes, listarCartoes, removerCartao, removerGrupo, resumirCartoes } from '../../services';
import { PreviewCartao } from '../../preview';
import { Confirmacao } from '../componentes/Confirmacao';
import { IconeBaixar, IconeGrampo, IconeLapis, IconeLixeira, IconeLupa, IconeMais, IconeOlho, IconeRegerar, IconeVoltar } from '../componentes/Icones';
import { Topbar } from '../componentes/Topbar';
import { filtroTags, useFiltroTags } from '../filtro';
import { CONFIG_TAGS, ModalArvore } from '../modais/ModalArvore';
import { ModalCartao } from '../modais/ModalCartao';
import { ModalRegerar } from '../modais/ModalRegerar';
import { envio, exportarEBaixar, textoExportacao, usePython } from '../python';
import { ir } from '../rota';
import { useToast } from '../toast';
import { mensagemDeErro, ROTULO_MODELO } from '../util';

const SELO: Record<Cartao['estado'], { texto: string; cor: string }> = {
  rascunho: { texto: 'Rascunho', cor: 'var(--amarelo)' },
  enviando: { texto: 'Gerando…', cor: 'var(--acento)' },
  pronto: { texto: 'Pronto', cor: 'var(--verde)' },
  erro: { texto: 'Erro', cor: 'var(--perigo)' },
};

/**
 * Subtela de cartões do grupo. Mostra a lista com as ações de cada estado:
 * rascunho (editar/excluir), erro (tentar de novo), pronto (ver/regerar/excluir).
 */
export function TelaGrupo({ id }: { id: string }) {
  const grupo = useLiveQuery(async () => (await db.grupos.get(id)) ?? null, [id]);
  const cartoes = useLiveQuery(() => listarCartoes(id), [id]);
  const tagsFiltro = useFiltroTags();
  const { avisar } = useToast();
  const { pronto: pyPronto, erro: pyErro } = usePython();

  const [texto, setTexto] = useState('');
  const [filtrarTags, setFiltrarTags] = useState(false);
  const [novoCartao, setNovoCartao] = useState(false);
  const [editando, setEditando] = useState<Cartao | null>(null);
  const [regerando, setRegerando] = useState<Cartao | null>(null);
  const [apagarCartao, setApagarCartao] = useState<Cartao | null>(null);
  const [apagarGrupo, setApagarGrupo] = useState(false);
  const [verId, setVerId] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const controle = useRef<AbortController | null>(null);

  const resumo = useMemo(() => resumirCartoes(cartoes ?? []), [cartoes]);
  const lista = useMemo(() => {
    if (!cartoes) return [];
    const r = buscarEmCartoes(cartoes, texto, { tags: tagsFiltro });
    return texto.trim() ? r : r.sort((a, b) => a.criadoEm - b.criadoEm); // sem busca: ordem de criação
  }, [cartoes, texto, tagsFiltro]);
  const verCartao = cartoes?.find((c) => c.id === verId) ?? null;
  const pendentes = resumo.rascunhos + resumo.erros;

  function tratarErro(e: unknown) {
    const chave = e instanceof ErroIA && (e.codigo === 'SEM_CHAVE' || e.codigo === 'CHAVE_INVALIDA');
    avisar(mensagemDeErro(e), { tipo: 'erro', acao: chave ? { rotulo: 'Configurações', aoClicar: () => ir('/config') } : undefined });
  }
  async function tratar(fn: () => Promise<unknown>) {
    try {
      await fn();
    } catch (e) {
      tratarErro(e);
    }
  }

  async function gerarGrupo() {
    const c = new AbortController();
    controle.current = c;
    setEnviando(true);
    try {
      const r = await envio.enviarGrupo(id, { sinal: c.signal });
      const { prontos, total, erros } = r.resumo;
      if (r.processados === 0) avisar('Nenhum cartão pendente para gerar.');
      else if (erros > 0) avisar(`${prontos}/${total} prontos. Veja os cartões com erro e use "Tentar de novo".`);
      else avisar('Todos os cartões foram gerados.', { tipo: 'ok' });
    } catch (e) {
      tratarErro(e);
    } finally {
      controle.current = null;
      setEnviando(false);
    }
  }

  const exportar = () =>
    tratar(async () => {
      const r = await exportarEBaixar(id);
      avisar(textoExportacao(r), { tipo: r.ignorados ? 'info' : 'ok' });
    });

  if (grupo === null) {
    return (
      <>
        <Topbar esquerda={<BotaoVoltar />} titulo="Grupo não encontrado" />
        <p className="p-6 text-center text-[var(--texto-suave)]">Este grupo não existe mais.</p>
      </>
    );
  }

  return (
    <>
      <Topbar
        esquerda={<BotaoVoltar />}
        titulo={grupo?.nome}
        subtitulo={grupo?.baralho}
        direita={
          <>
            <button type="button" className="icone-btn" disabled aria-label="Anexar arquivos" title="Anexar arquivos (Módulo 6, em breve)">
              <IconeGrampo />
            </button>
            {resumo.prontos > 0 && (
              <button
                type="button"
                className="icone-btn"
                aria-label="Exportar .apkg"
                title={pyPronto ? 'Exportar .apkg' : pyErro ? 'Falha ao preparar a exportação; clique para tentar' : 'Preparando exportação…'}
                disabled={!pyPronto && !pyErro}
                onClick={exportar}
              >
                <IconeBaixar />
              </button>
            )}
            <button type="button" className="icone-btn" aria-label="Apagar grupo" title="Apagar grupo" onClick={() => setApagarGrupo(true)}>
              <IconeLixeira />
            </button>
          </>
        }
      />

      <div className="flex min-h-0 flex-1">
        <main className="rolagem min-w-0 flex-1 px-4 py-4 pb-28">
          <div className="mx-auto max-w-3xl">
            {resumo.prontos > 0 && !pyPronto && !pyErro && (
              <p className="mb-3 text-xs text-[var(--texto-suave)]">Preparando exportação…</p>
            )}
            {pyErro && <p role="alert" className="mb-3 rounded-md bg-[var(--perigo-fundo)] px-3 py-2 text-xs text-[var(--perigo)]">Python/Pyodide não carregou: {pyErro}</p>}

            {cartoes && cartoes.length > 0 && (
              <div className="mb-4 space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <IconeLupa width={16} height={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--texto-suave)]" />
                    <input className="campo !pl-9" type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar nos cartões…" aria-label="Buscar nos cartões" />
                  </div>
                  <button type="button" className="btn btn-contorno" onClick={() => setFiltrarTags(true)}>
                    Tags{tagsFiltro.length ? ` (${tagsFiltro.length})` : ''}
                  </button>
                </div>
                {tagsFiltro.length > 0 && (
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--texto-suave)]">
                    Filtro:
                    {tagsFiltro.map((t) => <span key={t} className="rounded-full border border-[var(--borda)] px-2 py-0.5">{t}</span>)}
                    <button type="button" className="btn btn-texto btn-pequeno" onClick={() => filtroTags.definir([])}>Limpar</button>
                  </p>
                )}
              </div>
            )}

            {cartoes && cartoes.length === 0 && <p className="mt-16 text-center text-[var(--texto-suave)]">Adicione seu primeiro cartão</p>}
            {cartoes && cartoes.length > 0 && lista.length === 0 && <p className="mt-8 text-center text-[var(--texto-suave)]">Nenhum cartão encontrado.</p>}

            <ul className="space-y-3">
              {lista.map((c) => (
                <ItemCartao
                  key={c.id}
                  c={c}
                  aoVer={() => setVerId(c.id)}
                  aoEditar={() => setEditando(c)}
                  aoApagar={() => setApagarCartao(c)}
                  aoRegerar={() => setRegerando(c)}
                  aoTentar={() => tratar(() => envio.tentarDeNovo(c.id))}
                />
              ))}
            </ul>

            {pendentes > 0 && (
              <div className="mt-6 flex gap-2">
                <button type="button" className="btn btn-primario flex-1" disabled={enviando} onClick={gerarGrupo}>
                  {enviando ? `Gerando… (${resumo.prontos + resumo.erros}/${resumo.total})` : `Gerar grupo (${pendentes} pendente${pendentes > 1 ? 's' : ''})`}
                </button>
                {enviando && <button type="button" className="btn btn-contorno" onClick={() => controle.current?.abort()}>Cancelar</button>}
              </div>
            )}
          </div>
        </main>

        {verCartao && grupo && (
          <aside className="fixed inset-0 z-40 flex bg-black/60 p-3 lg:static lg:z-auto lg:w-[30rem] lg:shrink-0 lg:bg-transparent lg:p-4 lg:pl-0">
            <PreviewCartao
              cartao={verCartao}
              baralho={grupo.baralho}
              regerando={verCartao.estado === 'enviando'}
              onRegerar={(instr) => tratar(() => envio.regerar(verCartao.id, instr))}
              onFechar={() => setVerId(null)}
            />
          </aside>
        )}
      </div>

      {resumo.estado === 'rascunho' && (
        <button type="button" className="fab" style={{ background: 'var(--fab-amarelo)' }} aria-label="Adicionar cartão" onClick={() => setNovoCartao(true)}>
          <IconeMais width={28} height={28} />
        </button>
      )}

      {novoCartao && <ModalCartao grupoId={id} aoFechar={() => setNovoCartao(false)} />}
      {editando && <ModalCartao grupoId={id} cartao={editando} aoFechar={() => setEditando(null)} />}
      {regerando && (
        <ModalRegerar
          aoCancelar={() => setRegerando(null)}
          aoConfirmar={(instr) => {
            const alvo = regerando;
            setRegerando(null);
            tratar(() => envio.regerar(alvo.id, instr));
          }}
        />
      )}
      {filtrarTags && (
        <ModalArvore config={CONFIG_TAGS} inicial={tagsFiltro} aoCancelar={() => setFiltrarTags(false)} aoConfirmar={(s) => { filtroTags.definir(s); setFiltrarTags(false); }} />
      )}
      {apagarCartao && (
        <Confirmacao
          titulo="Excluir cartão"
          perigo
          rotuloConfirmar="Excluir"
          mensagem="Tem certeza que deseja excluir este cartão?"
          aoCancelar={() => setApagarCartao(null)}
          aoConfirmar={() => {
            const alvo = apagarCartao;
            setApagarCartao(null);
            if (verId === alvo.id) setVerId(null);
            tratar(() => removerCartao(alvo.id));
          }}
        />
      )}
      {apagarGrupo && (
        <Confirmacao
          titulo="Apagar grupo"
          perigo
          rotuloConfirmar="Confirmar"
          mensagem="Tem certeza que deseja apagar esse grupo? Os cartões nele serão apagados"
          aoCancelar={() => setApagarGrupo(false)}
          aoConfirmar={() =>
            tratar(async () => {
              await removerGrupo(id);
              setApagarGrupo(false);
              ir('/');
            }).finally(() => setApagarGrupo(false))
          }
        />
      )}
    </>
  );
}

function BotaoVoltar() {
  return (
    <button type="button" className="icone-btn" aria-label="Voltar" onClick={() => ir('/')}>
      <IconeVoltar />
    </button>
  );
}

interface ItemProps {
  c: Cartao;
  aoVer: () => void;
  aoEditar: () => void;
  aoApagar: () => void;
  aoRegerar: () => void;
  aoTentar: () => void;
}

function ItemCartao({ c, aoVer, aoEditar, aoApagar, aoRegerar, aoTentar }: ItemProps) {
  const selo = SELO[c.estado];
  const temConteudo = c.front !== null && c.back !== null;
  const ocupado = c.estado === 'enviando';
  const editavel = c.estado === 'rascunho' || c.estado === 'erro';
  return (
    <li className="rounded-xl border border-[var(--borda)] bg-[var(--card)] p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm" title={c.inputBase}>{c.inputBase}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--texto-suave)]">
            <span className="rounded-full border px-2 py-0.5" style={{ borderColor: selo.cor, color: selo.cor }}>{selo.texto}</span>
            <span>Modo {c.modo}{c.modelo ? ` · ${ROTULO_MODELO[c.modelo]}` : ''}</span>
            {c.tags.slice(0, 3).map((t) => <span key={t} className="max-w-[10rem] truncate rounded-full border border-[var(--borda)] px-2 py-0.5" title={t}>{t}</span>)}
            {c.tags.length > 3 && <span title={c.tags.slice(3).join(', ')}>+{c.tags.length - 3}</span>}
          </div>
          {c.estado === 'erro' && c.mensagemErro && (
            <p role="alert" className="mt-2 line-clamp-3 whitespace-pre-line text-xs text-[var(--perigo)]" title={c.mensagemErro}>{c.mensagemErro}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center">
          {temConteudo && !ocupado && (
            <button type="button" className="icone-btn icone-btn-p" aria-label="Ver cartão" title="Ver" onClick={aoVer}><IconeOlho width={18} height={18} /></button>
          )}
          {editavel && (
            <button type="button" className="icone-btn icone-btn-p" aria-label="Editar cartão" title="Editar" onClick={aoEditar}><IconeLapis width={18} height={18} /></button>
          )}
          {(c.estado === 'pronto' || (c.estado === 'erro' && temConteudo)) && (
            <button type="button" className="icone-btn icone-btn-p" aria-label="Regerar cartão" title="Regerar" onClick={aoRegerar}><IconeRegerar width={18} height={18} /></button>
          )}
          {!ocupado && (
            <button type="button" className="icone-btn icone-btn-p" aria-label="Excluir cartão" title="Excluir" onClick={aoApagar}><IconeLixeira width={18} height={18} /></button>
          )}
        </div>
      </div>
      {c.estado === 'erro' && (
        <button type="button" className="btn btn-contorno btn-pequeno mt-2" onClick={aoTentar}>Tentar de novo</button>
      )}
    </li>
  );
}
