// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { sanitizarHtmlCartao, tagsDoCartao, temImagem } from './util-cartao';

describe('sanitizarHtmlCartao', () => {
  it('mantém o HTML permitido e o destaque, com as fórmulas intactas', () => {
    const html =
      '<ul><li><span style="color: rgb(255, 255, 127);"><b>Termo</b></span>: \\(x&lt;y\\)</li></ul><br><i>ok</i>';
    expect(sanitizarHtmlCartao(html)).toBe(html);
  });
  it('remove script, atributos e tags desconhecidas', () => {
    const sujo = '<b onclick="x()">a</b><script>alert(1)</script><img src=x onerror=y><div>t</div><a href="u">l</a>';
    const limpo = sanitizarHtmlCartao(sujo);
    expect(limpo).toBe('<b>a</b>tl');
    expect(limpo).not.toMatch(/script|onerror|onclick|href/);
  });
  it('descarta style que não seja a cor do destaque', () => {
    expect(sanitizarHtmlCartao('<span style="position:fixed">x</span>')).toBe('<span>x</span>');
  });
});

describe('tagsDoCartao', () => {
  const base = { tags: ['Mat :: Geometria', 'Sinais e Sistemas'], json: null };
  it('normaliza espaços e mantém a hierarquia', () => {
    expect(tagsDoCartao(base)).toEqual(['Mat::Geometria', 'Sinais_e_Sistemas']);
  });
  it('acrescenta Imagem_pendente e modelo_incerto como o pipeline Python', () => {
    const json = { imagem_resposta: 'Imagem de x', modelo_incerto: true };
    expect(tagsDoCartao({ tags: [], json })).toEqual(['Imagem_pendente', 'modelo_incerto']);
  });
  it('detecta imagem nos itens do Modelo 2', () => {
    expect(temImagem({ itens: [{ imagem: null }, { imagem: 'Imagem de y' }] })).toBe(true);
    expect(temImagem({ itens: [{ imagem: null }] })).toBe(false);
  });
});
