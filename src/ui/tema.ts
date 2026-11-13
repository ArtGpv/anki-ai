import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { lerConfiguracoes } from '../services';

/** Aplica data-tema="claro|escuro" no <html>; "sistema" acompanha o aparelho. */
export function useTemaGlobal(): void {
  const cfg = useLiveQuery(lerConfiguracoes, []);
  const tema = cfg?.tema ?? 'sistema';
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const aplicar = () => {
      document.documentElement.dataset.tema = tema === 'sistema' ? (mq.matches ? 'claro' : 'escuro') : tema;
    };
    aplicar();
    if (tema !== 'sistema') return;
    mq.addEventListener('change', aplicar);
    return () => mq.removeEventListener('change', aplicar);
  }, [tema]);
}
