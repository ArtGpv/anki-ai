import type { ReactNode } from 'react';

interface Props {
  esquerda?: ReactNode;
  titulo?: string;
  subtitulo?: string;
  direita?: ReactNode;
}

export function Topbar({ esquerda, titulo, subtitulo, direita }: Props) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-1 bg-[var(--topbar)] px-2 text-[var(--texto)] shadow-md">
      {esquerda}
      <div className="min-w-0 flex-1 px-2">
        {titulo && <h1 className="truncate text-base font-medium leading-tight" title={titulo}>{titulo}</h1>}
        {subtitulo && <p className="truncate text-xs text-[var(--texto-suave)]" title={subtitulo}>{subtitulo}</p>}
      </div>
      <div className="flex shrink-0 items-center">{direita}</div>
    </header>
  );
}
