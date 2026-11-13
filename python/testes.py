"""Testes: valida e renderiza todos os exemplos JSON da especificação.
Uso: python testes.py especificacao_cartoes.md
"""
import copy
import json
import re
import sys

from pipeline import normalizar_tags, processar
from validador import validar


def blocos_json(caminho):
    texto = open(caminho, encoding="utf-8").read()
    return [json.loads(b) for b in re.findall(r"```json\n(.*?)```", texto, re.S)]


def main(caminho):
    exemplos = blocos_json(caminho)
    falhas = 0
    for n, ex in enumerate(exemplos, 1):
        r = processar(ex, "Teste", "Sinais e Sistemas")
        marca = "OK " if r.ok else "ERRO"
        print(f"{marca} exemplo {n} ({ex['modelo']})")
        for e in r.erros:
            print(f"      - {e}")
        falhas += not r.ok
        if r.ok:
            assert "&nbsp;" not in r.cartao.front + r.cartao.back
            assert "\n" not in r.cartao.front + r.cartao.back
            if n in (1, 6, 8):
                print("      Front:", r.cartao.front)
                print("      Back :", r.cartao.back[:160])

    # Casos que DEVEM ser reprovados
    base = copy.deepcopy(exemplos[0])
    ruins = {
        "contexto com vírgula": {**base, "contexto": "Em sinais,"},
        "tag proibida": {**base, "pergunta": "Defina <span>x</span> em sinais."},
        "< solto": {**base, "pergunta": "Defina x quando t<0 em sinais."},
        "imagem sem prefixo": {**base, "imagem_pergunta": "Uma rampa"},
        "campo ausente": {k: v for k, v in base.items() if k != "exemplo"},
    }
    m2 = copy.deepcopy(next(e for e in exemplos if e["modelo"] == "definicoes_multiplas"))
    m2["itens"] = m2["itens"] * 3
    ruins["mais de 5 itens"] = m2
    for nome, caso in ruins.items():
        erros = validar(caso)
        print(("OK  " if erros else "ERRO"), "reprova:", nome, "->", erros[:1])
        falhas += not erros

    assert normalizar_tags("Sinais e Sistemas, Laplace") == ["Sinais_e_Sistemas", "Laplace"]
    assert normalizar_tags(["Mat :: Geometria", "Cursos::Dados&R"]) == ["Mat::Geometria", "Cursos::Dados&R"]
    incerto = {**copy.deepcopy(exemplos[0]), "modelo_incerto": True}
    assert "modelo_incerto" in processar(incerto, "T", "x").cartao.tags
    assert validar({**base, "modelo_incerto": "sim"}), "modelo_incerto não booleano deveria reprovar"
    img = processar(exemplos[2], "T", "x")  # M1-3 tem imagem_resposta
    assert "Imagem_pendente" in img.cartao.tags
    print("\nFalhas:", falhas)
    return falhas


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "especificacao_cartoes.md"))
