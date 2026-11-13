/**
 * Módulo 5 - MathJax 3 hospedado junto do app (public/mathjax/tex-svg.js), para funcionar offline.
 * Saída SVG com fontCache "none": o arquivo é único e as fórmulas não dependem de fontes externas.
 * Delimitadores iguais aos do .apkg: \( \) (inline) e \[ \] (bloco).
 */

interface MathJaxGlobal {
  startup: { promise: Promise<void> };
  typesetPromise(els?: HTMLElement[]): Promise<void>;
  typesetClear?(els?: HTMLElement[]): void;
}

declare global {
  interface Window {
    MathJax?: unknown;
  }
}

let carregamento: Promise<MathJaxGlobal> | null = null;

export function carregarMathJax(): Promise<MathJaxGlobal> {
  carregamento ??= new Promise<MathJaxGlobal>((resolver, rejeitar) => {
    window.MathJax = {
      tex: {
        inlineMath: [['\\(', '\\)']],
        displayMath: [['\\[', '\\]']],
        processEscapes: true,
      },
      svg: { fontCache: 'none' },
      options: {
        enableMenu: false,
        skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
      },
      startup: { typeset: false },
    };
    const s = document.createElement('script');
    s.src = `${import.meta.env.BASE_URL}mathjax/tex-svg.js`;
    s.async = true;
    s.onload = () => {
      const mj = window.MathJax as MathJaxGlobal;
      mj.startup.promise.then(() => resolver(mj), rejeitar);
    };
    s.onerror = () => {
      carregamento = null; // permite tentar de novo
      rejeitar(new Error('Não foi possível carregar o MathJax. Rodou "npm run mathjax:preparar"?'));
    };
    document.head.appendChild(s);
  });
  return carregamento;
}

/** O MathJax pede para encadear as chamadas de typeset; esta fila garante uma por vez. */
let fila: Promise<unknown> = Promise.resolve();

export function renderizarFormulas(el: HTMLElement): Promise<void> {
  const tarefa = fila.then(async () => {
    const mj = await carregarMathJax();
    mj.typesetClear?.([el]);
    await mj.typesetPromise([el]);
  });
  fila = tarefa.catch(() => undefined);
  return tarefa;
}
