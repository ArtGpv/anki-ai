import { useId, useState } from 'react';
import { Modal } from '../componentes/Modal';

/** Regerar mantém o input base; a instrução extra é opcional (ex.: "mais curto", "inclua um exemplo"). */
export function ModalRegerar({ aoConfirmar, aoCancelar }: { aoConfirmar: (instrucao?: string) => void; aoCancelar: () => void }) {
  const [instrucao, setInstrucao] = useState('');
  const id = useId();
  return (
    <Modal
      titulo="Regerar cartão"
      aoFechar={aoCancelar}
      rodape={
        <>
          <button type="button" className="btn btn-texto" onClick={aoCancelar}>Cancelar</button>
          <button type="button" className="btn btn-texto" onClick={() => aoConfirmar(instrucao.trim() || undefined)}>Regerar</button>
        </>
      }
    >
      <div className="space-y-2 px-4 py-4">
        <label htmlFor={id} className="rotulo">Instrução extra (opcional)</label>
        <textarea id={id} autoFocus rows={3} className="campo resize-none" value={instrucao} onChange={(e) => setInstrucao(e.target.value)} placeholder="Ex.: mais curto; inclua um exemplo" />
        <p className="text-xs text-[var(--texto-suave)]">O texto base do cartão não muda.</p>
      </div>
    </Modal>
  );
}
