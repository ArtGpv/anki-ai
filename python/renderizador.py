"""Módulo 4 - Renderização JSON -> HTML do Anki (seção 7). Retorna (front, back)."""
import re

from texto import minuscula_inicial, posprocessar


def _pontuar(texto: str, final: str) -> str:
    """Acrescenta ';' ou '.' ao item, exceto se já termina com pontuação."""
    t = texto.rstrip()
    puro = re.sub(r"<[^>]+>", "", t)
    return t if puro and puro[-1] in ".;:!?" else t + final


def _front(c: dict) -> str:
    pergunta = c["pergunta"]
    if c["contexto"]:
        partes = f'{c["contexto"]}, {minuscula_inicial(pergunta)}'
    else:
        partes = pergunta

    if c["modelo"] == "definicoes_multiplas":
        itens = c["itens"]
        lis = "".join(
            f"<li>{_pontuar(it['pergunta'], '.' if n == len(itens) else ';')}</li>"
            for n, it in enumerate(itens, 1)
        )
        partes += f"<br><ul>{lis}</ul>"

    if c["observacao_pergunta"]:
        partes += f'<br><br><i>Obs</i>: {c["observacao_pergunta"]}'
    if c["imagem_pergunta"]:
        partes += f'<br><br>[{c["imagem_pergunta"]}]'
    return partes


def _back(c: dict) -> str:
    if c["modelo"] == "definicoes_multiplas":
        partes = ""
        for it in c["itens"]:
            rotulo = it["rotulo"] or f"<b>{it['pergunta']}</b>"
            partes += f"<ul><li>{rotulo}: {it['resposta']}</li></ul>"
            if it["exemplo"]:
                partes += f"ex: {it['exemplo']}"
            if it["imagem"]:
                partes += ("<br>" if it["exemplo"] else "") + f"[{it['imagem']}]"
    else:
        partes = c["resposta"] or ""
        if c["modelo"] == "definicao" and c["exemplo"]:
            partes += f'<br>ex: {c["exemplo"]}'

    if c["observacao_resposta"]:
        partes += f'<br><br><b><i>Obs</i></b>: {c["observacao_resposta"]}'
    if c["imagem_resposta"]:
        partes += f'<br><br>[{c["imagem_resposta"]}]'
    return partes


def renderizar(c: dict, delimitador: str = None):
    """Recebe o JSON já validado (status = ok) e devolve (front, back) prontos para o Anki."""
    return posprocessar(_front(c), delimitador), posprocessar(_back(c), delimitador)


def tem_imagem(c: dict) -> bool:
    if c.get("imagem_pergunta") or c.get("imagem_resposta"):
        return True
    return any(it.get("imagem") for it in (c.get("itens") or []))
