/** Filtro de tags aplicado à lista de cartões (Confirmar na modal de Tags aberta pelo menu lateral). */
import { useSyncExternalStore } from 'react';

let atual: string[] = [];
const ouvintes = new Set<() => void>();

export const filtroTags = {
  obter: () => atual,
  definir(tags: string[]) {
    atual = tags;
    ouvintes.forEach((f) => f());
  },
};
const assinar = (fn: () => void) => {
  ouvintes.add(fn);
  return () => void ouvintes.delete(fn);
};
export const useFiltroTags = (): string[] => useSyncExternalStore(assinar, filtroTags.obter);
