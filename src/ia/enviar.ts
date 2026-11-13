/** Módulo 1 - Envio de cartões salvos (Dexie) para a IA: estados, falha parcial e regerar. */
import { db, type EstadoCartao } from '../db';
import { CODIGOS_QUE_PARAM_A_FILA, ErroIA, traduzirErroApi } from './erros-ia';
import { gerarCartao, type DepsGeracao } from './geracao';
import { executarFila, type ResultadoItem } from './fila';
import type { ContextoArquivos } from './tipos-ia';

export interface OpcoesEnvio {
  deps: DepsGeracao;
  pausaMs: number;
  /** Módulo 6: devolve texto/imagens dos arquivos do grupo (null = Modo Web). */
  carregarArquivos?: (grupoId: string) => Promise<ContextoArquivos | null>;
  /** Para a interface atualizar o card em tempo real. */
  aoMudar?: (cartaoId: string, estado: EstadoCartao) => void;
  sinal?: AbortSignal;
}

/** Envia um cartão (usado por "Tentar de novo" e "Regerar"; o input base não muda). */
export async function enviarCartao(
  cartaoId: string,
  op: OpcoesEnvio,
  instrucaoExtra?: string,
): Promise<ResultadoItem> {
  const cartao = await db.cartoes.get(cartaoId);
  if (!cartao) return { chamouApi: false };
  const grupo = await db.grupos.get(cartao.grupoId);
  if (!grupo) return { chamouApi: false };

  const mudar = async (estado: EstadoCartao, extra: Record<string, unknown> = {}) => {
    await db.cartoes.update(cartaoId, { estado, ...extra });
    op.aoMudar?.(cartaoId, estado);
  };

  await mudar('enviando', { mensagemErro: null });
  try {
    const arquivos = (await op.carregarArquivos?.(grupo.id)) ?? null;
    const saida = await gerarCartao(
      {
        pedido: {
          modo: cartao.modo,
          texto: cartao.inputBase,
          tags: cartao.tags,
          modelo: cartao.modelo,
          instrucaoExtra,
          arquivos,
        },
        baralho: grupo.baralho,
      },
      { ...op.deps, sinal: op.sinal ?? op.deps.sinal },
    );
    const r = saida.resultado;
    if (r.ok && r.cartao) {
      await mudar('pronto', {
        mensagemErro: null,
        json: r.json,
        front: r.cartao.front,
        back: r.cartao.back,
        fontes: saida.fontes,
      });
    } else {
      const msg = r.mensagem ?? 'Não foi possível gerar um cartão válido.';
      await mudar('erro', { mensagemErro: r.erros.length ? `${msg}\n${r.erros.join('\n')}` : msg });
    }
    return {};
  } catch (e) {
    const err: ErroIA = traduzirErroApi(e);
    if (err.codigo === 'CANCELADO') {
      await mudar('rascunho', { mensagemErro: null });
    } else {
      await mudar('erro', { mensagemErro: err.message });
    }
    return { parar: CODIGOS_QUE_PARAM_A_FILA.includes(err.codigo) };
  }
}

/**
 * Envia o grupo: cartões `rascunho` ou `erro`, em ordem de criação, com pausa entre eles.
 * Falha de um cartão não derruba a fila; erros globais (chave, limite) interrompem e os
 * cartões restantes continuam em `rascunho`.
 */
export async function enviarGrupo(grupoId: string, op: OpcoesEnvio): Promise<{ processados: number }> {
  const pendentes = (await db.cartoes.where('grupoId').equals(grupoId).sortBy('criadoEm')).filter(
    (c) => c.estado === 'rascunho' || c.estado === 'erro',
  );
  const processados = await executarFila(pendentes, (c) => enviarCartao(c.id, op), {
    pausaMs: op.pausaMs,
    sinal: op.sinal,
  });
  return { processados };
}
