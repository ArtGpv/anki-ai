/** Ligação da interface com o Worker do Pyodide: início único, fase de carregamento e atalhos de serviço. */
import { useEffect, useState } from 'react';
import { baixarArquivo, criarServicoEnvio, exportarGrupo } from '../services';
import { python } from '../pyodide/cliente';
import type { FaseCarga } from '../pyodide/nucleo';
import { mensagemDeErro } from './util';

export { python };
export const envio = criarServicoEnvio(python);

let iniciado: Promise<void> | null = null;
export function iniciarPython(): Promise<void> {
  iniciado ??= python.iniciar().catch((e) => {
    iniciado = null; // permite tentar de novo
    throw e;
  });
  return iniciado;
}

/** "Preparando exportação" enquanto o Pyodide carrega pela primeira vez. */
export function usePython(): { pronto: boolean; fase: FaseCarga | null; erro: string | null } {
  const [fase, setFase] = useState<FaseCarga | null>(python.fase);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    const sair = python.aoMudarFase(setFase);
    iniciarPython().then(() => setErro(null), (e) => setErro(mensagemDeErro(e)));
    return sair;
  }, []);
  return { pronto: fase === 'pronto', fase, erro };
}

/** Gera o .apkg do grupo e dispara o download. */
export async function exportarEBaixar(grupoId: string) {
  const r = await exportarGrupo(grupoId, python);
  baixarArquivo(r.blob, r.nomeArquivo);
  return r;
}

export function textoExportacao(r: { exportados: number; ignorados: number }): string {
  const base = `.apkg baixado com ${r.exportados} cartão(ões).`;
  return r.ignorados ? `${base}\n${r.ignorados} ficaram de fora por não estarem prontos.` : base;
}
