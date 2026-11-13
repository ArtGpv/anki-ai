import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export type ItemDrawer = 'baralhos' | 'tags';

/** Menu lateral do hambúrguer: escolhe entre a modal de Baralhos e a de Tags. */
export function Drawer({ aoFechar, aoEscolher }: { aoFechar: () => void; aoEscolher: (i: ItemDrawer) => void }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    ref.current?.querySelector('button')?.focus();
    return () => anterior?.focus?.();
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-40 bg-black/50"
      onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}
      onKeyDown={(e) => e.key === 'Escape' && aoFechar()}
    >
      <nav ref={ref} aria-label="Menu" className="h-full w-64 max-w-[80vw] bg-[var(--topbar)] pt-3 text-[var(--texto)] shadow-2xl">
        {(['baralhos', 'tags'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => aoEscolher(item)}
            className="block w-full border-b border-[var(--divisor)] px-5 py-3.5 text-left text-base hover:bg-[var(--sel)]"
          >
            {item === 'baralhos' ? 'Baralhos' : 'Tags'}
          </button>
        ))}
      </nav>
    </div>,
    document.body,
  );
}
