/**
 * Controle, em memória, do que está sendo enviado à IA agora. Impede dois envios do mesmo grupo
 * ao mesmo tempo (duplo clique, duas abas não: o controle é por aba) e apagar um grupo em envio.
 */
import { ErroServico } from './erros';

const grupos = new Set<string>();
const cartoes = new Map<string, string>(); // cartaoId -> grupoId

export function grupoOcupado(grupoId: string): boolean {
  return grupos.has(grupoId) || [...cartoes.values()].includes(grupoId);
}

export function cartaoOcupado(cartaoId: string, grupoId: string): boolean {
  return cartoes.has(cartaoId) || grupos.has(grupoId);
}

/** Reserva o grupo inteiro. Devolve a função que libera (chame num `finally`). */
export function travarGrupo(grupoId: string): () => void {
  if (grupoOcupado(grupoId)) {
    throw new ErroServico('ENVIO_EM_ANDAMENTO', 'Este grupo já está sendo enviado. Aguarde terminar.');
  }
  grupos.add(grupoId);
  return () => void grupos.delete(grupoId);
}

export function travarCartao(cartaoId: string, grupoId: string): () => void {
  if (cartaoOcupado(cartaoId, grupoId)) {
    throw new ErroServico('ENVIO_EM_ANDAMENTO', 'Este cartão já está sendo enviado. Aguarde terminar.');
  }
  cartoes.set(cartaoId, grupoId);
  return () => void cartoes.delete(cartaoId);
}
