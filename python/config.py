"""Módulo 1 - Configurações e constantes (seções 3.4, 6, 7 e 8 da especificação)."""

# Delimitador final do LaTeX no .apkg (pendência 2 da especificação).
#   "parenteses": \( ... \) e \[ ... \]  (renderiza em qualquer Anki após importar)
#   "tag":        <anki-mathjax> literal (só renderiza se o Anki converter ao editar)
# Teste os dois com uma importação real e deixe o que funcionar.
DELIMITADOR_LATEX = "parenteses"

# Separador das tags digitadas no frontend (pendência 3). Espaços dentro de uma tag viram "_".
SEPARADOR_TAGS = ","
TAG_IMAGEM_PENDENTE = "Imagem_pendente"
TAG_MODELO_INCERTO = "modelo_incerto"

TENTATIVAS_REGENERACAO = 2
MIN_ITENS = 2
MAX_ITENS = 5

STATUS_VALIDOS = ("ok", "separar_cartoes", "entrada_insuficiente")
MODELOS = (
    "definicao",
    "definicoes_multiplas",
    "demonstracao_pura",
    "demonstracao_raciocinio",
)

CAMPOS = (
    "status", "mensagem", "modelo", "modelo_incerto", "contexto", "pergunta",
    "observacao_pergunta", "imagem_pergunta", "itens", "resposta",
    "observacao_resposta", "exemplo", "imagem_resposta",
)
CAMPOS_ITEM = ("pergunta", "rotulo", "resposta", "exemplo", "imagem")

# Campos que devem ser null em cada modelo.
CAMPOS_NULL = {
    "definicao": ("itens",),
    "definicoes_multiplas": ("resposta", "exemplo", "imagem_resposta"),
    "demonstracao_pura": ("itens", "exemplo"),
    "demonstracao_raciocinio": ("itens", "exemplo"),
}

# Limites (min, max) de palavras. Pergunta = contexto + pergunta (seção 3.4).
LIMITES = {
    "definicao": {"pergunta": (3, 60), "resposta": (6, 160)},
    "definicoes_multiplas": {
        "pergunta": (3, 50), "item_pergunta": (1, 50), "item_resposta": (6, 100),
    },
    "demonstracao_pura": {"pergunta": (3, 60), "resposta": (7, 160)},
    "demonstracao_raciocinio": {"pergunta": (3, 60), "resposta": (20, 300)},
}

TAGS_HTML_PERMITIDAS = {"b", "i", "br", "ul", "li", "destaque", "anki-mathjax"}

# Identificadores do genanki (fixos para o Anki reconhecer o mesmo tipo de nota).
ID_MODELO_ANKI = 1607392319
NOME_MODELO_ANKI = "Cartao Gerador IA"
