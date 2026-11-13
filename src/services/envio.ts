/**
 * Módulo 2 - Envio à IA (ciclo rascunho → enviando → pronto | erro).
 * A mecânica de cada cartão (Gemini, validação no Python, regeneração, fila) está em ../ia;
 * aqui entram as regras de serviço: travas, estados permitidos e recuperação após recarregar.
 */
import { db, type Cartao, type EstadoCartao } from '../db';
import {
  adaptarPython,
  criarDepsGeracao,
  enviarCartao as enviarCartaoIA,
  enviarGrupo as enviarGrupoIA,
  especificacaoMd,
  type OpcoesEnvio,
} from '../ia';
import type { ClientePython } from '../pyodide/cliente';
import { travarCartao, travarGrupo } from './bloqueio';
import { ErroServico } from './erros';
import { obterGrupo, obterResumoGrupo, type ResumoGrupo } from './grupos';

export type ExtrasEnvio = Partial<Omit<OpcoesEnvio, 'deps' | 'pausaMs'>>;

/**
 * Monta as opções reais (chave do IndexedDB, modelo e pausa das Configurações).
 * Lança ErroIA `SEM_CHAVE` se não houver chave, antes de mexer em qualquer cartão.
 */
export async function criarOpcoesEnvio(
  python: Pick<ClientePython, 'processar'>,
  extras: ExtrasEnvio = {},
): Promise<OpcoesEnvio> {
  const { deps, pausaMs } = await criarDepsGeracao(adaptarPython(python), especificacaoMd);
  return { deps, pausaMs, ...extras };
}

export interface ResultadoEnvioGrupo {
  /** Cartões que passaram pela fila (um erro global, como chave inválida, interrompe antes do fim). */
  processados: number;
  resumo: ResumoGrupo;
}

/** Envia os cartões `rascunho` e `erro` do grupo, em fila. Falha de um cartão não derruba os outros. */
export async function enviarGrupo(grupoId: string, op: OpcoesEnvio): Promise<ResultadoEnvioGrupo> {
  const liberar = travarGrupo(grupoId); // antes de qualquer await: dois cliques seguidos não passam juntos
  try {
    await obterGrupo(grupoId);
    const { processados } = await enviarGrupoIA(grupoId, op);
    return { processados, resumo: await obterResumoGrupo(grupoId) };
  } finally {
    liberar();
  }
}

async function enviarUm(
  cartaoId: string,
  op: OpcoesEnvio,
  permitidos: EstadoCartao[],
  instrucaoExtra?: string,
): Promise<Cartao> {
  const c = await db.cartoes.get(cartaoId);
  if (!c) throw new ErroServico('CARTAO_NAO_ENCONTRADO', 'Cartão não encontrado.');
  if (!permitidos.includes(c.estado)) {
    throw new ErroServico('ESTADO_INVALIDO', `Esta ação não vale para um cartão em estado "${c.estado}".`);
  }
  const liberar = travarCartao(c.id, c.grupoId);
  try {
    await enviarCartaoIA(cartaoId, op, instrucaoExtra?.trim() || undefined);
    return (await db.cartoes.get(cartaoId))!;
  } finally {
    liberar();
  }
}

/** Botão "Tentar de novo": reenvia só este cartão (o input pode ter sido editado antes). */
export const tentarDeNovo = (cartaoId: string, op: OpcoesEnvio): Promise<Cartao> =>
  enviarUm(cartaoId, op, ['erro', 'rascunho']);

/**
 * Regerar: mantém o input base e aceita instrução extra (ex.: "mais curto").
 * Se a nova geração falhar, o cartão vai para `erro`, mas guarda o conteúdo anterior em json/front/back.
 */
export const regerarCartao = (cartaoId: string, op: OpcoesEnvio, instrucaoExtra?: string): Promise<Cartao> =>
  enviarUm(cartaoId, op, ['pronto', 'erro'], instrucaoExtra);

/**
 * Chame ao abrir o app: cartões que ficaram `enviando` porque a página foi fechada ou recarregada
 * viram `erro`, com o botão "Tentar de novo". Devolve quantos foram corrigidos.
 */
export async function recuperarEnviosInterrompidos(): Promise<number> {
  return db.cartoes
    .where('estado')
    .equals('enviando')
    .modify({
      estado: 'erro',
      mensagemErro: 'Envio interrompido (a página foi fechada ou recarregada). Use "Tentar de novo".',
    });
}

/**
 * Atalho para a interface: guarda o cliente do Python e monta as opções a cada chamada
 * (assim a chave, o modelo e a pausa das Configurações valem na hora).
 */
export function criarServicoEnvio(python: Pick<ClientePython, 'processar'>) {
  return {
    enviarGrupo: async (grupoId: string, extras?: ExtrasEnvio) =>
      enviarGrupo(grupoId, await criarOpcoesEnvio(python, extras)),
    tentarDeNovo: async (cartaoId: string, extras?: ExtrasEnvio) =>
      tentarDeNovo(cartaoId, await criarOpcoesEnvio(python, extras)),
    regerar: async (cartaoId: string, instrucaoExtra?: string, extras?: ExtrasEnvio) =>
      regerarCartao(cartaoId, await criarOpcoesEnvio(python, extras), instrucaoExtra),
  };
}
