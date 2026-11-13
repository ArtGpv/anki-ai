"""Módulo 6 - Pipeline: JSON da IA -> validação (com regeneração) -> cartão pronto."""
import json
import re
from dataclasses import dataclass, field

from apkg import CartaoPronto
from config import SEPARADOR_TAGS, TAG_IMAGEM_PENDENTE, TAG_MODELO_INCERTO, TENTATIVAS_REGENERACAO
from renderizador import renderizar, tem_imagem
from validador import validar


@dataclass
class Resultado:
    ok: bool
    status: str                 # ok | separar_cartoes | entrada_insuficiente | invalido
    mensagem: str = None        # aviso ao usuário (quando não ok)
    erros: list = field(default_factory=list)
    cartao: CartaoPronto = None
    json: dict = None


def normalizar_tags(tags, separador: str = None) -> list:
    """Aceita texto ('a, b c') ou lista. Espaços viram '_'; o delimitador '::' é preservado."""
    separador = separador or SEPARADOR_TAGS
    if not tags:
        return []
    itens = re.split(re.escape(separador), tags) if isinstance(tags, str) else list(tags)
    saida = []
    for t in itens:
        t = re.sub(r"\s*::\s*", "::", str(t).strip())  # preserva a hierarquia do Anki
        t = re.sub(r"\s+", "_", t)
        if t and t not in saida:
            saida.append(t)
    return saida


def _carregar(entrada):
    """Aceita dict ou texto JSON (com ou sem cerca ```json)."""
    if isinstance(entrada, dict):
        return entrada, []
    texto = re.sub(r"^\s*```(?:json)?\s*|\s*```\s*$", "", str(entrada).strip())
    try:
        return json.loads(texto), []
    except json.JSONDecodeError as e:
        return None, [f"JSON inválido: {e}"]


def processar(entrada, baralho: str, tags=None, delimitador: str = None,
              regenerar=None) -> Resultado:
    """Valida e renderiza um cartão.

    `regenerar(erros) -> dict|str` é opcional: chama o Gemini de novo enviando a lista
    de erros (até TENTATIVAS_REGENERACAO vezes, seção 8, passo 7).
    """
    tentativa = 0
    while True:
        dados, erros = _carregar(entrada)
        if not erros:
            erros = validar(dados)
        if not erros:
            break
        if regenerar is None or tentativa >= TENTATIVAS_REGENERACAO:
            return Resultado(False, "invalido", "Não foi possível gerar um cartão válido.",
                             erros, json=dados)
        tentativa += 1
        entrada = regenerar(erros)

    if dados["status"] != "ok":
        return Resultado(False, dados["status"], dados["mensagem"], json=dados)

    front, back = renderizar(dados, delimitador)
    lista_tags = normalizar_tags(tags)
    if tem_imagem(dados) and TAG_IMAGEM_PENDENTE not in lista_tags:
        lista_tags.append(TAG_IMAGEM_PENDENTE)
    if dados["modelo_incerto"] and TAG_MODELO_INCERTO not in lista_tags:
        lista_tags.append(TAG_MODELO_INCERTO)
    return Resultado(True, "ok", cartao=CartaoPronto(baralho, front, back, lista_tags), json=dados)
