/** Módulo 5 - Funções puras de apoio à pré-visualização: sanitização do HTML e tags finais. */
import type { Cartao } from '../db';

const TAGS_OK = new Set(['B', 'I', 'BR', 'UL', 'LI', 'SPAN']);
const TAGS_DESCARTADAS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED']);
/** O único style que o código gera é o do <destaque>: cor em rgb(...). */
const STYLE_DESTAQUE = /^color:\s*rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\);?$/;

/**
 * O HTML já vem validado pelo Python, mas a pré-visualização o injeta no DOM, então filtra de
 * novo: mantém só b, i, br, ul, li e o span do destaque; o resto vira texto. Requer DOM.
 */
export function sanitizarHtmlCartao(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');

  const limpar = (pai: Element) => {
    for (const filho of Array.from(pai.children)) {
      if (TAGS_DESCARTADAS.has(filho.tagName)) {
        filho.remove();
        continue;
      }
      if (!TAGS_OK.has(filho.tagName)) {
        filho.replaceWith(doc.createTextNode(filho.textContent ?? ''));
        continue;
      }
      for (const attr of Array.from(filho.attributes)) {
        const manter =
          filho.tagName === 'SPAN' && attr.name === 'style' && STYLE_DESTAQUE.test(attr.value.trim());
        if (!manter) filho.removeAttribute(attr.name);
      }
      limpar(filho);
    }
  };
  limpar(doc.body);
  return doc.body.innerHTML;
}

export const TAG_IMAGEM_PENDENTE = 'Imagem_pendente'; // igual a config.py
export const TAG_MODELO_INCERTO = 'modelo_incerto'; // igual a config.py

type Json = Record<string, unknown> | null | undefined;

/** Mesma regra de renderizador.tem_imagem (Python). */
export function temImagem(json: Json): boolean {
  if (!json) return false;
  if (json.imagem_pergunta || json.imagem_resposta) return true;
  const itens = json.itens;
  return Array.isArray(itens) && itens.some((it) => !!(it as { imagem?: unknown })?.imagem);
}

/** Tags que o cartão terá no .apkg: as escolhidas + Imagem_pendente + modelo_incerto (pipeline.py). */
export function tagsDoCartao(c: Pick<Cartao, 'tags' | 'json'>): string[] {
  const saida: string[] = [];
  for (const t of c.tags) {
    const limpa = t.trim().replace(/\s*::\s*/g, '::').replace(/\s+/g, '_');
    if (limpa && !saida.includes(limpa)) saida.push(limpa);
  }
  if (temImagem(c.json) && !saida.includes(TAG_IMAGEM_PENDENTE)) saida.push(TAG_IMAGEM_PENDENTE);
  if (c.json?.modelo_incerto === true && !saida.includes(TAG_MODELO_INCERTO)) saida.push(TAG_MODELO_INCERTO);
  return saida;
}
