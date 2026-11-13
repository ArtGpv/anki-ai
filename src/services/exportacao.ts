/** Módulo 2 - Exportação: junta os cartões `pronto` do grupo em um único .apkg (genanki no Pyodide). */
import { db } from '../db';
import { tagsDoCartao } from '../preview/util-cartao';
import type { CartaoPronto } from '../pyodide/nucleo';
import type { ClientePython } from '../pyodide/cliente';
import { ErroServico } from './erros';
import { obterGrupo } from './grupos';

export interface ResultadoExportacao {
  blob: Blob;
  nomeArquivo: string;
  exportados: number;
  /** Cartões do grupo que ficaram de fora (rascunho, enviando ou erro): mostre um aviso. */
  ignorados: number;
}

/** "Sinais e Sistemas" -> "Sinais_e_Sistemas.apkg" (sem acentos nem caracteres problemáticos). */
export function nomeArquivoApkg(nomeGrupo: string): string {
  const base = nomeGrupo
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${base || 'cartoes'}.apkg`;
}

/** Exige pelo menos 1 cartão `pronto`. Tags = escolhidas + Imagem_pendente + modelo_incerto (como o pipeline Python). */
export async function exportarGrupo(
  grupoId: string,
  python: Pick<ClientePython, 'gerarApkg'>,
): Promise<ResultadoExportacao> {
  const grupo = await obterGrupo(grupoId);
  const todos = await db.cartoes.where('grupoId').equals(grupoId).sortBy('criadoEm');
  const prontos = todos.filter((c) => c.estado === 'pronto' && c.front !== null && c.back !== null);
  if (prontos.length === 0) {
    throw new ErroServico('SEM_CARTOES_PRONTOS', 'Nenhum cartão pronto para exportar. Gere os cartões primeiro.');
  }
  const cartoes: CartaoPronto[] = prontos.map((c) => ({
    baralho: grupo.baralho,
    front: c.front!,
    back: c.back!,
    tags: tagsDoCartao(c),
  }));
  const blob = await python.gerarApkg(cartoes);
  return {
    blob,
    nomeArquivo: nomeArquivoApkg(grupo.nome),
    exportados: prontos.length,
    ignorados: todos.length - prontos.length,
  };
}

/** Dispara o download no navegador (a interface chama depois de exportarGrupo). */
export function baixarArquivo(blob: Blob, nomeArquivo: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
