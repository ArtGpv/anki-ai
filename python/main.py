"""Módulo 7 - Linha de comando.

Entrada: arquivo JSON com uma lista de itens:
  [{"baralho": "Sinais", "tags": "Sinais e Sistemas, Laplace", "cartao": { ...JSON da IA... }}, ...]
Uso: python main.py entrada.json -o saida.apkg [--delimitador tag|parenteses]
"""
import argparse
import json
import sys

from apkg import gerar_apkg
from pipeline import processar


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Converte JSONs de cartões em um .apkg")
    ap.add_argument("entrada")
    ap.add_argument("-o", "--saida", default="cartoes.apkg")
    ap.add_argument("--delimitador", choices=["tag", "parenteses"], default=None)
    args = ap.parse_args(argv)

    with open(args.entrada, encoding="utf-8") as f:
        itens = json.load(f)

    prontos, falhas = [], 0
    for n, it in enumerate(itens, 1):
        r = processar(it["cartao"], it["baralho"], it.get("tags"), args.delimitador)
        if r.ok:
            prontos.append(r.cartao)
        else:
            falhas += 1
            print(f"[cartão {n}] {r.status}: {r.mensagem}")
            for e in r.erros:
                print(f"    - {e}")

    if prontos:
        total = gerar_apkg(prontos, args.saida)
        print(f"{total} cartão(ões) gravado(s) em {args.saida}.")
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(main())
