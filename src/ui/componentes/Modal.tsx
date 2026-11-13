import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconeFechar } from './Icones';

export interface ModalProps {
  titulo?: string;
  /** Substitui o cabeçalho padrão (ex.: a barra com busca/+/lixeira das árvores). */
  cabecalho?: ReactNode;
  rodape?: ReactNode;
  aoFechar: () => void;
  largura?: string;
  alto?: boolean;
  children: ReactNode;
}

/** Diálogo acessível: foco entra ao abrir e volta ao fechar; Esc fecha só o diálogo do topo. */
export function Modal({ titulo, cabecalho, rodape, aoFechar, largura = 'sm:max-w-md', alto = false, children }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const idTitulo = useId();

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => anterior?.focus?.();
  }, []);

  function aoTeclar(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation(); // modais empilhados: o evento sobe pela árvore do React, mesmo com portal
      aoFechar();
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titulo ? idTitulo : undefined}
        tabIndex={-1}
        onKeyDown={aoTeclar}
        className={`flex max-h-[92dvh] w-full ${largura} ${alto ? 'h-[85dvh]' : ''} flex-col overflow-hidden rounded-t-2xl bg-[var(--modal)] text-[var(--texto)] shadow-2xl outline-none sm:rounded-xl`}
      >
        {cabecalho ?? (
          <header className="flex shrink-0 items-center justify-between bg-[var(--modal-topo)] px-4 py-2.5">
            <h2 id={idTitulo} className="text-base font-medium">{titulo}</h2>
            <button type="button" className="icone-btn icone-btn-p" onClick={aoFechar} aria-label="Fechar">
              <IconeFechar width={20} height={20} />
            </button>
          </header>
        )}
        <div className="rolagem min-h-0 flex-1">{children}</div>
        {rodape && <footer className="flex shrink-0 justify-end gap-2 border-t border-[var(--borda)] px-3 py-2">{rodape}</footer>}
      </div>
    </div>,
    document.body,
  );
}
