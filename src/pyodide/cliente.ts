/** Lado React: fala com o Worker por mensagens e expõe funções com Promise. */
import type { ArgsProcessar, CartaoPronto, FaseCarga, InfoPython, ResultadoProcessamento } from './nucleo';
import type { EventoStatus, Requisicao, Resposta } from './protocolo';

type Ouvinte = (fase: FaseCarga) => void;
type DistributivoOmit<T, K extends keyof any> = T extends unknown ? Omit<T, K> : never;

export class ClientePython {
  private worker: Worker | null = null;
  private proximoId = 1;
  private pendentes = new Map<number, { ok: (v: any) => void; falha: (e: Error) => void }>();
  private ouvintes = new Set<Ouvinte>();
  /** Última fase conhecida; "pronto" quando o Pyodide terminou de carregar. */
  fase: FaseCarga | null = null;

  /** Para mostrar "preparando exportação" na interface. Devolve a função de cancelar. */
  aoMudarFase(fn: Ouvinte): () => void {
    this.ouvintes.add(fn);
    return () => this.ouvintes.delete(fn);
  }

  private garantirWorker(): Worker {
    if (this.worker) return this.worker;
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (ev: MessageEvent<Resposta | EventoStatus>) => {
      const m = ev.data;
      if ('tipo' in m && m.tipo === 'status') {
        this.fase = m.fase;
        this.ouvintes.forEach((f) => f(m.fase));
        return;
      }
      const r = m as Resposta;
      const p = this.pendentes.get(r.id);
      if (!p) return;
      this.pendentes.delete(r.id);
      r.ok ? p.ok(r.resultado) : p.falha(new Error(r.erro));
    };
    w.onerror = (e) => {
      const erro = new Error(`Erro no Worker do Python: ${e.message}`);
      this.pendentes.forEach((p) => p.falha(erro));
      this.pendentes.clear();
    };
    this.worker = w;
    return w;
  }

  private chamar<T>(req: DistributivoOmit<Requisicao, 'id'>): Promise<T> {
    const id = this.proximoId++;
    return new Promise<T>((ok, falha) => {
      this.pendentes.set(id, { ok, falha });
      this.garantirWorker().postMessage({ ...req, id });
    });
  }

  /** Começa a carregar o Pyodide (pode ser chamado ao abrir o app, para a exportação ficar pronta). */
  iniciar(): Promise<void> {
    return this.chamar<null>({ tipo: 'iniciar' }).then(() => undefined);
  }

  info(): Promise<InfoPython> {
    return this.chamar({ tipo: 'info' });
  }

  processar(args: ArgsProcessar): Promise<ResultadoProcessamento> {
    return this.chamar({ tipo: 'processar', args });
  }

  /** Gera o .apkg e devolve o Blob para download. Exige pelo menos 1 cartão. */
  async gerarApkg(cartoes: CartaoPronto[]): Promise<Blob> {
    if (!cartoes.length) throw new Error('Nenhum cartão pronto para exportar.');
    const bytes = await this.chamar<Uint8Array>({ tipo: 'gerar_apkg', cartoes });
    return new Blob([bytes as BlobPart], { type: 'application/octet-stream' });
  }
}

export const python = new ClientePython();
