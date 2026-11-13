import type { ModeloCartao } from '../db';

export const mensagemDeErro = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export const ROTULO_MODELO: Record<ModeloCartao, string> = {
  definicao: '1 · Definição',
  definicoes_multiplas: '2 · Definições múltiplas',
  demonstracao_pura: '3 · Demonstração pura',
  demonstracao_raciocinio: '4 · Demonstração com raciocínio',
};
