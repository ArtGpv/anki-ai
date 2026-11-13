import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

type Tipo = 'info' | 'ok' | 'erro';
interface Aviso {
  id: number;
  msg: string;
  tipo: Tipo;
  acao?: { rotulo: string; aoClicar: () => void };
}
interface Opcoes {
  tipo?: Tipo;
  acao?: Aviso['acao'];
}

const Ctx = createContext<{ avisar: (msg: string, op?: Opcoes) => void }>({ avisar: () => {} });
export const useToast = () => useContext(Ctx);

const COR: Record<Tipo, string> = { info: 'var(--acento)', ok: 'var(--verde)', erro: 'var(--perigo)' };

export function ProvedorToast({ children }: { children: ReactNode }) {
  const [lista, setLista] = useState<Aviso[]>([]);
  const proximo = useRef(1);
  const fechar = useCallback((id: number) => setLista((l) => l.filter((a) => a.id !== id)), []);
  const avisar = useCallback(
    (msg: string, op: Opcoes = {}) => {
      const id = proximo.current++;
      setLista((l) => [...l.slice(-2), { id, msg, tipo: op.tipo ?? 'info', acao: op.acao }]);
      setTimeout(() => fechar(id), op.tipo === 'erro' ? 9000 : 5000);
    },
    [fechar],
  );
  const valor = useMemo(() => ({ avisar }), [avisar]);

  return (
    <Ctx.Provider value={valor}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[100] flex flex-col items-center gap-2 px-4">
        {lista.map((a) => (
          <div
            key={a.id}
            role={a.tipo === 'erro' ? 'alert' : 'status'}
            style={{ borderLeftColor: COR[a.tipo] }}
            className="pointer-events-auto flex max-w-md items-center gap-3 rounded-lg border-l-4 bg-[var(--card-2)] px-4 py-3 text-sm text-[var(--texto)] shadow-lg"
          >
            <span className="min-w-0 flex-1 whitespace-pre-line break-words">{a.msg}</span>
            {a.acao && (
              <button type="button" className="btn btn-texto btn-pequeno" onClick={() => { a.acao!.aoClicar(); fechar(a.id); }}>
                {a.acao.rotulo}
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
