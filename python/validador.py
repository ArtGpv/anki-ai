"""Módulo 3 - Validação do JSON (seção 8). Retorna lista de erros (vazia = válido)."""
import re

from config import (CAMPOS, CAMPOS_ITEM, CAMPOS_NULL, LIMITES, MAX_ITENS, MIN_ITENS,
                    MODELOS, STATUS_VALIDOS, TAGS_HTML_PERMITIDAS)
from texto import RE_MATH, apenas_matematica, contar_palavras

_RE_TAG = re.compile(r"<(/?)([a-zA-Z][\w-]*)([^<>]*)>")


def _checar_html(texto, nome, erros):
    if texto is None:
        return
    if not isinstance(texto, str):
        erros.append(f"{nome}: deve ser texto ou null.")
        return
    if "&nbsp;" in texto:
        erros.append(f"{nome}: contém &nbsp;.")
    if "\n" in texto or "\r" in texto:
        erros.append(f"{nome}: contém quebra de linha; use <br>.")
    fora = RE_MATH.sub(" ", texto)
    if "anki-mathjax" in fora:
        erros.append(f"{nome}: <anki-mathjax> mal formado (sem fechamento ou com atributo diferente de block=\"true\").")
    pilha = []
    for m in _RE_TAG.finditer(fora):
        fecha, tag, attrs = m.group(1), m.group(2).lower(), m.group(3).strip()
        if tag not in TAGS_HTML_PERMITIDAS:
            erros.append(f"{nome}: tag não permitida <{tag}>.")
            continue
        if attrs:
            erros.append(f"{nome}: atributos não são permitidos em <{tag}>.")
        if tag == "br":
            continue
        if not fecha:
            pilha.append(tag)
        elif pilha and pilha[-1] == tag:
            pilha.pop()
        else:
            erros.append(f"{nome}: tag </{tag}> sem abertura correspondente.")
    for tag in pilha:
        erros.append(f"{nome}: tag <{tag}> não foi fechada.")
    resto = _RE_TAG.sub("", fora)
    if "<" in resto or ">" in resto:
        erros.append(f"{nome}: '<' ou '>' solto fora de fórmula; coloque dentro de <anki-mathjax>.")
    if "**" in resto or "$" in resto:
        erros.append(f"{nome}: markdown ou '$' não são permitidos; use as marcações HTML e <anki-mathjax>.")


def _checar_faixa(qtd, faixa, nome, erros, ignorar_minimo=False):
    mn, mx = faixa
    if qtd > mx:
        erros.append(f"{nome}: {qtd} palavras, máximo {mx}.")
    elif qtd < mn and not ignorar_minimo:
        erros.append(f"{nome}: {qtd} palavras, mínimo {mn}.")


def _checar_imagem(texto, nome, erros):
    if texto is not None:
        if not isinstance(texto, str) or not texto.startswith("Imagem"):
            erros.append(f"{nome}: a descrição deve começar por 'Imagem de/da/do...'.")
        elif texto.startswith("[") or texto.endswith("]"):
            erros.append(f"{nome}: sem colchetes (o código os coloca).")


def validar(c) -> list:
    erros = []
    if not isinstance(c, dict):
        return ["O JSON deve ser um objeto."]
    faltando = [k for k in CAMPOS if k not in c]
    extras = [k for k in c if k not in CAMPOS]
    if faltando:
        erros.append(f"Campos ausentes: {', '.join(faltando)}.")
    if extras:
        erros.append(f"Campos não previstos: {', '.join(extras)}.")
    if faltando:
        return erros

    status = c["status"]
    if status not in STATUS_VALIDOS:
        return erros + [f"status inválido: {status!r}."]
    if status != "ok":
        if not c["mensagem"]:
            erros.append("mensagem é obrigatória quando status != ok.")
        demais = [k for k in CAMPOS if k not in ("status", "mensagem") and c[k] is not None]
        if demais:
            erros.append(f"Com status {status}, estes campos devem ser null: {', '.join(demais)}.")
        return erros

    # status == ok
    if c["mensagem"] is not None:
        erros.append("mensagem deve ser null quando status = ok.")
    modelo = c["modelo"]
    if modelo not in MODELOS:
        return erros + [f"modelo inválido: {modelo!r}."]
    if not isinstance(c["modelo_incerto"], bool):
        erros.append("modelo_incerto deve ser true ou false quando status = ok.")
    for k in CAMPOS_NULL[modelo]:
        if c[k] is not None:
            erros.append(f"{k} deve ser null no modelo {modelo}.")
    if not c["pergunta"] or not isinstance(c["pergunta"], str):
        erros.append("pergunta é obrigatória.")
        return erros

    # Contexto
    ctx = c["contexto"]
    if ctx is not None and (not isinstance(ctx, str) or ctx.strip().endswith(",")):
        erros.append("contexto não pode terminar em vírgula.")

    # HTML e imagens
    for k in ("contexto", "pergunta", "observacao_pergunta", "resposta",
              "observacao_resposta", "exemplo"):
        _checar_html(c[k], k, erros)
    _checar_imagem(c["imagem_pergunta"], "imagem_pergunta", erros)
    _checar_imagem(c["imagem_resposta"], "imagem_resposta", erros)

    lim = LIMITES[modelo]
    _checar_faixa(contar_palavras(ctx) + contar_palavras(c["pergunta"]), lim["pergunta"],
                  "pergunta (contexto + pergunta)", erros)

    if modelo == "definicoes_multiplas":
        itens = c["itens"]
        if not isinstance(itens, list):
            erros.append("itens é obrigatório (lista) no modelo definicoes_multiplas.")
            return erros
        if len(itens) > MAX_ITENS:
            erros.append(f"{len(itens)} itens: separe em mais cartões (máximo {MAX_ITENS}).")
        elif len(itens) < MIN_ITENS:
            erros.append(f"itens deve ter de {MIN_ITENS} a {MAX_ITENS} elementos.")
        for n, it in enumerate(itens, 1):
            nome = f"itens[{n}]"
            if not isinstance(it, dict) or set(it) != set(CAMPOS_ITEM):
                erros.append(f"{nome}: deve ter exatamente os campos {', '.join(CAMPOS_ITEM)}.")
                continue
            if not it["pergunta"] or not it["resposta"]:
                erros.append(f"{nome}: pergunta e resposta são obrigatórias.")
                continue
            for k in ("pergunta", "rotulo", "resposta", "exemplo"):
                _checar_html(it[k], f"{nome}.{k}", erros)
            _checar_imagem(it["imagem"], f"{nome}.imagem", erros)
            _checar_faixa(contar_palavras(it["pergunta"]), lim["item_pergunta"],
                          f"{nome}.pergunta", erros)
            _checar_faixa(contar_palavras(it["resposta"]), lim["item_resposta"],
                          f"{nome}.resposta", erros)
    else:
        if not c["resposta"]:
            erros.append("resposta é obrigatória.")
        else:
            _checar_faixa(contar_palavras(c["resposta"]), lim["resposta"], "resposta", erros,
                          ignorar_minimo=(modelo == "definicao" and apenas_matematica(c["resposta"])))
    return erros
