"""Ponte entre o JavaScript (Worker do Pyodide) e os módulos Python.

Só recebe e devolve texto/números, para a conversão JS <-> Python ser trivial.
A regeneração (chamar o Gemini de novo com os erros) é feita no JS, porque `processar`
é síncrono e a chamada ao Gemini é assíncrona; por isso `regenerar` nunca é passado aqui.
"""
import json
from dataclasses import asdict

from apkg import CartaoPronto, gerar_apkg
from config import DELIMITADOR_LATEX, TENTATIVAS_REGENERACAO
from pipeline import processar


def info() -> str:
    return json.dumps({
        "tentativas_regeneracao": TENTATIVAS_REGENERACAO,
        "delimitador": DELIMITADOR_LATEX,
    })


def processar_json(entrada: str, baralho: str, tags_json=None, delimitador=None) -> str:
    """`entrada`: texto JSON da IA. `tags_json`: lista JSON de caminhos de tags (ou None)."""
    tags = json.loads(tags_json) if tags_json else None
    r = processar(entrada, baralho, tags, delimitador or None)
    return json.dumps({
        "ok": r.ok,
        "status": r.status,
        "mensagem": r.mensagem,
        "erros": r.erros,
        "cartao": asdict(r.cartao) if r.cartao else None,
        "json": r.json,
    }, ensure_ascii=False)


def gerar_apkg_arquivo(cartoes_json: str, caminho: str) -> int:
    """Grava o .apkg em `caminho` (sistema de arquivos virtual) e devolve o número de notas."""
    cartoes = [CartaoPronto(**c) for c in json.loads(cartoes_json)]
    if not cartoes:
        raise ValueError("Nenhum cartão para exportar.")
    return gerar_apkg(cartoes, caminho)
