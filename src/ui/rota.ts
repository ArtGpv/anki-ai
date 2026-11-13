/** Roteador mínimo por hash (#/, #/grupo/:id, #/config): funciona no GitHub Pages sem configuração. */
import { useSyncExternalStore } from 'react';

const atual = () => window.location.hash.replace(/^#/, '') || '/';
const assinar = (fn: () => void) => {
  window.addEventListener('hashchange', fn);
  return () => window.removeEventListener('hashchange', fn);
};

export const useCaminho = (): string => useSyncExternalStore(assinar, atual, () => '/');
export const ir = (caminho: string): void => {
  window.location.hash = caminho;
};
