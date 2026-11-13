/** Módulo 1 - Fila sequencial com pausa configurável entre cartões (plano gratuito). */

export interface ResultadoItem {
  /** false = o item não chamou a API (não precisa de pausa depois). Padrão: true. */
  chamouApi?: boolean;
  /** true = interrompe a fila (ex.: limite diário, chave inválida). */
  parar?: boolean;
}

export interface OpcoesFila {
  pausaMs: number;
  sinal?: AbortSignal;
  /** Injetável para testes. */
  esperar?: (ms: number, sinal?: AbortSignal) => Promise<void>;
}

export function esperarPadrao(ms: number, sinal?: AbortSignal): Promise<void> {
  return new Promise((resolver) => {
    if (sinal?.aborted) return resolver();
    const t = setTimeout(() => {
      sinal?.removeEventListener('abort', fim);
      resolver();
    }, ms);
    const fim = () => {
      clearTimeout(t);
      resolver();
    };
    sinal?.addEventListener('abort', fim, { once: true });
  });
}

/** Processa um item por vez; devolve quantos itens foram processados. */
export async function executarFila<T>(
  itens: T[],
  processar: (item: T, indice: number) => Promise<ResultadoItem | void>,
  { pausaMs, sinal, esperar = esperarPadrao }: OpcoesFila,
): Promise<number> {
  let feitos = 0;
  for (let i = 0; i < itens.length; i++) {
    if (sinal?.aborted) break;
    const r = (await processar(itens[i], i)) ?? {};
    feitos++;
    if (r.parar || sinal?.aborted) break;
    const ultimo = i === itens.length - 1;
    if (!ultimo && r.chamouApi !== false && pausaMs > 0) await esperar(pausaMs, sinal);
  }
  return feitos;
}
