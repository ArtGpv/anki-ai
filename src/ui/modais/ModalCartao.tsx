import { useId, useState, type FormEvent } from 'react';
import type { Cartao, ModeloCartao, ModoCartao } from '../../db';
import { criarCartao, editarCartao } from '../../services';
import { Modal } from '../componentes/Modal';
import { mensagemDeErro, ROTULO_MODELO } from '../util';
import { CONFIG_TAGS, ModalArvore } from './ModalArvore';

interface Props {
  grupoId: string;
  /** Se informado, edita este cartão (só rascunho ou erro). */
  cartao?: Cartao;
  aoFechar: () => void;
  aoSalvo?: (c: Cartao) => void;
}

/**
 * Modo A: o texto é o pedido à IA e o modelo fica bloqueado (a IA escolhe).
 * Modo B: o texto é o Front escrito e o modelo é obrigatório (a IA só cria o Back).
 */
export function ModalCartao({ grupoId, cartao, aoFechar, aoSalvo }: Props) {
  const [modo, setModo] = useState<ModoCartao>(cartao?.modo ?? 'A');
  const [texto, setTexto] = useState(cartao?.inputBase ?? '');
  const [modelo, setModelo] = useState<ModeloCartao | ''>(cartao?.modelo ?? '');
  const [tagsSel, setTagsSel] = useState<string[]>(cartao?.tags ?? []);
  const [escolherTags, setEscolherTags] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const idForm = useId();

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    if (modo === 'B' && !modelo) return setErro('No Modo B, escolha o modelo do cartão.');
    setSalvando(true);
    try {
      const m = modo === 'B' ? (modelo as ModeloCartao) : null;
      const salvo = cartao
        ? await editarCartao(cartao.id, { modo, inputBase: texto, modelo: m, tags: tagsSel })
        : await criarCartao({ grupoId, modo, inputBase: texto, modelo: m, tags: tagsSel });
      aoSalvo?.(salvo);
      aoFechar();
    } catch (e) {
      setErro(mensagemDeErro(e));
      setSalvando(false);
    }
  }

  const rotuloTexto = modo === 'A' ? 'Pedido para a IA' : 'Front do cartão';
  return (
    <>
      <Modal
        titulo={cartao ? 'Editar cartão' : 'Novo cartão'}
        aoFechar={aoFechar}
        rodape={
          <>
            <button type="button" className="btn btn-texto" onClick={aoFechar}>Cancelar</button>
            <button type="submit" form={idForm} className="btn btn-texto" disabled={salvando || !texto.trim()}>Confirmar</button>
          </>
        }
      >
        <form id={idForm} onSubmit={enviar} className="space-y-4 px-4 py-4">
          <div role="radiogroup" aria-label="Modo" className="grid grid-cols-2 gap-1 rounded-lg bg-[var(--campo)] p-1">
            {(['A', 'B'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={modo === m}
                onClick={() => setModo(m)}
                className={`rounded-md px-3 py-2 text-sm ${modo === m ? 'bg-[var(--botao)] font-medium text-[var(--botao-texto)]' : 'text-[var(--texto-suave)]'}`}
              >
                {m === 'A' ? 'Modo A · IA infere' : 'Modo B · Escrever Front'}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor={`${idForm}-texto`} className="rotulo">{rotuloTexto}</label>
            <textarea
              id={`${idForm}-texto`}
              autoFocus
              rows={6}
              className="campo resize-y"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={modo === 'A' ? 'Ex.: defina a transformada de Laplace' : 'Ex.: Em sinais e sistemas, defina a função sinc normalizada.'}
            />
            <p className="mt-1 text-xs text-[var(--texto-suave)]">
              {modo === 'A'
                ? 'A IA escolhe o modelo, pesquisa se precisar e escreve Front e Back. As tags ajudam a inferir o contexto.'
                : 'A IA só cria o Back. O contexto é só a frase que você escrever no início; as tags não o alteram.'}
            </p>
          </div>

          <div>
            <label htmlFor={`${idForm}-modelo`} className="rotulo">Modelo</label>
            <select id={`${idForm}-modelo`} className="campo" disabled={modo === 'A'} value={modo === 'A' ? '' : modelo} onChange={(e) => setModelo(e.target.value as ModeloCartao | '')}>
              <option value="">{modo === 'A' ? 'A IA escolhe o modelo' : 'Escolha o modelo…'}</option>
              {(Object.keys(ROTULO_MODELO) as ModeloCartao[]).map((k) => (
                <option key={k} value={k}>{ROTULO_MODELO[k]}</option>
              ))}
            </select>
          </div>

          <div>
            <span className="rotulo">Tags</span>
            <button type="button" className="campo flex min-h-[2.6rem] flex-wrap items-center gap-1.5 text-left" onClick={() => setEscolherTags(true)}>
              {tagsSel.length === 0 && <span className="text-[var(--texto-suave)]">Selecionar tags</span>}
              {tagsSel.map((t) => (
                <span key={t} className="rounded-full border border-[var(--borda)] px-2 py-0.5 text-xs">{t}</span>
              ))}
            </button>
          </div>

          {erro && <p role="alert" className="rounded-md bg-[var(--perigo-fundo)] px-3 py-2 text-xs text-[var(--perigo)]">{erro}</p>}
        </form>
      </Modal>
      {escolherTags && (
        <ModalArvore config={CONFIG_TAGS} inicial={tagsSel} aoCancelar={() => setEscolherTags(false)} aoConfirmar={(s) => { setTagsSel(s); setEscolherTags(false); }} />
      )}
    </>
  );
}
