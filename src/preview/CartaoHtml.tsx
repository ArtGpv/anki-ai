import { useEffect, useRef, useState } from 'react';
import { renderizarFormulas } from './mathjax';
import { sanitizarHtmlCartao } from './util-cartao';

/**
 * Mostra o HTML de um lado do cartão (Front ou Back) e renderiza as fórmulas \( \) e \[ \].
 * O conteúdo é escrito direto no elemento (não via dangerouslySetInnerHTML) porque o MathJax
 * altera o DOM por dentro; assim o React não o sobrescreve.
 */
export function CartaoHtml({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [falhaFormulas, setFalhaFormulas] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let ativo = true;
    el.innerHTML = sanitizarHtmlCartao(html);
    setFalhaFormulas(null);
    renderizarFormulas(el).catch((e: unknown) => {
      if (ativo) setFalhaFormulas(e instanceof Error ? e.message : String(e));
    });
    return () => {
      ativo = false;
    };
  }, [html]);

  return (
    <>
      <div
        ref={ref}
        className={[
          'text-[17px] leading-relaxed text-neutral-100 break-words',
          '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-1 [&_li]:my-0.5',
          '[&_mjx-container]:max-w-full [&_mjx-container]:overflow-x-auto [&_mjx-container]:overflow-y-hidden',
          '[&_mjx-container[display=true]]:my-2',
        ].join(' ')}
      />
      {falhaFormulas && (
        <p role="alert" className="mt-2 text-xs text-amber-300">
          Fórmulas sem renderizar: {falhaFormulas}
        </p>
      )}
    </>
  );
}
