"""Módulo 2 - Utilitários de texto: contagem de palavras, LaTeX, pós-processamento."""
import re

from config import DELIMITADOR_LATEX

RE_MATH = re.compile(r'<anki-mathjax(\s+block="true")?>(.*?)</anki-mathjax>', re.S)
_RE_TAG_QUEBRA = re.compile(r"</?(?:br|ul|li)\s*/?>", re.I)
_RE_TAG_QUALQUER = re.compile(r"<[^>]+>")
_RE_ENTIDADE = re.compile(r"&(?:[a-zA-Z]+|#\d+);")


def sem_latex_e_tags(texto: str) -> str:
    """Remove o conteúdo de <anki-mathjax> e todas as tags HTML (seção 3.4, passo 1)."""
    t = RE_MATH.sub(" ", texto)
    t = _RE_TAG_QUEBRA.sub(" ", t)
    return _RE_TAG_QUALQUER.sub("", t)


def contar_palavras(texto) -> int:
    """Conta trechos separados por espaço com ao menos uma letra (numeração '1)' não conta)."""
    if not texto:
        return 0
    return sum(1 for p in sem_latex_e_tags(texto).split() if re.search(r"[^\W\d_]", p))


def apenas_matematica(texto) -> bool:
    """True se o texto é só expressão(ões) matemática(s), sem palavras."""
    return bool(texto) and bool(RE_MATH.search(texto)) and contar_palavras(texto) == 0


def minuscula_inicial(texto: str) -> str:
    """Põe a primeira letra em minúscula, exceto sigla ou início em fórmula (seção 7).

    Nomes próprios não são detectáveis automaticamente: se importar, a IA deve
    evitar começar a pergunta com eles quando houver contexto.
    """
    m = re.match(r"((?:<(?:b|i|destaque)>)*)(\S+)", texto)
    if not m:
        return texto
    prefixo, palavra = m.group(1), m.group(2)
    if palavra.startswith("<"):  # fórmula ou outra tag
        return texto
    letras = re.match(r"[^\W\d_]+", palavra)
    if not letras:
        return texto
    if sum(c.isupper() for c in letras.group(0)) >= 2:  # sigla
        return texto
    i = len(prefixo)
    return texto[:i] + texto[i].lower() + texto[i + 1:]


def _escapar_latex(conteudo: str) -> str:
    conteudo = re.sub(r"&(?![a-zA-Z]+;|#\d+;)", "&amp;", conteudo)
    return conteudo.replace("<", "&lt;").replace(">", "&gt;")


def posprocessar(html: str, delimitador: str = None) -> str:
    """Pós-processamento da seção 7: &nbsp;, quebras, <destaque>, escape e delimitador do LaTeX."""
    delimitador = delimitador or DELIMITADOR_LATEX
    html = html.replace("&nbsp;", " ").replace("\r", "").replace("\n", "")
    html = re.sub(
        r"<destaque>(.*?)</destaque>",
        r'<span style="color: rgb(255, 255, 127);"><b>\1</b></span>',
        html, flags=re.S,
    )

    def _sub(m):
        bloco = bool(m.group(1))
        c = _escapar_latex(m.group(2))
        if delimitador == "parenteses":
            return f"\\[{c}\\]" if bloco else f"\\({c}\\)"
        abre = '<anki-mathjax block="true">' if bloco else "<anki-mathjax>"
        return f"{abre}{c}</anki-mathjax>"

    return RE_MATH.sub(_sub, html)
