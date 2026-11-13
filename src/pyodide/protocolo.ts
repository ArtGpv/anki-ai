import type { ArgsProcessar, CartaoPronto, FaseCarga, InfoPython, ResultadoProcessamento } from './nucleo';

export type Requisicao =
  | { id: number; tipo: 'iniciar' }
  | { id: number; tipo: 'info' }
  | { id: number; tipo: 'processar'; args: ArgsProcessar }
  | { id: number; tipo: 'gerar_apkg'; cartoes: CartaoPronto[] };

export type Resposta =
  | { id: number; ok: true; resultado: InfoPython | ResultadoProcessamento | Uint8Array | null }
  | { id: number; ok: false; erro: string };

/** Mensagem espontânea do Worker (sem id): progresso do carregamento. */
export interface EventoStatus {
  tipo: 'status';
  fase: FaseCarga;
}
