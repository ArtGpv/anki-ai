import { useId, useState } from 'react';
import type { Cartao } from '../db';
import { CamposCartao } from './CamposCartao';
import { CartaoHtml } from './CartaoHtml';
import { TAG_IMAGEM_PENDENTE, TAG_MODELO_INCERTO, tagsDoCartao } from './util-cartao';

type Aba = 'cartao' | 'front' | 'back' | 'campos';

const ABAS: { id: Aba; nome: string }[] = [
  { id: 'cartao', nome: 'Cartão' },
  { id: 'front', nome: 'Front' },
  { id: 'back', nome: 'Back' },
  { id: 'campos', nome: 'Campos' },
];

export interface PreviewCartaoProps {
  cartao: Cartao;
  /** Caminho do baralho do grupo (ex.: "Faculdade::Sinais"). */
  baralho: string;
  /** Regera mantendo o input base; `instrucaoExtra` é opcional (ex.: "mais curto"). */
  onRegerar: (instrucaoExtra?: string) => void | Promise<void>;
  /** true enquanto o cartão está sendo regerado (bloqueia o botão). */
  regerando?: boolean;
  onFechar?: () => void;
}

/** Tags automáticas do código recebem destaque para o usuário notar que há pendência. */
const classeTag = (t: string) =>
  t === TAG_IMAGEM_PENDENTE || t === TAG_MODELO_INCERTO
    ? 'bg-amber-200/15 text-amber-200 border-amber-200/40'
    : 'bg-neutral-600 text-neutral-100 border-neutral-500';

export function PreviewCartao({ cartao, baralho, onRegerar, regerando = false, onFechar }: PreviewCartaoProps) {
  const [aba, setAba] = useState<Aba>('cartao');
  const [pedindo, setPedindo] = useState(false);
  const [instrucao, setInstrucao] = useState('');
  const idInstrucao = useId();

  const ocupado = regerando || cartao.estado === 'enviando';
  const temConteudo = cartao.front !== null && cartao.back !== null;
  const tags = tagsDoCartao(cartao);

  async function confirmarRegerar() {
    const extra = instrucao.trim();
    setPedindo(false);
    setInstrucao('');
    await onRegerar(extra || undefined);
  }

  return (
    <section
      aria-label="Pré-visualização do cartão"
      className="flex max-h-full flex-col overflow-hidden rounded-lg bg-[#474747] text-neutral-100 shadow-xl"
    >
      <header className="flex items-center justify-between bg-[#555555] px-4 py-3">
        <h2 className="text-base font-medium">Pré-visualização</h2>
        {onFechar && (
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar pré-visualização"
            className="rounded px-2 text-xl leading-none text-neutral-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
          >
            ×
          </button>
        )}
      </header>

      <div role="tablist" aria-label="O que ver" className="flex gap-1 border-b border-neutral-600 px-3 pt-2">
        {ABAS.map((a) => (
          <button
            key={a.id}
            role="tab"
            type="button"
            aria-selected={aba === a.id}
            onClick={() => setAba(a.id)}
            className={[
              'rounded-t-md px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400',
              aba === a.id ? 'bg-[#3b3b3b] text-white' : 'text-neutral-300 hover:text-white',
            ].join(' ')}
          >
            {a.nome}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div role="tabpanel" className="bg-[#3b3b3b] px-5 py-4">
          {cartao.estado === 'enviando' && <p className="mb-3 text-sm text-sky-300">Gerando o cartão…</p>}

          {cartao.estado === 'erro' && cartao.mensagemErro && (
            <p role="alert" className="mb-3 whitespace-pre-line rounded-md border border-red-300/40 bg-red-300/10 px-3 py-2 text-sm text-red-200">
              {cartao.mensagemErro}
            </p>
          )}

          {aba === 'campos' ? (
            <CamposCartao json={cartao.json} />
          ) : !temConteudo ? (
            <p className="text-sm text-neutral-400">
              Este cartão ainda não foi gerado. Envie o grupo ou use Regerar.
            </p>
          ) : (
            <>
              {(aba === 'cartao' || aba === 'front') && <CartaoHtml html={cartao.front!} />}
              {aba === 'cartao' && <hr className="my-4 border-neutral-500" />}
              {(aba === 'cartao' || aba === 'back') && <CartaoHtml html={cartao.back!} />}
            </>
          )}
        </div>

        <dl className="space-y-3 px-5 py-4 text-sm">
          <div>
            <dt className="text-xs text-neutral-400">Baralho</dt>
            <dd className="mt-0.5 break-words">{baralho}</dd>
          </div>

          <div>
            <dt className="text-xs text-neutral-400">Tags</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {tags.length === 0 && <span className="text-neutral-400">Sem tags</span>}
              {tags.map((t) => (
                <span key={t} className={`rounded-full border px-2.5 py-0.5 text-xs ${classeTag(t)}`}>
                  {t}
                </span>
              ))}
            </dd>
          </div>

          <div>
            <dt className="text-xs text-neutral-400">Fontes</dt>
            <dd className="mt-1">
              {cartao.fontes.length === 0 ? (
                <span className="text-neutral-400">Nenhuma fonte registrada</span>
              ) : (
                <ul className="space-y-1">
                  {cartao.fontes.map((f) => (
                    <li key={f.url} className="truncate">
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        title={f.titulo}
                        className="text-sky-300 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
                      >
                        {f.titulo}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
        </dl>
      </div>

      <footer className="border-t border-neutral-600 bg-[#4f4f4f] px-4 py-3">
        {pedindo ? (
          <div className="space-y-2">
            <label htmlFor={idInstrucao} className="block text-sm text-neutral-200">
              Instrução extra (opcional)
            </label>
            <textarea
              id={idInstrucao}
              value={instrucao}
              onChange={(e) => setInstrucao(e.target.value)}
              rows={2}
              placeholder="Ex.: mais curto; inclua um exemplo"
              className="w-full resize-none rounded-md border border-neutral-500 bg-[#3b3b3b] px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-400 focus:border-sky-400 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPedindo(false);
                  setInstrucao('');
                }}
                className="rounded-md px-3 py-1.5 text-sm text-sky-300 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarRegerar}
                className="rounded-md bg-sky-500 px-4 py-1.5 text-sm font-medium text-neutral-900 hover:bg-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
              >
                Regerar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => setPedindo(true)}
            className="w-full rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
          >
            {ocupado ? 'Gerando…' : 'Regerar'}
          </button>
        )}
      </footer>
    </section>
  );
}
