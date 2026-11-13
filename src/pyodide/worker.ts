/// <reference lib="webworker" />
import { loadPyodide } from 'pyodide';
import { iniciarMotor, type Motor } from './nucleo';
import type { EventoStatus, Requisicao, Resposta } from './protocolo';

import apkg from '../../python/apkg.py?raw';
import config from '../../python/config.py?raw';
import pipeline from '../../python/pipeline.py?raw';
import ponte from '../../python/ponte.py?raw';
import renderizador from '../../python/renderizador.py?raw';
import texto from '../../python/texto.py?raw';
import validador from '../../python/validador.py?raw';

const base = new URL(`${import.meta.env.BASE_URL}pyodide/`, self.location.origin).href;

let motor: Promise<Motor> | null = null;
function obterMotor(): Promise<Motor> {
  motor ??= iniciarMotor({
    loadPyodide,
    indexURL: base,
    lerArquivo: async (rel) => {
      const r = await fetch(base + rel);
      if (!r.ok) throw new Error(`Falha ao carregar ${rel} (${r.status}). Rodou "npm run pyodide:preparar"?`);
      return new Uint8Array(await r.arrayBuffer());
    },
    modulos: { config, texto, validador, renderizador, apkg, pipeline, ponte },
    aoStatus: (fase) => self.postMessage({ tipo: 'status', fase } satisfies EventoStatus),
  }).catch((e) => {
    motor = null; // permite tentar de novo depois de uma falha (ex.: rede)
    throw e;
  });
  return motor;
}

self.onmessage = async (ev: MessageEvent<Requisicao>) => {
  const req = ev.data;
  try {
    const m = await obterMotor();
    switch (req.tipo) {
      case 'iniciar':
        return post({ id: req.id, ok: true, resultado: null });
      case 'info':
        return post({ id: req.id, ok: true, resultado: m.info() });
      case 'processar':
        return post({ id: req.id, ok: true, resultado: m.processar(req.args) });
      case 'gerar_apkg': {
        const bytes = m.gerarApkg(req.cartoes);
        return post({ id: req.id, ok: true, resultado: bytes }, [bytes.buffer]);
      }
    }
  } catch (e) {
    post({ id: req.id, ok: false, erro: e instanceof Error ? e.message : String(e) });
  }
};

function post(r: Resposta, transfer: Transferable[] = []) {
  self.postMessage(r, transfer);
}
