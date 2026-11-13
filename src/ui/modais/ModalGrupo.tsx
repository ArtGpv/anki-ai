import { useId, useState, type FormEvent } from 'react';
import type { Grupo } from '../../db';
import { criarGrupo } from '../../services';
import { Modal } from '../componentes/Modal';
import { mensagemDeErro } from '../util';
import { CONFIG_BARALHOS, ModalArvore } from './ModalArvore';

/** Criação de grupo: nome + baralho (escolhido na modal de Baralhos). */
export function ModalGrupo({ aoFechar, aoCriado }: { aoFechar: () => void; aoCriado?: (g: Grupo) => void }) {
  const [nome, setNome] = useState('');
  const [baralho, setBaralho] = useState<string | null>(null);
  const [escolher, setEscolher] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const idForm = useId();

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    if (!baralho) return setErro('Selecione um baralho.');
    setSalvando(true);
    try {
      const g = await criarGrupo({ nome, baralho });
      aoCriado?.(g);
      aoFechar();
    } catch (e) {
      setErro(mensagemDeErro(e));
      setSalvando(false);
    }
  }

  return (
    <>
      <Modal
        titulo="Novo grupo"
        aoFechar={aoFechar}
        rodape={
          <>
            <button type="button" className="btn btn-texto" onClick={aoFechar}>Cancelar</button>
            <button type="submit" form={idForm} className="btn btn-texto" disabled={salvando || !nome.trim() || !baralho}>Confirmar</button>
          </>
        }
      >
        <form id={idForm} onSubmit={enviar} className="space-y-4 px-4 py-4">
          <div>
            <label htmlFor={`${idForm}-nome`} className="rotulo">Nome do grupo</label>
            <input id={`${idForm}-nome`} autoFocus className="campo" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Transformada de Laplace" />
          </div>
          <div>
            <span className="rotulo">Baralho</span>
            <button type="button" className="campo text-left" onClick={() => setEscolher(true)}>
              {baralho ?? <span className="text-[var(--texto-suave)]">Selecionar baralho</span>}
            </button>
          </div>
          {erro && <p role="alert" className="rounded-md bg-[var(--perigo-fundo)] px-3 py-2 text-xs text-[var(--perigo)]">{erro}</p>}
        </form>
      </Modal>
      {escolher && (
        <ModalArvore
          config={CONFIG_BARALHOS}
          inicial={baralho ? [baralho] : []}
          aoCancelar={() => setEscolher(false)}
          aoConfirmar={(s) => { setBaralho(s[0] ?? null); setErro(null); setEscolher(false); }}
        />
      )}
    </>
  );
}
