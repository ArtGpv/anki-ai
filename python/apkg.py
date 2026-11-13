"""Módulo 5 - Geração do .apkg com genanki. Recebe cartões já renderizados."""
import zlib
from dataclasses import dataclass, field

from config import ID_MODELO_ANKI, NOME_MODELO_ANKI


@dataclass
class CartaoPronto:
    baralho: str
    front: str
    back: str
    tags: list = field(default_factory=list)


def _id_baralho(nome: str) -> int:
    """ID estável derivado do nome: reimportar o mesmo grupo atualiza o mesmo baralho."""
    return 1_000_000_000 + zlib.crc32(nome.encode("utf-8")) % 1_000_000_000


def _modelo_anki(genanki):
    return genanki.Model(
        ID_MODELO_ANKI,
        NOME_MODELO_ANKI,
        fields=[{"name": "Front"}, {"name": "Back"}],
        templates=[{
            "name": "Cartao 1",
            "qfmt": "{{Front}}",
            "afmt": "{{FrontSide}}<hr id=answer>{{Back}}",
        }],
        css=(".card { font-family: arial; font-size: 20px; text-align: left; "
             "color: black; background-color: white; }"),
    )


def gerar_apkg(cartoes: list, caminho: str) -> int:
    """Agrupa os cartões por baralho e grava o .apkg. Retorna o número de notas."""
    try:
        import genanki
    except ImportError as e:
        raise RuntimeError("Instale a biblioteca: pip install genanki") from e

    modelo = _modelo_anki(genanki)
    baralhos = {}
    for c in cartoes:
        if c.baralho not in baralhos:
            baralhos[c.baralho] = genanki.Deck(_id_baralho(c.baralho), c.baralho)
        nota = genanki.Note(
            model=modelo,
            fields=[c.front, c.back],
            tags=c.tags,  # genanki não aceita espaços em tags (já tratados no pipeline)
            guid=genanki.guid_for(c.baralho, c.front),
        )
        baralhos[c.baralho].add_note(nota)

    genanki.Package(list(baralhos.values())).write_to_file(caminho)
    return len(cartoes)
