import type { ReactNode } from 'react';
import { Modal } from './Modal';

interface Props {
  titulo?: string;
  mensagem: ReactNode;
  rotuloConfirmar?: string;
  perigo?: boolean;
  ocupado?: boolean;
  aoConfirmar: () => void;
  aoCancelar: () => void;
}

export function Confirmacao({ titulo = 'Confirmar', mensagem, rotuloConfirmar = 'Confirmar', perigo, ocupado, aoConfirmar, aoCancelar }: Props) {
  return (
    <Modal
      titulo={titulo}
      aoFechar={aoCancelar}
      rodape={
        <>
          <button type="button" className="btn btn-texto" onClick={aoCancelar}>Cancelar</button>
          <button type="button" className={`btn btn-texto ${perigo ? 'btn-perigo' : ''}`} disabled={ocupado} onClick={aoConfirmar}>
            {rotuloConfirmar}
          </button>
        </>
      }
    >
      <div className="px-4 py-4 text-sm leading-relaxed">{mensagem}</div>
    </Modal>
  );
}
